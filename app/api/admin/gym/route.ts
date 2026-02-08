import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { jsonError, safeJson } from "@/lib/api";
import { logServerError } from "@/lib/logger";
import { forwardGeocode, reverseGeocode } from "@/lib/location";
import { normalizeAmenities } from "@/lib/gym-utils";

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const parsed = await safeJson<{
    gymId?: string;
    name?: string;
    address?: string;
    hasAC?: boolean;
    amenities?: string[] | string;
    gymTier?: "CORE" | "SUPPORTING" | "EDGE";
    suspend?: boolean;
    ownerConsent?: boolean;
    featuredStartAt?: string | null;
    featuredEndAt?: string | null;
    isFeatured?: boolean;
    lastContactedAt?: string | null;
    responsivenessScore?: number | null;
    responsivenessOverride?: number | null;
  }>(req);
  if (!parsed.ok) {
    return jsonError("Invalid JSON body", 400);
  }
  const gymId = parsed.data.gymId?.trim();
  if (!gymId) return jsonError("gymId required", 400);

  try {
    const existing = await prisma.gym.findUnique({ where: { id: gymId } });
    if (!existing) return jsonError("Gym not found", 404);

    const update: Record<string, unknown> = {};
    if (parsed.data.name != null) update.name = parsed.data.name.trim();
    if (parsed.data.address != null) {
      update.address = parsed.data.address.trim();
      const geo = await forwardGeocode(parsed.data.address.trim());
      if (geo) {
        update.latitude = geo.latitude;
        update.longitude = geo.longitude;
        const location = await reverseGeocode(geo.latitude, geo.longitude);
        if (location?.city) update.city = location.city;
        if (location?.state) update.state = location.state;
      }
    }
    if (parsed.data.hasAC !== undefined) update.hasAC = !!parsed.data.hasAC;
    if (parsed.data.amenities !== undefined) update.amenities = normalizeAmenities(parsed.data.amenities);
    if (parsed.data.gymTier) update.gymTier = parsed.data.gymTier;
    if (parsed.data.suspend !== undefined) update.suspendedAt = parsed.data.suspend ? new Date() : null;
    if (parsed.data.ownerConsent === true && !existing.ownerConsentAt) update.ownerConsentAt = new Date();
    if (parsed.data.featuredStartAt !== undefined) update.featuredStartAt = parsed.data.featuredStartAt ? new Date(parsed.data.featuredStartAt) : null;
    if (parsed.data.featuredEndAt !== undefined) update.featuredEndAt = parsed.data.featuredEndAt ? new Date(parsed.data.featuredEndAt) : null;
    if (parsed.data.isFeatured !== undefined) update.isFeatured = parsed.data.isFeatured;
    if (parsed.data.lastContactedAt !== undefined) update.lastContactedAt = parsed.data.lastContactedAt ? new Date(parsed.data.lastContactedAt) : null;
    if (parsed.data.responsivenessScore !== undefined && parsed.data.responsivenessScore != null) {
      update.responsivenessScore = parsed.data.responsivenessScore;
    }
    if (parsed.data.responsivenessOverride !== undefined) {
      update.responsivenessOverride = parsed.data.responsivenessOverride;
    }

    const gym = await prisma.gym.update({ where: { id: gymId }, data: update });
    return NextResponse.json({ gym });
  } catch (error) {
    logServerError(error as Error, { route: "/api/admin/gym", userId: uid });
    return jsonError("Failed to update gym", 500);
  }
}
