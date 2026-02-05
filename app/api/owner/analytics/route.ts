import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/permissions";

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
    return NextResponse.json({ error: "gymId required" }, { status: 400 });
  }
  const gym = await prisma.gym.findFirst({
    where: { id: gymId, ownerId: uid },
  });
  if (!gym) {
    return NextResponse.json({ error: "Gym not found" }, { status: 404 });
  }
  const payments = await prisma.payment.findMany({
    where: { gymId, status: "CAPTURED" },
    orderBy: { createdAt: "asc" },
  });
  const totalRevenue = payments.reduce((s, p) => s + p.amount, 0);
  const byMonth: Record<string, number> = {};
  for (const p of payments) {
    const key = `${p.createdAt.getFullYear()}-${String(p.createdAt.getMonth() + 1).padStart(2, "0")}`;
    byMonth[key] = (byMonth[key] ?? 0) + p.amount;
  }
  const activeMembers = await prisma.membership.count({
    where: { gymId, active: true },
  });
  const activeDuos = await prisma.duo.count({
    where: { gymId, active: true },
  });
  return NextResponse.json({
    totalRevenue,
    revenueByMonth: byMonth,
    activeMembers,
    activeDuos,
    payments: payments.slice(-50).reverse(),
  });
}
