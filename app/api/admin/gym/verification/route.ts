import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { jsonError, safeJson } from "@/lib/api";
import { logServerError } from "@/lib/logger";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const parsed = await safeJson<{
    gymId?: string;
    action?: "APPROVE" | "REJECT" | "REQUEST_REUPLOAD" | "LINK_SUBACCOUNT";
    notes?: string;
    razorpaySubAccountId?: string;
  }>(req);
  if (!parsed.ok) {
    return jsonError("Invalid JSON body", 400);
  }
  const gymId = parsed.data.gymId?.trim();
  const action = parsed.data.action;
  if (!gymId || !action) {
    return jsonError("gymId and action required", 400);
  }
  try {
    const gym = await prisma.gym.findUnique({ where: { id: gymId } });
    if (!gym) {
      return jsonError("Gym not found", 404);
    }
    if (action === "LINK_SUBACCOUNT") {
      const razorpaySubAccountId = parsed.data.razorpaySubAccountId?.trim();
      if (!razorpaySubAccountId) {
        return jsonError("razorpaySubAccountId required", 400);
      }
      const updated = await prisma.gym.update({
        where: { id: gymId },
        data: {
          razorpaySubAccountId,
          verificationNotes: parsed.data.notes ?? null,
        },
      });
      return NextResponse.json({ ok: true, gym: { id: updated.id, razorpaySubAccountId: updated.razorpaySubAccountId } });
    }

    if (action === "APPROVE") {
      const shouldVerify = gym.bankAccountVerified && gym.razorpaySubAccountId;
      const updated = await prisma.gym.update({
        where: { id: gymId },
        data: {
          gstVerifiedAt: new Date(),
          verificationStatus: shouldVerify ? "VERIFIED" : "PENDING",
          verificationNotes: parsed.data.notes ?? null,
        },
      });
      return NextResponse.json({ ok: true, verificationStatus: updated.verificationStatus });
    }

    if (action === "REJECT") {
      const updated = await prisma.gym.update({
        where: { id: gymId },
        data: {
          verificationStatus: "REJECTED",
          verificationNotes: parsed.data.notes ?? "Rejected",
          gstVerifiedAt: null,
        },
      });
      return NextResponse.json({ ok: true, verificationStatus: updated.verificationStatus });
    }

    if (action === "REQUEST_REUPLOAD") {
      const updated = await prisma.gym.update({
        where: { id: gymId },
        data: {
          verificationStatus: "PENDING",
          verificationNotes: parsed.data.notes ?? "Requesting re-upload",
          gstVerifiedAt: null,
        },
      });
      return NextResponse.json({ ok: true, verificationStatus: updated.verificationStatus });
    }

    return jsonError("Unsupported action", 400);
  } catch (error) {
    logServerError(error as Error, { route: "/api/admin/gym/verification", userId: uid });
    return jsonError("Failed to update verification", 500);
  }
}
