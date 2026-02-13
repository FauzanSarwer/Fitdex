import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/permissions";
import { jsonError } from "@/lib/api";
import { logServerError } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  try {
    const gyms = await prisma.gym.findMany({
      where: { ownerId: uid },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    });
    const gymIds = gyms.map((g) => g.id);
    if (gymIds.length === 0) {
      return NextResponse.json(
        { leads: [] },
        { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=30" } }
      );
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [total, last30] = await Promise.all([
      prisma.lead.groupBy({
        by: ["gymId"],
        where: { gymId: { in: gymIds } },
        _count: { _all: true },
      }),
      prisma.lead.groupBy({
        by: ["gymId"],
        where: { gymId: { in: gymIds }, createdAt: { gte: thirtyDaysAgo } },
        _count: { _all: true },
      }),
    ]);

    const totalMap = new Map(total.map((row) => [row.gymId, row._count._all]));
    const last30Map = new Map(last30.map((row) => [row.gymId, row._count._all]));

    const result = gyms.map((g) => ({
      gymId: g.id,
      gymName: g.name,
      totalLeads: totalMap.get(g.id) ?? 0,
      leadsLast30Days: last30Map.get(g.id) ?? 0,
    }));

    return NextResponse.json(
      { leads: result },
      { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=30" } }
    );
  } catch (error) {
    logServerError(error as Error, { route: "/api/owner/leads", userId: uid });
    return jsonError("Failed to load leads", 500);
  }
}
