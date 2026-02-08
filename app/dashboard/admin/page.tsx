import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buildGymSlug, formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const session = await getServerSession(authOptions);
  if (!requireAdmin(session)) {
    redirect("/dashboard");
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const now = new Date();
  const PLAN_PRICES_PAISE: Record<string, number> = {
    STARTER: 1499 * 100,
    PRO: 1999 * 100,
  };

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
    newGyms24h,
    failedPayments24h,
    activeSubscriptions,
    activeSubs,
    gymsByCity,
    gymsByTier,
    payoutsPending,
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
    prisma.transaction.count({
      where: {
        paymentStatus: "PAID",
        settlementStatus: { not: "COMPLETED" },
      },
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

  const totalRevenue = transactionAgg._sum.totalAmount ?? 0;
  const totalCommission = transactionAgg._sum.platformCommissionAmount ?? 0;
  const totalPayouts = transactionAgg._sum.gymPayoutAmount ?? 0;

  const priorityTone = (value: number, tone: "amber" | "red") => {
    if (value > 0) {
      return tone === "red"
        ? "border-red-500/40 bg-red-500/10 text-red-200"
        : "border-amber-500/40 bg-amber-500/10 text-amber-200";
    }
    return "border-white/10 bg-white/5 text-muted-foreground";
  };

  const queueBadge = (value: number) =>
    value > 0
      ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
      : "border-white/10 bg-white/5 text-muted-foreground";

  const queueLabel = (value: number) => (value === 0 ? "None pending" : `${value} pending`);

  const renderCount = (value: number, zeroLabel: string) =>
    value === 0 ? (
      <span className="text-sm text-muted-foreground">{zeroLabel}</span>
    ) : (
      <span className="text-3xl font-semibold">{value}</span>
    );

  const renderMoney = (value: number, zeroLabel: string) =>
    value === 0 ? (
      <span className="text-sm text-muted-foreground">{zeroLabel}</span>
    ) : (
      <span className="text-2xl font-semibold">{formatPrice(value)}</span>
    );

  return (
    <div className="p-6 space-y-10">
      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Link
              href="/dashboard/admin/verification"
              className={`rounded-lg border p-4 ${priorityTone(pendingGyms, "amber")}`}
            >
              <div className="text-xs uppercase tracking-wide">Pending verifications</div>
              <div className="mt-2 text-3xl font-semibold">
                {pendingGyms === 0 ? "No pending" : pendingGyms}
              </div>
            </Link>
            <Link
              href="/dashboard/admin/payments"
              className={`rounded-lg border p-4 ${priorityTone(failedPayments24h, "red")}`}
            >
              <div className="text-xs uppercase tracking-wide">Failed payments (24h)</div>
              <div className="mt-2 text-3xl font-semibold">
                {failedPayments24h === 0 ? "All clear" : failedPayments24h}
              </div>
            </Link>
            <Link
              href="/dashboard/admin/transactions"
              className={`rounded-lg border p-4 ${priorityTone(payoutsPending, "amber")}`}
            >
              <div className="text-xs uppercase tracking-wide">Payouts pending</div>
              <div className="mt-2 text-3xl font-semibold">
                {payoutsPending === 0 ? "No pending" : payoutsPending}
              </div>
            </Link>
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Admin command center</h1>
          <p className="text-sm text-muted-foreground">
            Real-time platform health, revenue, and operational visibility.
          </p>
        </div>
      </div>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Platform Health</h2>
          <p className="text-sm text-muted-foreground">
            New supply, verification flow, and subscription health.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border border-white/10 bg-white/5 shadow-none">
            <CardHeader>
              <CardTitle>New gyms (24h)</CardTitle>
            </CardHeader>
            <CardContent>{renderCount(newGyms24h, "No activity yet today")}</CardContent>
          </Card>
          <Card className="border border-white/10 bg-white/5 shadow-none">
            <CardHeader>
              <CardTitle>Pending gyms</CardTitle>
            </CardHeader>
            <CardContent>{renderCount(pendingGyms, "No verifications pending")}</CardContent>
          </Card>
          <Card className="border border-white/10 bg-white/5 shadow-none">
            <CardHeader>
              <CardTitle>Verified gyms</CardTitle>
            </CardHeader>
            <CardContent>{renderCount(verifiedGyms, "No gyms verified yet")}</CardContent>
          </Card>
          <Card className="border border-white/10 bg-white/5 shadow-none">
            <CardHeader>
              <CardTitle>Active subscriptions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {renderCount(activeSubscriptions, "No active subscriptions")}
              <div className="text-xs text-muted-foreground">
                {payingGymsCount === 0 ? "Paying gyms: none" : `Paying gyms: ${payingGymsCount}`}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Money Flow</h2>
          <p className="text-sm text-muted-foreground">Revenue, commission, and payouts at a glance.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border border-white/10 bg-white/5 shadow-none">
            <CardHeader>
              <CardTitle>Platform MRR</CardTitle>
            </CardHeader>
            <CardContent>{renderMoney(platformMRR, "No recurring revenue yet")}</CardContent>
          </Card>
          <Card className="border border-white/10 bg-white/5 shadow-none">
            <CardHeader>
              <CardTitle>Revenue (gross)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {renderMoney(totalRevenue, "No revenue yet")}
              <div className="text-xs text-muted-foreground">
                {paymentCount === 0 ? "No payments logged" : `Payments logged: ${paymentCount}`}
              </div>
            </CardContent>
          </Card>
          <Card className="border border-white/10 bg-white/5 shadow-none">
            <CardHeader>
              <CardTitle>Platform commission</CardTitle>
            </CardHeader>
            <CardContent>{renderMoney(totalCommission, "No commission yet")}</CardContent>
          </Card>
          <Card className="border border-white/10 bg-white/5 shadow-none">
            <CardHeader>
              <CardTitle>Gym payouts</CardTitle>
            </CardHeader>
            <CardContent>{renderMoney(totalPayouts, "No payouts yet")}</CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Network Activity</h2>
          <p className="text-sm text-muted-foreground">Demand-side usage and marketplace scale.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border border-white/10 bg-white/5 shadow-none">
            <CardHeader>
              <CardTitle>Total users</CardTitle>
            </CardHeader>
            <CardContent>{renderCount(userCount, "No users yet")}</CardContent>
          </Card>
          <Card className="border border-white/10 bg-white/5 shadow-none">
            <CardHeader>
              <CardTitle>Total gyms</CardTitle>
            </CardHeader>
            <CardContent>{renderCount(gymCount, "No gyms yet")}</CardContent>
          </Card>
          <Card className="border border-white/10 bg-white/5 shadow-none">
            <CardHeader>
              <CardTitle>Memberships</CardTitle>
            </CardHeader>
            <CardContent>{renderCount(membershipCount, "No memberships yet")}</CardContent>
          </Card>
          <Card className="border border-white/10 bg-white/5 shadow-none">
            <CardHeader>
              <CardTitle>Active duos</CardTitle>
            </CardHeader>
            <CardContent>{renderCount(activeDuoCount, "No active duos")}</CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border border-white/10 bg-white/5 shadow-none">
            <CardHeader>
              <CardTitle>Area-wise gym count</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {areaGymCounts.length === 0 ? (
                <span>No location data yet.</span>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 font-medium">City</th>
                      <th className="py-2 text-right font-medium">Gyms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {areaGymCounts.slice(0, 6).map((row) => (
                      <tr key={row.city} className="border-t border-white/10">
                        <td className="py-2">{row.city}</td>
                        <td className="py-2 text-right text-foreground">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
          <Card className="border border-white/10 bg-white/5 shadow-none">
            <CardHeader>
              <CardTitle>Gym tier distribution</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {Object.keys(gymTierCounts).length === 0 ? (
                <span>No tier data yet.</span>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 font-medium">Tier</th>
                      <th className="py-2 text-right font-medium">Gyms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(gymTierCounts).map(([tier, count]) => (
                      <tr key={tier} className="border-t border-white/10">
                        <td className="py-2">{tier}</td>
                        <td className="py-2 text-right text-foreground">{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Operations & Queues</h2>
          <p className="text-sm text-muted-foreground">What needs attention right now.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="border border-white/10 bg-white/5 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Verification queue</span>
                <span className={`rounded-full border px-2 py-0.5 text-xs ${queueBadge(pendingGyms)}`}>
                  {queueLabel(pendingGyms)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Review gyms waiting for approval and unlock memberships.
              </p>
              <Button asChild>
                <Link href="/dashboard/admin/verification">Review gyms</Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="border border-white/10 bg-white/5 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Failed payments</span>
                <span className={`rounded-full border px-2 py-0.5 text-xs ${queueBadge(failedPayments24h)}`}>
                  {queueLabel(failedPayments24h)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Resolve failures from the last 24 hours.</p>
              <Button variant="secondary" asChild>
                <Link href="/dashboard/admin/payments">View failures</Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="border border-white/10 bg-white/5 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Payouts pending</span>
                <span className={`rounded-full border px-2 py-0.5 text-xs ${queueBadge(payoutsPending)}`}>
                  {queueLabel(payoutsPending)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Check settlements waiting to complete.</p>
              <Button variant="secondary" asChild>
                <Link href="/dashboard/admin/transactions">View payouts</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border border-white/10 bg-white/5 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent transactions</CardTitle>
              <Link href="/dashboard/admin/transactions" className="text-xs text-muted-foreground">
                View all
              </Link>
            </CardHeader>
            <CardContent className="text-sm">
              {recentTransactions.length === 0 ? (
                <p className="text-muted-foreground">No transactions yet.</p>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="py-2 font-medium">Gym</th>
                        <th className="py-2 font-medium">Member</th>
                        <th className="py-2 text-right font-medium">Amount</th>
                        <th className="py-2 text-right font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentTransactions.map((tx) => (
                        <tr key={tx.id} className="border-t border-white/10">
                          <td className="py-2">
                            <div className="font-medium">{tx.gym?.name ?? "Gym"}</div>
                            <div className="text-xs text-muted-foreground">{tx.paymentStatus}</div>
                          </td>
                          <td className="py-2 text-xs text-muted-foreground">
                            {tx.user?.name ?? tx.user?.email}
                          </td>
                          <td className="py-2 text-right font-medium">{formatPrice(tx.totalAmount)}</td>
                          <td className="py-2 text-right">
                            <Link href="/dashboard/admin/transactions" className="text-xs text-primary">
                              Review
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-white/10 bg-white/5 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent gyms</CardTitle>
              <Link href="/dashboard/admin/gyms" className="text-xs text-muted-foreground">
                View all
              </Link>
            </CardHeader>
            <CardContent className="text-sm">
              {recentGyms.length === 0 ? (
                <p className="text-muted-foreground">No gyms yet.</p>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="py-2 font-medium">Gym</th>
                        <th className="py-2 font-medium">Owner</th>
                        <th className="py-2 text-right font-medium">Status</th>
                        <th className="py-2 text-right font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentGyms.map((gym) => (
                        <tr key={gym.id} className="border-t border-white/10">
                          <td className="py-2">
                            <div className="font-medium">{gym.name}</div>
                            <div className="text-xs text-muted-foreground">ID: {gym.id}</div>
                          </td>
                          <td className="py-2 text-xs text-muted-foreground">
                            {gym.owner?.name ?? gym.owner?.email}
                          </td>
                          <td className="py-2 text-right text-xs text-muted-foreground">
                            {gym.verificationStatus}
                          </td>
                          <td className="py-2 text-right">
                            <Link
                              href={`/explore/${buildGymSlug(gym.name, gym.id)}`}
                              className="text-xs text-primary"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
