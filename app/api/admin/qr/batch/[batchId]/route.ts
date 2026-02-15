import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api";
import { requireSuperAdmin } from "@/lib/permissions";

export async function GET(_req: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!requireSuperAdmin(session)) return jsonError("Unauthorized", 401);

  const { batchId } = await params;
  const job = await prisma.qrBatchJob.findUnique({ where: { id: batchId } });
  if (!job) return jsonError("Batch not found", 404);

  return NextResponse.json({ ok: true, job });
}
