import { prisma } from "@/lib/prisma";
import type { QrType } from "./qr-types";

export async function ensureStaticQr(gymId: string, type: QrType, actorId?: string) {
  const existing = await prisma.qrStatic.findUnique({
    where: { gymId_type: { gymId, type } },
  });
  if (existing) return existing;

  const created = await prisma.qrStatic.create({
    data: {
      gymId,
      type,
      currentKeyVersion: 1,
      keys: {
        create: {
          gymId,
          type,
          version: 1,
          active: true,
        },
      },
    },
  });

  if (actorId) {
    await prisma.qrAuditLog.create({
      data: {
        actorId,
        gymId,
        type,
        action: "GENERATE",
        metadata: { version: 1 },
      },
    });
  }

  return created;
}

export async function rotateQrKey(params: {
  gymId: string;
  type: QrType;
  actorId: string;
  revoke?: boolean;
}) {
  const staticQr = await ensureStaticQr(params.gymId, params.type, params.actorId);
  const nextVersion = staticQr.currentKeyVersion + 1;

  await prisma.$transaction([
    prisma.qrKey.updateMany({
      where: { gymId: params.gymId, type: params.type, active: true },
      data: { active: false, rotatedAt: new Date() },
    }),
    prisma.qrKey.create({
      data: {
        gymId: params.gymId,
        type: params.type,
        version: nextVersion,
        active: true,
      },
    }),
    prisma.qrStatic.update({
      where: { gymId_type: { gymId: params.gymId, type: params.type } },
      data: {
        currentKeyVersion: nextVersion,
        revokedAt: params.revoke ? new Date() : null,
      },
    }),
    prisma.qrAuditLog.create({
      data: {
        actorId: params.actorId,
        gymId: params.gymId,
        type: params.type,
        action: params.revoke ? "REVOKE" : "REGENERATE",
        metadata: { version: nextVersion },
      },
    }),
  ]);

  return { ...staticQr, currentKeyVersion: nextVersion };
}

export async function getLastQrGeneration(gymId: string, type: QrType) {
  const log = await prisma.qrAuditLog.findFirst({
    where: { gymId, type },
    orderBy: { createdAt: "desc" },
  });
  return log?.createdAt ?? null;
}
