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
    },
  });
  await prisma.qrKey.create({
    data: {
      gymId,
      key: "static-key", // placeholder, update as needed
      version: 1,
    },
  });

  if (actorId) {
    await prisma.qrAuditLog.create({
      data: {
        actorId,
        gymId,
        action: "GENERATE",
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
    // QrKey model does not have type, active, or rotatedAt fields. Only gymId, key, version, createdAt.
    // Remove old keys for this gym (if needed, but no 'active' field to update)
    // Instead, just create a new key for the gym and version.
    prisma.qrKey.create({
      data: {
        gymId: params.gymId,
        key: crypto.randomUUID(), // generate a new unique key value
        version: nextVersion,
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
        action: params.revoke ? "REVOKE" : "REGENERATE",
      },
    }),
  ]);

  return { ...staticQr, currentKeyVersion: nextVersion };
}

export async function getLastQrGeneration(gymId: string, type: QrType) {
  const log = await prisma.qrAuditLog.findFirst({
    where: { gymId },
    orderBy: { createdAt: "desc" },
  });
  return log?.createdAt ?? null;
}
