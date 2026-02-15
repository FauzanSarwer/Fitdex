import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonError, safeJson } from "@/lib/api";
import { requireSuperAdmin } from "@/lib/permissions";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireSuperAdmin(session)) return jsonError("Unauthorized", 401);

  const parsed = await safeJson<{ jobId?: string }>(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const { jobId } = parsed.data;
  if (!jobId) return jsonError("jobId required", 400);

  const job = await prisma.qrBatchJob.findUnique({ where: { id: jobId } });
  if (!job) return jsonError("Batch not found", 404);

  const gyms = job.scope === "GYM" && job.gymId
    ? await prisma.gym.findMany({ where: { id: job.gymId } })
    : await prisma.gym.findMany({ select: { id: true } });

  await prisma.qrBatchJob.update({
    where: { id: jobId },
    data: {
      status: "RUNNING",
      totalCount: gyms.length,
      processedCount: 0,
    },
  });

  return NextResponse.json({ ok: true, totalCount: gyms.length });
}
