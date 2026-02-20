import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonError, safeJson } from "@/lib/api";
import { requireSuperAdmin } from "@/lib/permissions";
import { enqueueQrBatchJob, isQrBatchRunning } from "@/lib/qr/batch-worker";
import { writeAuditLog } from "@/lib/audit-log";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireSuperAdmin(session)) return jsonError("Unauthorized", 401);

  const parsed = await safeJson<{ jobId?: string }>(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const { jobId } = parsed.data;
  if (!jobId) return jsonError("jobId required", 400);

  const job = await prisma.qrBatchJob.findUnique({ where: { id: jobId } });
  if (!job) return jsonError("Batch not found", 404);
  if (isQrBatchRunning(jobId)) {
    return NextResponse.json({ ok: true, started: false, status: "RUNNING" });
  }

  enqueueQrBatchJob(jobId);
  await writeAuditLog({
    actorId: (session!.user as { id: string }).id,
    gymId: job.gymId,
    type: "QR_BATCH",
    action: "BULK_GENERATE_STARTED",
    metadata: { jobId, scope: job.scope },
  });

  return NextResponse.json({ ok: true, started: true, status: "RUNNING" }, { status: 202 });
}
