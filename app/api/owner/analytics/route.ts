import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/permissions";
import { jsonError } from "@/lib/api";
import { logServerError } from "@/lib/logger";

export const dynamic = 'force-dynamic';

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
    });
    if (!gym) {
      return jsonError("Gym not found", 404);
    }
    const payments = await prisma.payment.findMany({
      where: { gymId, status: "CAPTURED" },
      orderBy: { createdAt: "asc" },
    });
    const allPayments = await prisma.payment.findMany({
      where: { gymId },
      orderBy: { createdAt: "asc" },
    });
    const memberships = await prisma.membership.findMany({
      where: { gymId },
      orderBy: { startedAt: "asc" },
    });
    const leads = await prisma.lead.findMany({
      where: { gymId },
      orderBy: { createdAt: "asc" },
    });
    const paidTransactions = await prisma.transaction.findMany({
      where: { gymId, paymentStatus: "PAID" },
      orderBy: { createdAt: "asc" },
    });
    const totalRevenue = payments.reduce((s, p) => s + p.amount, 0);
    const estimatedRevenue = paidTransactions.reduce((s, t) => s + t.totalAmount, 0);
    const byMonth: Record<string, number> = {};
    for (const p of payments) {
      const key = `${p.createdAt.getFullYear()}-${String(p.createdAt.getMonth() + 1).padStart(2, "0")}`;
      byMonth[key] = (byMonth[key] ?? 0) + p.amount;
    }
    const activeMembers = memberships.filter((m) => m.active).length;
    const totalMembers = memberships.length;
    const inactiveMembers = totalMembers - activeMembers;
    const newMembersByMonth: Record<string, number> = {};
    for (const m of memberships) {
      const key = `${m.startedAt.getFullYear()}-${String(m.startedAt.getMonth() + 1).padStart(2, "0")}`;
      newMembersByMonth[key] = (newMembersByMonth[key] ?? 0) + 1;
    }
    const planDistribution = memberships.reduce<Record<string, number>>((acc, m) => {
      acc[m.planType] = (acc[m.planType] ?? 0) + 1;
      return acc;
    }, {});
    const revenueByPlan = memberships.reduce<Record<string, number>>((acc, m) => {
      acc[m.planType] = (acc[m.planType] ?? 0) + m.finalPrice;
      return acc;
    }, {});
    const paymentsByStatus = allPayments.reduce<Record<string, number>>((acc, p) => {
      acc[p.status] = (acc[p.status] ?? 0) + 1;
      return acc;
    }, {});
    const activeDuos = await prisma.duo.count({
      where: { gymId, active: true },
    });
    const avgRevenuePerMember = activeMembers > 0 ? Math.round(totalRevenue / activeMembers) : 0;
    const duoRate = activeMembers > 0 ? Math.round((activeDuos / activeMembers) * 100) : 0;

    const now = new Date();
    const day = now.getDay();
    const diffToMonday = (day + 6) % 7;
    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(now.getDate() - diffToMonday);
    const startOfPrevWeek = new Date(startOfWeek);
    startOfPrevWeek.setDate(startOfWeek.getDate() - 7);

    const currentWeekBookings = paidTransactions.filter((t) => t.createdAt >= startOfWeek).length;
    const previousWeekBookings = paidTransactions.filter(
      (t) => t.createdAt >= startOfPrevWeek && t.createdAt < startOfWeek
    ).length;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const totalLeads = leads.length;
    const leadsLast30Days = leads.filter((l) => l.createdAt >= thirtyDaysAgo).length;
    return NextResponse.json({
      totalRevenue,
      estimatedRevenue,
      totalLeads,
      leadsLast30Days,
      bookingsCurrentWeek: currentWeekBookings,
      bookingsPreviousWeek: previousWeekBookings,
      revenueByMonth: byMonth,
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
      payments: payments.slice(-50).reverse(),
    });
  } catch (error) {
    logServerError(error as Error, { route: "/api/owner/analytics", userId: uid });
    return jsonError("Failed to load analytics", 500);
  }
}
