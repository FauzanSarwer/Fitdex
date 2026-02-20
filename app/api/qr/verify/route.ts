import crypto from "crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonError, safeJson } from "@/lib/api";
import { requireUser } from "@/lib/permissions";
import { qrVerifyIpRateLimit, qrVerifyRateLimit } from "@/lib/rate-limit";
import { QrTypeSchema } from "@/lib/qr/qr-types";
import {
  decodeSignedPayload,
  hashDeviceBinding,
  hashQrToken,
  verifySignedPayload,
} from "@/lib/qr/qr-token";
import { getQrKeyMaterial } from "@/lib/qr/qr-service";
import { ensureQrKeyRotationSchedulerStarted } from "@/lib/qr/key-rotation-scheduler";
import { validateDeviceBindingHook, validateGpsHook } from "@/lib/qr/qr-hooks";
import { writeAuditLog } from "@/lib/audit-log";
import { logObservabilityEvent } from "@/lib/logger";

const MIN_VALID_SESSION_MINUTES = 20;
const GRACE_MS = 5 * 60 * 1000;

type VerifyRequest = {
  token?: string;
  gymId?: string;
  type?: string;
  latitude?: number;
  longitude?: number;
  deviceId?: string;
  sessionId?: string;
  entryAt?: number;
  verifiedAt?: number;
};

type VerifyResult =
  | { ok: true; session: any; action: string }
  | { ok: false; error: string; status: number };

function getClientIp(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: Request) {
  ensureQrKeyRotationSchedulerStarted();
  const clientIp = getClientIp(req);
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();

  const fail = (
    reason: string,
    status: number,
    context?: Record<string, unknown>
  ) => {
    logObservabilityEvent({
      event: "qr.verify.failure",
      level: status >= 500 ? "error" : "warn",
      context: {
        reason,
        status,
        clientIp,
        requestId,
        ...(context ?? {}),
      },
    });
    return jsonError(reason, status);
  };

  try {
    const ipRateLimit = await qrVerifyIpRateLimit.limit(`qr-verify:ip:${clientIp}`);
    if (!ipRateLimit.success) {
      return fail("Too many verification attempts", 429, {
        reasonCode: "rate_limited_ip",
        limit: ipRateLimit.limit,
        remaining: ipRateLimit.remaining,
        reset: ipRateLimit.reset,
      });
    }

    const session = await getServerSession(authOptions);
    if (!requireUser(session)) return fail("Unauthorized", 401);

    const parsed = await safeJson<VerifyRequest>(req);
    if (!parsed.ok) return fail(parsed.error, 400);

    const { token, gymId, type, latitude, longitude, deviceId, sessionId, entryAt, verifiedAt } = parsed.data;
    if (!token) return fail("Missing token", 400);

    const payload = decodeSignedPayload(token);
    if (!payload) return fail("Invalid token", 400);

    const parsedType = QrTypeSchema.safeParse(payload.type);
    if (!parsedType.success) return fail("Invalid token type", 400);

    const uid = (session!.user as { id: string }).id;
    const scopedRateLimit = await qrVerifyRateLimit.limit(
      `qr-verify:${uid}:${payload.gymId}:${payload.type}`
    );
    if (!scopedRateLimit.success) {
      return fail("Too many verification attempts", 429, {
        reasonCode: "rate_limited_scope",
        userId: uid,
        gymId: payload.gymId,
        qrType: payload.type,
        limit: scopedRateLimit.limit,
        remaining: scopedRateLimit.remaining,
        reset: scopedRateLimit.reset,
      });
    }

    if (gymId && payload.gymId !== gymId) {
      return fail("Token gym mismatch", 400, { gymId, payloadGymId: payload.gymId, userId: uid });
    }
    if (type && payload.type !== type.toUpperCase()) {
      return fail("Token type mismatch", 400, { type, payloadType: payload.type, userId: uid });
    }

    const gym = await prisma.gym.findUnique({
      where: { id: payload.gymId },
      select: { id: true, suspendedAt: true },
    });
    if (!gym) return fail("Gym not found", 404, { gymId: payload.gymId, userId: uid });
    if (gym.suspendedAt) return fail("Gym unavailable", 403, { gymId: payload.gymId, userId: uid });

    const keyBundle = await getQrKeyMaterial(payload.gymId, payload.type, payload.v, {
      createIfMissing: false,
    });
    if (!keyBundle) {
      return fail("QR key unavailable", 403, {
        gymId: payload.gymId,
        type: payload.type,
        version: payload.v,
        userId: uid,
      });
    }
    const { staticQr, key } = keyBundle;

    if (staticQr.revokedAt) return fail("QR revoked", 403, { gymId: payload.gymId, type: payload.type, userId: uid });
    if (payload.v !== staticQr.currentKeyVersion) {
      return fail("QR version expired", 403, {
        gymId: payload.gymId,
        expectedVersion: staticQr.currentKeyVersion,
        tokenVersion: payload.v,
        userId: uid,
      });
    }

    if (typeof verifiedAt === "number") {
      const withinGrace = verifiedAt <= payload.exp + GRACE_MS;
      if (!withinGrace) return fail("Token expired", 400, { mode: "offline_grace", userId: uid });
      const verified = verifySignedPayload(payload, key.key, payload.exp);
      if (!verified.ok) {
        return fail(verified.reason ?? "Invalid token", 400, { mode: "offline_grace", userId: uid });
      }
    } else {
      const verified = verifySignedPayload(payload, key.key, Date.now());
      if (!verified.ok) return fail(verified.reason ?? "Invalid token", 400, { mode: "online", userId: uid });
    }

    const tokenHash = hashQrToken(token);
    const deviceBindingHash = deviceId ? hashDeviceBinding(deviceId) : null;

    const tokenRecord = await prisma.qrToken.findUnique({ where: { tokenHash } });
    if (tokenRecord?.usedAt) {
      return fail("Token already used", 409, { gymId: payload.gymId, tokenHash, userId: uid });
    }
    if (tokenRecord?.deviceBindingHash && tokenRecord.deviceBindingHash !== deviceBindingHash) {
      return fail("Device mismatch", 403, { gymId: payload.gymId, tokenHash, userId: uid });
    }
    if (payload.deviceBinding && payload.deviceBinding !== deviceId) {
      return fail("Device mismatch", 403, { gymId: payload.gymId, tokenHash, userId: uid });
    }

    const deviceHook = await validateDeviceBindingHook({
      gymId: payload.gymId,
      userId: uid,
      type: payload.type,
      deviceId: deviceId ?? null,
      tokenHash,
    });
    if (!deviceHook.ok) {
      return fail(deviceHook.reason ?? "Device validation failed", 403, {
        gymId: payload.gymId,
        tokenHash,
        userId: uid,
      });
    }

    if (typeof latitude === "number" && typeof longitude === "number") {
      const gpsHook = await validateGpsHook({
        gymId: payload.gymId,
        userId: uid,
        latitude,
        longitude,
        type: payload.type,
      });
      if (!gpsHook.ok) {
        return fail(gpsHook.reason ?? "Location validation failed", 403, { gymId: payload.gymId, userId: uid });
      }
    }

    const result = await prisma.$transaction(async (tx): Promise<VerifyResult> => {
      if (!tokenRecord) {
        await tx.qrToken.create({
          data: {
            tokenHash,
            gymId: payload.gymId,
            type: payload.type,
            nonce: payload.nonce,
            deviceBindingHash,
            expiresAt: new Date(payload.exp),
          },
        });
      }

      const consume = await tx.qrToken.updateMany({
        where: {
          tokenHash,
          usedAt: null,
        },
        data: {
          usedAt: new Date(),
          ...(deviceBindingHash ? { deviceBindingHash } : {}),
        },
      });

      if (consume.count !== 1) {
        return { ok: false, error: "Token already used", status: 409 };
      }

      if (payload.type === "ENTRY") {
        const active = await tx.gymSession.findFirst({
          where: { userId: uid, exitAt: null },
          orderBy: { entryAt: "desc" },
        });
        if (active && (!sessionId || active.id !== sessionId)) {
          return { ok: false, error: "Active session exists", status: 409 };
        }

        if (active) {
          if (active.verificationStatus !== "VERIFIED") {
            const updated = await tx.gymSession.update({
              where: { id: active.id },
              data: {
                verificationStatus: "VERIFIED",
                serverVersion: { increment: 1 },
              },
            });
            return { ok: true, session: updated, action: "VERIFY_ENTRY" };
          }
          return { ok: true, session: active, action: "VERIFY_ENTRY" };
        }

        const created = await tx.gymSession.create({
          data: {
            id: sessionId ?? crypto.randomUUID(),
            userId: uid,
            gymId: payload.gymId,
            entryAt: new Date(entryAt ?? Date.now()),
            validForStreak: false,
            verificationStatus: "VERIFIED",
          },
        });

        return { ok: true, session: created, action: "VERIFY_ENTRY" };
      }

      if (payload.type === "EXIT") {
        const active = sessionId
          ? await tx.gymSession.findFirst({
              where: { id: sessionId, userId: uid, exitAt: null },
            })
          : await tx.gymSession.findFirst({
              where: { userId: uid, exitAt: null },
              orderBy: { entryAt: "desc" },
            });

        if (!active) {
          return { ok: false, error: "No active session", status: 404 };
        }

        const exitTime = new Date(verifiedAt ?? Date.now());
        const durationMinutes = Math.max(
          1,
          Math.round((exitTime.getTime() - active.entryAt.getTime()) / 60000)
        );
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
            serverVersion: { increment: 1 },
          },
        });

        return { ok: true, session: updated, action: "VERIFY_EXIT" };
      }

      return { ok: true, session: null, action: "VERIFY_PAYMENT" };
    });

    if (!result.ok) {
      return fail(result.error, result.status, { gymId: payload.gymId, qrType: payload.type, userId: uid });
    }

    await Promise.all([
      prisma.qrAuditLog.create({
        data: {
          actorId: uid,
          gymId: payload.gymId,
          type: "QR",
          action: result.action,
        },
      }),
      writeAuditLog({
        actorId: uid,
        gymId: payload.gymId,
        type: "QR",
        action: result.action,
        metadata: {
          qrType: payload.type,
          sessionId: result.session?.id ?? null,
          offlineGrace: typeof verifiedAt === "number",
          requestId,
        },
      }),
    ]);

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
            serverVersion: result.session.serverVersion,
            createdAt: result.session.createdAt.toISOString(),
            updatedAt: result.session.updatedAt.toISOString(),
          }
        : null,
    });
  } catch (error) {
    logObservabilityEvent({
      event: "qr.verify.failure",
      level: "error",
      context: {
        reason: "Verification failed",
        reasonCode: "unexpected_error",
        status: 500,
        requestId,
        clientIp,
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
    return jsonError("Verification failed", 500);
  }
}
