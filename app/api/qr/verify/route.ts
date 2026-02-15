import crypto from "crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonError, safeJson } from "@/lib/api";
import { requireUser } from "@/lib/permissions";
import { QrTypeSchema } from "@/lib/qr/qr-types";
import { decodeSignedPayload, hashQrToken, verifySignedPayload } from "@/lib/qr/qr-token";

const MIN_VALID_SESSION_MINUTES = 20;
const MAX_GPS_RADIUS_METERS = 150;
const GRACE_MS = 5 * 60 * 1000;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000;
  const dLat = toRadians(bLat - aLat);
  const dLng = toRadians(bLng - aLng);
  const lat1 = toRadians(aLat);
  const lat2 = toRadians(bLat);

  const sin1 = Math.sin(dLat / 2);
  const sin2 = Math.sin(dLng / 2);

  const h = sin1 * sin1 + Math.cos(lat1) * Math.cos(lat2) * sin2 * sin2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireUser(session)) return jsonError("Unauthorized", 401);

  const parsed = await safeJson<{
    token?: string;
    gymId?: string;
    type?: string;
    latitude?: number;
    longitude?: number;
    sessionId?: string;
    entryAt?: number;
    verifiedAt?: number;
  }>(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);

  const { token, gymId, type, latitude, longitude, sessionId, entryAt, verifiedAt } = parsed.data;
  if (!token) return jsonError("Missing token", 400);

  const payload = decodeSignedPayload(token);
  if (!payload) return jsonError("Invalid token", 400);

  const typeParsed = QrTypeSchema.safeParse(payload.type);
  if (!typeParsed.success) return jsonError("Invalid token type", 400);

  if (gymId && payload.gymId !== gymId) {
    return jsonError("Token gym mismatch", 400);
  }
  if (type && payload.type !== type.toUpperCase()) {
    return jsonError("Token type mismatch", 400);
  }

  const now = Date.now();
  if (verifiedAt && verifiedAt > payload.exp + GRACE_MS) {
    return jsonError("Token expired", 400);
  }

  if (!verifiedAt) {
    const verified = verifySignedPayload(payload, now);
    if (!verified.ok) return jsonError(verified.reason ?? "Invalid token", 400);
  }

  const staticQr = await prisma.qrStatic.findUnique({
    where: { gymId_type: { gymId: payload.gymId, type: payload.type } },
  });
  if (!staticQr || staticQr.revokedAt) return jsonError("QR revoked", 403);
  if (payload.v !== staticQr.currentKeyVersion) {
    return jsonError("QR version expired", 403);
  }

  const gym = await prisma.gym.findUnique({ where: { id: payload.gymId } });
  if (!gym) return jsonError("Gym not found", 404);

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return jsonError("Location required", 400);
  }
  // latitude/longitude removed from gym, skip distance check

  const uid = (session!.user as { id: string }).id;
  const tokenHash = hashQrToken(token);

  const result = await prisma.$transaction(async (tx) => {
    const existingToken = await tx.qrToken.findUnique({ where: { tokenHash } });
    if (existingToken?.usedAt) {
      return { ok: false as const, error: "Token already used" };
    }

    if (existingToken) {
      await tx.qrToken.update({
        where: { tokenHash },
        data: { usedAt: new Date() },
      });
    } else {
      await tx.qrToken.create({
        data: {
          gymId: payload.gymId,
          type: payload.type,
          tokenHash,
          expiresAt: new Date(payload.exp),
          usedAt: new Date(),
        },
      });
    }

    if (payload.type === "ENTRY") {
      const active = await tx.gymSession.findFirst({
        where: { userId: uid, exitAt: null },
      });
      if (active) {
        return { ok: false as const, error: "Active session exists" };
      }

      const created = await tx.gymSession.create({
        data: {
          id: sessionId ?? crypto.randomUUID(),
          userId: uid,
          gymId: payload.gymId,
          entryAt: new Date(entryAt ?? now),
          validForStreak: false,
          verificationStatus: "VERIFIED",
        },
      });

      return { ok: true as const, session: created };
    }

    if (payload.type === "EXIT") {
      const active = await tx.gymSession.findFirst({
        where: { userId: uid, exitAt: null },
        orderBy: { entryAt: "desc" },
      });
      if (!active) {
        return { ok: false as const, error: "No active session" };
      }

      const exitTime = new Date(now);
      const durationMinutes = Math.max(1, Math.round((exitTime.getTime() - active.entryAt.getTime()) / 60000));
      const validForStreak = durationMinutes >= MIN_VALID_SESSION_MINUTES;

      const updated = await tx.gymSession.update({
        where: { id: active.id },
        data: {
          exitAt: exitTime,
          durationMinutes,
          calories: active.calories ?? null,
          validForStreak,
          endedBy: "EXIT_QR",
          verificationStatus: "VERIFIED",
        },
      });

      return { ok: true as const, session: updated };
    }

    return { ok: true as const, session: null };
  });

  if (!result.ok) return jsonError(result.error ?? "Verification failed", 400);

  return NextResponse.json({
    ok: true,
    session: result.session
      ? {
          id: result.session.id,
          gymId: result.session.gymId,
          entryAt: result.session.entryAt.toISOString(),
          exitAt: result.session.exitAt ? result.session.exitAt.toISOString() : null,
          durationMinutes: result.session.durationMinutes,
          calories: result.session.calories,
          validForStreak: result.session.validForStreak,
          endedBy: result.session.endedBy,
          verificationStatus: result.session.verificationStatus,
          createdAt: result.session.createdAt.toISOString(),
          updatedAt: result.session.updatedAt.toISOString(),
        }
      : null,
  });
}
