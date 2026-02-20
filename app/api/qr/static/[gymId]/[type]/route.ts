import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api";
import { qrStaticIssueIpRateLimit, qrStaticIssueRateLimit } from "@/lib/rate-limit";
import { logObservabilityEvent } from "@/lib/logger";
import { QrTypeSchema } from "@/lib/qr/qr-types";
import {
  createSignedQrPayload,
  encodeSignedPayload,
  buildScanDeepLink,
  hashQrToken,
} from "@/lib/qr/qr-token";
import { getQrKeyMaterial, maybeRotateQrKeyByAge } from "@/lib/qr/qr-service";
import { ensureQrKeyRotationSchedulerStarted } from "@/lib/qr/key-rotation-scheduler";

function getClientIp(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

async function enforceRateLimit(params: {
  limiter: typeof qrStaticIssueRateLimit;
  key: string;
  gymId: string;
  qrType: string;
  dimension: "ip" | "gym";
}) {
  const result = await params.limiter.limit(params.key);
  if (result.success) return null;

  logObservabilityEvent({
    event: "qr.static.issue_rate_limited",
    level: "warn",
    context: {
      gymId: params.gymId,
      qrType: params.qrType,
      dimension: params.dimension,
      rateKey: params.key,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    },
  });
  return jsonError("Too many token requests", 429);
}

export async function GET(req: Request, { params }: { params: Promise<{ gymId: string; type: string }> }) {
  ensureQrKeyRotationSchedulerStarted();
  const { gymId, type } = await params;
  const parsedType = QrTypeSchema.safeParse(type.toUpperCase());
  if (!parsedType.success) {
    return jsonError("Invalid QR type", 400);
  }

  const clientIp = getClientIp(req);
  const ipLimit = await enforceRateLimit({
    limiter: qrStaticIssueIpRateLimit,
    key: `qr-static:ip:${clientIp}`,
    gymId,
    qrType: parsedType.data,
    dimension: "ip",
  });
  if (ipLimit) return ipLimit;

  const scopedLimit = await enforceRateLimit({
    limiter: qrStaticIssueRateLimit,
    key: `qr-static:${gymId}:${parsedType.data}:${clientIp}`,
    gymId,
    qrType: parsedType.data,
    dimension: "gym",
  });
  if (scopedLimit) return scopedLimit;

  const gym = await prisma.gym.findUnique({ where: { id: gymId }, select: { id: true, ownerId: true, suspendedAt: true } });
  if (!gym) return jsonError("Gym not found", 404);
  if (gym.suspendedAt) return jsonError("Gym unavailable", 403);

  await maybeRotateQrKeyByAge({
    gymId,
    type: parsedType.data,
    actorId: gym.ownerId,
  });

  const keyBundle = await getQrKeyMaterial(gymId, parsedType.data);
  if (!keyBundle) return jsonError("QR key unavailable", 503);

  const { staticQr, key } = keyBundle;
  if (staticQr.revokedAt) {
    return jsonError("QR revoked", 403);
  }

  const payload = createSignedQrPayload({
    gymId,
    type: parsedType.data,
    version: staticQr.currentKeyVersion,
    keyMaterial: key.key,
  });
  const token = encodeSignedPayload(payload);
  const tokenHash = hashQrToken(token);

  await prisma.qrToken.upsert({
    where: { tokenHash },
    update: {
      gymId,
      type: parsedType.data,
      nonce: payload.nonce,
      expiresAt: new Date(payload.exp),
      usedAt: null,
      deviceBindingHash: null,
    },
    create: {
      tokenHash,
      gymId,
      type: parsedType.data,
      nonce: payload.nonce,
      expiresAt: new Date(payload.exp),
    },
  });

  return NextResponse.json({
    ok: true,
    payload,
    token,
    deepLink: buildScanDeepLink(payload),
    expiresAt: new Date(payload.exp).toISOString(),
  });
}
