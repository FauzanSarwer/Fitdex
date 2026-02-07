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

  const [pendingGyms, newGyms24h, failedPayments24h, activeSubscriptions] = await Promise.all([
    prisma.gym.count({ where: { verificationStatus: "PENDING" } }),
    prisma.gym.count({ where: { createdAt: { gte: since } } }),
    prisma.payment.count({ where: { status: "FAILED", createdAt: { gte: since } } }),
    prisma.ownerSubscription.count({ where: { status: "ACTIVE", expiresAt: { gt: new Date() } } }),
  ]);

  return NextResponse.json({
    pendingGyms,
    newGyms24h,
    failedPayments24h,
    activeSubscriptions,
    updatedAt: new Date().toISOString(),
  });
}
