import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/permissions";
import { jsonError, safeJson } from "@/lib/api";
import { logServerError } from "@/lib/logger";

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function hasNameMatch(gymName: string, legalName?: string) {
  if (!legalName) return false;
  const gymTokens = new Set(normalize(gymName));
  const legalTokens = normalize(legalName);
  const matches = legalTokens.filter((t) => gymTokens.has(t)).length;
  return matches >= Math.max(2, Math.min(legalTokens.length, 3));
}

function hasCityMatch(address: string, city?: string) {
  if (!city) return false;
  return address.toLowerCase().includes(city.toLowerCase());
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const parsed = await safeJson<{
    gymId?: string;
    gstNumber?: string;
    gstCertificateUrl?: string;
    gstLegalName?: string;
    gstCity?: string;
  }>(req);
  if (!parsed.ok) {
    return jsonError("Invalid JSON body", 400);
  }
  const gymId = parsed.data.gymId?.trim();
  const gstNumber = parsed.data.gstNumber?.trim().toUpperCase();
  const gstCertificateUrl = parsed.data.gstCertificateUrl?.trim();
  if (!gymId || !gstNumber || !gstCertificateUrl) {
    return jsonError("gymId, gstNumber, gstCertificateUrl required", 400);
  }
  if (!GSTIN_REGEX.test(gstNumber)) {
    return jsonError("Invalid GST number format", 400);
  }
  try {
    const gym = await prisma.gym.findFirst({ where: { id: gymId, ownerId: uid } });
    if (!gym) {
      return jsonError("Gym not found", 404);
    }
    const mismatchNotes: string[] = [];
    if (!hasNameMatch(gym.name, parsed.data.gstLegalName)) {
      mismatchNotes.push("GST legal name mismatch");
    }
    if (!hasCityMatch(gym.address, parsed.data.gstCity)) {
      mismatchNotes.push("GST city mismatch");
    }
    const notes = mismatchNotes.length > 0 ? mismatchNotes.join("; ") : null;
    const updated = await prisma.gym.update({
      where: { id: gymId },
      data: {
        gstNumber,
        gstCertificateUrl,
        gstVerifiedAt: null,
        verificationStatus: "PENDING",
        verificationNotes: notes,
      },
    });
    return NextResponse.json({
      ok: true,
      verificationStatus: updated.verificationStatus,
      verificationNotes: updated.verificationNotes,
    });
  } catch (error) {
    logServerError(error as Error, { route: "/api/owner/gym/verification/gst", userId: uid });
    return jsonError("Failed to submit GST details", 500);
  }
}
