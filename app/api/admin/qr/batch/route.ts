import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonError, safeJson } from "@/lib/api";
import { requireSuperAdmin } from "@/lib/permissions";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!requireSuperAdmin(session)) return jsonError("Unauthorized", 401);

  const jobs = await prisma.qrBatchJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ ok: true, jobs });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireSuperAdmin(session)) return jsonError("Unauthorized", 401);

  const parsed = await safeJson<{ scope?: "ALL_GYMS" | "GYM"; gymId?: string }>(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);

  const { scope = "ALL_GYMS", gymId } = parsed.data;
  if (scope === "GYM" && !gymId) return jsonError("gymId required", 400);

  const uid = (session!.user as { id: string }).id;
  const job = await prisma.qrBatchJob.create({
    data: {
      actorId: uid,
      scope,
      gymId: scope === "GYM" ? gymId ?? null : null,
      status: "PENDING",
      totalCount: 0,
      processedCount: 0,
    },
  });

  return NextResponse.json({ ok: true, jobId: job.id });
}
