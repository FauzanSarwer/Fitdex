import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/permissions";
import { jsonError } from "@/lib/api";
import { logServerError } from "@/lib/logger";

export const dynamic = "force-dynamic";

type MonthRevenueRow = {
  month: string;
  revenue: bigint | number;
};

type MonthMembersRow = {
  month: string;
  members: bigint | number;
};

const toNumber = (value: number | bigint | null | undefined): number => {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  return 0;
};

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const { searchParams } = new URL(req.url);
  const gymId = searchParams.get("gymId");
  if (!gymId) {
    return jsonError("gymId required", 400);
  }

  try {
    const gym = await prisma.gym.findFirst({
      where: { id: gymId, ownerId: uid },
      select: { id: true },
    });
    if (!gym) {
      return jsonError("Gym not found", 404);
    }

    const now = new Date();
    const day = now.getDay();
    const diffToMonday = (day + 6) % 7;
    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(now.getDate() - diffToMonday);
    const startOfPrevWeek = new Date(startOfWeek);
    startOfPrevWeek.setDate(startOfWeek.getDate() - 7);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalRevenueAgg,
      estimatedRevenueAgg,
      activeMembersCount,
      totalMembersCount,
      activeDuos,
      totalLeads,
      leadsLast30Days,
      currentWeekBookings,
      previousWeekBookings,
      paymentStatusRows,
      membershipPlanRows,
      revenueByMonthRows,
      newMembersByMonthRows,
      recentPayments,
    ] = await Promise.all([
      prisma.payment.aggregate({
        where: { gymId, status: "CAPTURED" },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { gymId, paymentStatus: "PAID" },
        _sum: { totalAmount: true },
      }),
      prisma.membership.count({
        where: { gymId, active: true },
      }),
      prisma.membership.count({
        where: { gymId },
      }),
      prisma.duo.count({
        where: { gymId, active: true },
      }),
      prisma.lead.count({
        where: { gymId },
      }),
      prisma.lead.count({
        where: { gymId, createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.transaction.count({
        where: { gymId, paymentStatus: "PAID", createdAt: { gte: startOfWeek } },
      }),
      prisma.transaction.count({
        where: {
          gymId,
          paymentStatus: "PAID",
          createdAt: { gte: startOfPrevWeek, lt: startOfWeek },
        },
      }),
      prisma.payment.groupBy({
        by: ["status"],
        where: { gymId },
        _count: { _all: true },
      }),
      prisma.membership.groupBy({
        by: ["planType"],
        where: { gymId },
        _count: { _all: true },
        _sum: { finalPrice: true },
      }),
      prisma.$queryRaw<MonthRevenueRow[]>`
        SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month,
               COALESCE(SUM("amount"), 0)::bigint AS revenue
        FROM "Payment"
        WHERE "gymId" = ${gymId} AND "status" = 'CAPTURED'
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      prisma.$queryRaw<MonthMembersRow[]>`
        SELECT to_char(date_trunc('month', "startedAt"), 'YYYY-MM') AS month,
               COUNT(*)::bigint AS members
        FROM "Membership"
        WHERE "gymId" = ${gymId}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      prisma.payment.findMany({
        where: { gymId, status: "CAPTURED" },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          amount: true,
          createdAt: true,
        },
      }),
    ]);

    const totalRevenue = toNumber(totalRevenueAgg._sum.amount);
    const estimatedRevenue = toNumber(estimatedRevenueAgg._sum.totalAmount);
    const activeMembers = activeMembersCount;
    const totalMembers = totalMembersCount;
    const inactiveMembers = totalMembers - activeMembers;

    const revenueByMonth: Record<string, number> = {};
    for (const row of revenueByMonthRows) {
      revenueByMonth[row.month] = toNumber(row.revenue);
    }

    const newMembersByMonth: Record<string, number> = {};
    for (const row of newMembersByMonthRows) {
      newMembersByMonth[row.month] = toNumber(row.members);
    }

    const planDistribution: Record<string, number> = {};
    const revenueByPlan: Record<string, number> = {};
    for (const row of membershipPlanRows) {
      planDistribution[row.planType] = row._count._all;
      revenueByPlan[row.planType] = toNumber(row._sum.finalPrice);
    }

    const paymentsByStatus: Record<string, number> = {};
    for (const row of paymentStatusRows) {
      paymentsByStatus[row.status] = row._count._all;
    }

    const avgRevenuePerMember = activeMembers > 0 ? Math.round(totalRevenue / activeMembers) : 0;
    const duoRate = activeMembers > 0 ? Math.round((activeDuos / activeMembers) * 100) : 0;

    return NextResponse.json(
      {
        totalRevenue,
        estimatedRevenue,
        totalLeads,
        leadsLast30Days,
        bookingsCurrentWeek: currentWeekBookings,
        bookingsPreviousWeek: previousWeekBookings,
        revenueByMonth,
        activeMembers,
        totalMembers,
        inactiveMembers,
        newMembersByMonth,
        planDistribution,
        revenueByPlan,
        paymentsByStatus,
        avgRevenuePerMember,
        duoRate,
        activeDuos,
        payments: recentPayments,
      },
      { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=30" } }
    );
  } catch (error) {
    logServerError(error as Error, { route: "/api/owner/analytics", userId: uid });
    return jsonError("Failed to load analytics", 500);
  }
}
