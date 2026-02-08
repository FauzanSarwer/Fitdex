import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/permissions";
import { jsonError } from "@/lib/api";
import { logServerError } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const { searchParams } = new URL(req.url);
  const gymId = searchParams.get("gymId");
  if (!gymId) return jsonError("gymId required", 400);

  try {
    const gym = await prisma.gym.findFirst({ where: { id: gymId, ownerId: uid } });
    if (!gym) return jsonError("Gym not found", 404);

    const transactions = await prisma.transaction.findMany({
      where: { gymId, paymentStatus: "PAID" },
      orderBy: { createdAt: "asc" },
      select: {
        createdAt: true,
        totalAmount: true,
        platformCommissionAmount: true,
      },
    });

    const byMonth: Record<string, { bookings: number; totalAmount: number; commission: number }> = {};
    for (const t of transactions) {
      const key = `${t.createdAt.getFullYear()}-${String(t.createdAt.getMonth() + 1).padStart(2, "0")}`;
      const entry = byMonth[key] ?? { bookings: 0, totalAmount: 0, commission: 0 };
      entry.bookings += 1;
      entry.totalAmount += t.totalAmount;
      entry.commission += t.platformCommissionAmount;
      byMonth[key] = entry;
    }

    const report = Object.entries(byMonth)
      .map(([month, data]) => ({
        month,
        totalBookings: data.bookings,
        totalCommission: data.commission,
        commissionPercent: data.totalAmount > 0 ? Math.round((data.commission / data.totalAmount) * 10000) / 100 : 0,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return NextResponse.json({ report });
  } catch (error) {
    logServerError(error as Error, { route: "/api/owner/commission-report", userId: uid });
    return jsonError("Failed to load commission report", 500);
  }
}
