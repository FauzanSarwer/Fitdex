import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";
import { RealtimeAdminMetrics } from "@/components/admin/realtime-metrics";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const session = await getServerSession(authOptions);
  if (!requireAdmin(session)) {
    redirect("/dashboard");
  }

  const [
    userCount,
    gymCount,
    pendingGyms,
    verifiedGyms,
    membershipCount,
    activeDuoCount,
    paymentCount,
    transactionAgg,
    recentTransactions,
    recentGyms,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.gym.count(),
    prisma.gym.count({ where: { verificationStatus: "PENDING" } }),
    prisma.gym.count({ where: { verificationStatus: "VERIFIED" } }),
    prisma.membership.count(),
    prisma.duo.count({ where: { active: true } }),
    prisma.payment.count(),
    prisma.transaction.aggregate({
      _sum: { totalAmount: true, platformCommissionAmount: true, gymPayoutAmount: true },
    }),
    prisma.transaction.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: {
        gym: { select: { name: true } },
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.gym.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: { owner: { select: { name: true, email: true } } },
    }),
  ]);

  const totalRevenue = transactionAgg._sum.totalAmount ?? 0;
  const totalCommission = transactionAgg._sum.platformCommissionAmount ?? 0;
  const totalPayouts = transactionAgg._sum.gymPayoutAmount ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Admin command center</h1>
        <p className="text-sm text-muted-foreground">
          Real-time platform health, revenue, and operational visibility.
        </p>
      </div>

      <RealtimeAdminMetrics />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Total users</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{userCount}</CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Total gyms</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{gymCount}</CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Pending verification</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{pendingGyms}</CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Verified gyms</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{verifiedGyms}</CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Memberships</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{membershipCount}</CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Active duos</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{activeDuoCount}</CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Payments</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{paymentCount}</CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Revenue (gross)</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatPrice(totalRevenue)}</CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Platform commission</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatPrice(totalCommission)}</CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Gym payouts</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatPrice(totalPayouts)}</CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Verification queue</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/admin/verification" className="text-sm text-primary hover:underline">
              Review {pendingGyms} pending gyms
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Recent transactions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {recentTransactions.length === 0 ? (
              <p className="text-muted-foreground">No transactions yet.</p>
            ) : (
              recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between border-b border-white/10 pb-2 last:border-0">
                  <div>
                    <div className="font-semibold">{tx.gym?.name ?? "Gym"}</div>
                    <div className="text-xs text-muted-foreground">{tx.user?.name ?? tx.user?.email}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatPrice(tx.totalAmount)}</div>
                    <div className="text-xs text-muted-foreground">{tx.paymentStatus}</div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Recent gyms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {recentGyms.length === 0 ? (
              <p className="text-muted-foreground">No gyms yet.</p>
            ) : (
              recentGyms.map((gym) => (
                <div key={gym.id} className="flex items-center justify-between border-b border-white/10 pb-2 last:border-0">
                  <div>
                    <div className="font-semibold">{gym.name}</div>
                    <div className="text-xs text-muted-foreground">{gym.owner?.name ?? gym.owner?.email}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{gym.verificationStatus}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
