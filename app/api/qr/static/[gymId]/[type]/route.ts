import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api";
import { QrTypeSchema } from "@/lib/qr/qr-types";
import { createSignedQrPayload, encodeSignedPayload, buildScanDeepLink } from "@/lib/qr/qr-token";
import { ensureStaticQr } from "@/lib/qr/qr-service";

export async function GET(_req: Request, { params }: { params: Promise<{ gymId: string; type: string }> }) {
  const { gymId, type } = await params;
  const parsedType = QrTypeSchema.safeParse(type.toUpperCase());
  if (!parsedType.success) {
    return jsonError("Invalid QR type", 400);
  }

  const gym = await prisma.gym.findUnique({ where: { id: gymId } });
  if (!gym) return jsonError("Gym not found", 404);
  if (gym.suspendedAt) return jsonError("Gym unavailable", 403);

  const staticQr = await ensureStaticQr(gymId, parsedType.data);
  if (staticQr.revokedAt) {
    return jsonError("QR revoked", 403);
  }

  const payload = createSignedQrPayload({
    gymId,
    type: parsedType.data,
    version: staticQr.currentKeyVersion,
  });
  const token = encodeSignedPayload(payload);

  return NextResponse.json({
    ok: true,
    payload,
    token,
    deepLink: buildScanDeepLink(payload),
    expiresAt: new Date(payload.exp).toISOString(),
  });
}
