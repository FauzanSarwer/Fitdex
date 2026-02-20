import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log";
import { logObservabilityEvent } from "@/lib/logger";
import type { QrType } from "./qr-types";

const ROTATION_INTERVAL_MS = Number(process.env.QR_KEY_ROTATION_INTERVAL_MS ?? 6 * 60 * 60 * 1000);

function randomKeyMaterial() {
  return crypto.randomBytes(32).toString("hex");
}

export async function ensureStaticQr(gymId: string, type: QrType, actorId?: string) {
  const existing = await prisma.qrStatic.findUnique({
    where: { gymId_type: { gymId, type } },
  });

  if (existing) {
    const existingKey = await prisma.qrKey.findUnique({
      where: { gymId_version: { gymId, version: existing.currentKeyVersion } },
    });
    if (!existingKey) {
      await prisma.qrKey.create({
        data: {
          gymId,
          key: randomKeyMaterial(),
          version: existing.currentKeyVersion,
        },
      });
    }
    return existing;
  }

  const created = await prisma.$transaction(async (tx) => {
    const nextStatic = await tx.qrStatic.create({
      data: {
        gymId,
        type,
        currentKeyVersion: 1,
      },
    });
    await tx.qrKey.create({
      data: {
        gymId,
        key: randomKeyMaterial(),
        version: 1,
      },
    });
    return nextStatic;
  });

  if (actorId) {
    await Promise.all([
      prisma.qrAuditLog.create({
        data: {
          actorId,
          gymId,
          type: "QR",
          action: "GENERATE",
        },
      }),
      writeAuditLog({
        actorId,
        gymId,
        type: "QR",
        action: "GENERATE",
        metadata: { qrType: type, currentKeyVersion: created.currentKeyVersion },
      }),
    ]);
  }

  return created;
}

export async function getQrKeyMaterial(
  gymId: string,
  type: QrType,
  version?: number,
  options?: { createIfMissing?: boolean }
) {
  const createIfMissing = options?.createIfMissing ?? true;
  const staticQr = createIfMissing
    ? await ensureStaticQr(gymId, type)
    : await prisma.qrStatic.findUnique({
        where: { gymId_type: { gymId, type } },
      });
  if (!staticQr) return null;
  const keyVersion = version ?? staticQr.currentKeyVersion;
  const key = await prisma.qrKey.findUnique({
    where: { gymId_version: { gymId, version: keyVersion } },
  });
  if (!key) return null;
  return {
    staticQr,
    key,
  };
}

export async function maybeRotateQrKeyByAge(params: {
  gymId: string;
  type: QrType;
  actorId: string;
  force?: boolean;
}) {
  const staticQr = await ensureStaticQr(params.gymId, params.type, params.actorId);
  const currentKey = await prisma.qrKey.findUnique({
    where: {
      gymId_version: {
        gymId: params.gymId,
        version: staticQr.currentKeyVersion,
      },
    },
  });

  const lastRotatedAt = currentKey?.createdAt?.getTime() ?? 0;
  const due = params.force || Date.now() - lastRotatedAt >= ROTATION_INTERVAL_MS;
  if (!due) return { rotated: false, currentKeyVersion: staticQr.currentKeyVersion };

  const updated = await rotateQrKey({
    gymId: params.gymId,
    type: params.type,
    actorId: params.actorId,
  });

  logObservabilityEvent({
    event: "qr.key_rotation.auto",
    context: {
      gymId: params.gymId,
      qrType: params.type,
      previousVersion: staticQr.currentKeyVersion,
      currentVersion: updated.currentKeyVersion,
      forced: Boolean(params.force),
      intervalMs: ROTATION_INTERVAL_MS,
    },
  });

  return { rotated: true, currentKeyVersion: updated.currentKeyVersion };
}

export async function runQrSigningKeyRotationSweep(params: {
  actorId: string;
  gymId?: string | null;
  force?: boolean;
}) {
  const scope = params.gymId ? { gymId: params.gymId } : {};
  const entries = await prisma.qrStatic.findMany({
    where: {
      revokedAt: null,
      ...scope,
    },
    select: {
      gymId: true,
      type: true,
      currentKeyVersion: true,
    },
  });

  const startedAt = Date.now();
  let rotated = 0;
  for (const entry of entries) {
    const result = await maybeRotateQrKeyByAge({
      gymId: entry.gymId,
      type: entry.type as QrType,
      actorId: params.actorId,
      force: params.force,
    });
    if (result.rotated) rotated += 1;
  }

  const durationMs = Date.now() - startedAt;
  logObservabilityEvent({
    event: "qr.key_rotation.sweep",
    context: {
      actorId: params.actorId,
      gymId: params.gymId ?? null,
      total: entries.length,
      rotated,
      durationMs,
      forced: Boolean(params.force),
      intervalMs: ROTATION_INTERVAL_MS,
    },
  });

  await writeAuditLog({
    actorId: params.actorId,
    gymId: params.gymId ?? null,
    type: "QR",
    action: "KEY_ROTATION_SWEEP",
    metadata: {
      total: entries.length,
      rotated,
      durationMs,
      forced: Boolean(params.force),
    },
  });

  return { total: entries.length, rotated, durationMs };
}

export async function rotateQrKey(params: {
  gymId: string;
  type: QrType;
  actorId: string;
  revoke?: boolean;
}) {
  const staticQr = await ensureStaticQr(params.gymId, params.type, params.actorId);
  const nextVersion = staticQr.currentKeyVersion + 1;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.qrKey.create({
      data: {
        gymId: params.gymId,
        key: randomKeyMaterial(),
        version: nextVersion,
      },
    });
    return tx.qrStatic.update({
      where: { gymId_type: { gymId: params.gymId, type: params.type } },
      data: {
        currentKeyVersion: nextVersion,
        revokedAt: null,
      },
    });
  });

  await Promise.all([
    prisma.qrAuditLog.create({
      data: {
        actorId: params.actorId,
        gymId: params.gymId,
        type: "QR",
        action: params.revoke ? "REVOKE" : "REGENERATE",
      },
    }),
    writeAuditLog({
      actorId: params.actorId,
      gymId: params.gymId,
      type: "QR",
      action: params.revoke ? "REVOKE" : "REGENERATE",
      metadata: {
        qrType: params.type,
        previousVersion: staticQr.currentKeyVersion,
        currentKeyVersion: nextVersion,
        revoked: Boolean(params.revoke),
      },
    }),
  ]);

  return updated;
}

export async function getLastQrGeneration(gymId: string, type: QrType) {
  const log = await prisma.qrAuditLog.findFirst({
    where: {
      gymId,
      type: "QR",
      action: { in: ["GENERATE", "REGENERATE", "REVOKE", "BULK_GENERATE"] },
    },
    orderBy: { createdAt: "desc" },
  });
  return log?.createdAt ?? null;
}
