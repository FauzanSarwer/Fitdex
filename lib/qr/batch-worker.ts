import { prisma } from "@/lib/prisma";
import { ensureStaticQr } from "@/lib/qr/qr-service";
import { writeAuditLog } from "@/lib/audit-log";
import { logObservabilityEvent } from "@/lib/logger";

const TYPES = ["ENTRY", "EXIT", "PAYMENT"] as const;
const runningJobs = new Set<string>();

function logBatchDuration(params: {
  level?: "info" | "warn" | "error";
  jobId: string;
  actorId: string;
  scope: string;
  status: "COMPLETE" | "FAILED";
  totalCount?: number;
  processedCount?: number;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  error?: string;
}) {
  logObservabilityEvent({
    event: "qr.batch.duration",
    level: params.level,
    context: {
      jobId: params.jobId,
      actorId: params.actorId,
      scope: params.scope,
      status: params.status,
      totalCount: params.totalCount ?? null,
      processedCount: params.processedCount ?? null,
      startedAt: params.startedAt,
      completedAt: params.completedAt,
      durationMs: params.durationMs,
      error: params.error ?? null,
    },
  });
}

export function isQrBatchRunning(jobId: string) {
  return runningJobs.has(jobId);
}

export function enqueueQrBatchJob(jobId: string) {
  if (runningJobs.has(jobId)) return;
  runningJobs.add(jobId);
  void runQrBatchJob(jobId).finally(() => {
    runningJobs.delete(jobId);
  });
}

async function runQrBatchJob(jobId: string) {
  const job = await prisma.qrBatchJob.findUnique({ where: { id: jobId } });
  if (!job) return;
  const startedAtMs = Date.now();
  const startedAtIso = new Date(startedAtMs).toISOString();

  try {
    const gyms =
      job.scope === "GYM" && job.gymId
        ? await prisma.gym.findMany({ where: { id: job.gymId }, select: { id: true } })
        : await prisma.gym.findMany({ select: { id: true } });

    await prisma.qrBatchJob.update({
      where: { id: jobId },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        totalCount: gyms.length,
        processedCount: 0,
        error: null,
      },
    });

    let processed = 0;
    for (const gym of gyms) {
      for (const type of TYPES) {
        await ensureStaticQr(gym.id, type, job.actorId);
      }
      await prisma.qrAuditLog.create({
        data: {
          actorId: job.actorId,
          gymId: gym.id,
          type: "QR",
          action: "BULK_GENERATE",
        },
      });

      processed += 1;
      await prisma.qrBatchJob.update({
        where: { id: jobId },
        data: { processedCount: processed },
      });
    }

    await prisma.qrBatchJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETE",
        processedCount: processed,
        completedAt: new Date(),
        downloadUrl: `/api/admin/qr/batch/${jobId}/download`,
      },
    });

    await writeAuditLog({
      actorId: job.actorId,
      gymId: job.gymId,
      type: "QR_BATCH",
      action: "BULK_GENERATE_COMPLETE",
      metadata: {
        jobId,
        scope: job.scope,
        totalCount: gyms.length,
      },
    });
    const completedAtIso = new Date().toISOString();
    logBatchDuration({
      jobId,
      actorId: job.actorId,
      scope: job.scope,
      status: "COMPLETE",
      totalCount: gyms.length,
      processedCount: processed,
      startedAt: startedAtIso,
      completedAt: completedAtIso,
      durationMs: Date.now() - startedAtMs,
    });
  } catch (error) {
    await prisma.qrBatchJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        error: error instanceof Error ? error.message.slice(0, 500) : "Unknown error",
        completedAt: new Date(),
      },
    });
    const completedAtIso = new Date().toISOString();
    logBatchDuration({
      level: "error",
      jobId,
      actorId: job.actorId,
      scope: job.scope,
      status: "FAILED",
      startedAt: startedAtIso,
      completedAt: completedAtIso,
      durationMs: Date.now() - startedAtMs,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
