import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!requireAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const now = new Date();
  const PLAN_PRICES_PAISE: Record<string, number> = {
    STARTER: 1499 * 100,
    PRO: 1999 * 100,
  };

  const [pendingGyms, newGyms24h, failedPayments24h, activeSubscriptions, activeSubs, gymsByCity, gymsByTier] = await Promise.all([
    prisma.gym.count({ where: { verificationStatus: "PENDING" } }),
    prisma.gym.count({ where: { createdAt: { gte: since } } }),
    prisma.payment.count({ where: { status: "FAILED", createdAt: { gte: since } } }),
    prisma.ownerSubscription.count({ where: { status: "ACTIVE", expiresAt: { gt: now } } }),
    prisma.ownerSubscription.findMany({
      where: { status: "ACTIVE", expiresAt: { gt: now } },
      select: { ownerId: true, plan: true },
      distinct: ["ownerId"],
    }),
    prisma.gym.groupBy({
      by: ["city"],
      _count: { _all: true },
    }),
    prisma.gym.groupBy({
      by: ["gymTier"],
      _count: { _all: true },
    }),
  ]);

  const payingOwnerIds = activeSubs.map((s) => s.ownerId);
  const payingGymsCount = await prisma.gym.count({ where: { ownerId: { in: payingOwnerIds } } });
  const platformMRR = activeSubs.reduce((sum, sub) => sum + (PLAN_PRICES_PAISE[sub.plan] ?? 0), 0);

  const areaGymCounts = gymsByCity
    .map((row) => ({ city: row.city ?? "Unknown", count: row._count._all }))
    .sort((a, b) => b.count - a.count);

  const gymTierCounts = gymsByTier.reduce<Record<string, number>>((acc, row) => {
    acc[row.gymTier] = row._count._all;
    return acc;
  }, {});

  return NextResponse.json({
    pendingGyms,
    newGyms24h,
    failedPayments24h,
    activeSubscriptions,
    payingGymsCount,
    platformMRR,
    areaGymCounts,
    gymTierCounts,
    updatedAt: new Date().toISOString(),
  });
}
