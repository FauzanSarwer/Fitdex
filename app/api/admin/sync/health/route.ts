import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!requireAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Users with >1 active session
  const usersWithMultiple = (await prisma.gymSession.groupBy({
    by: ["userId"],
    where: { exitAt: null },
    _count: { _all: true },
  })).filter(g => g._count._all > 1);
  // Queue backlog: count of open sessions and weights
  const openSessions = await prisma.gymSession.count({ where: { exitAt: null } });
  const openWeights = await prisma.weightLog.count();
  // Last sync timestamps (by user)
  const lastSessions = await prisma.gymSession.findMany({
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: { userId: true, updatedAt: true },
  });
  return NextResponse.json({
    usersWithMultiple,
    openSessions,
    openWeights,
    lastSessions,
  });
}