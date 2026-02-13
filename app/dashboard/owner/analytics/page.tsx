"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPrice } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";
import { fetchJson } from "@/lib/client-fetch";
import { runWhenIdle } from "@/lib/browser-idle";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type GymOption = {
  id: string;
  name: string;
};

type CommissionRow = {
  month: string;
  totalBookings: number;
  totalCommission: number;
  commissionPercent: number;
};

type AnalyticsData = {
  totalRevenue: number;
  estimatedRevenue: number;
  totalLeads: number;
  leadsLast30Days: number;
  bookingsCurrentWeek: number;
  bookingsPreviousWeek: number;
  revenueByMonth: Record<string, number>;
  activeMembers: number;
  totalMembers: number;
  inactiveMembers: number;
  newMembersByMonth: Record<string, number>;
  planDistribution: Record<string, number>;
  revenueByPlan: Record<string, number>;
  paymentsByStatus: Record<string, number>;
  avgRevenuePerMember: number;
  duoRate: number;
  activeDuos: number;
  payments: Array<{ amount: number; createdAt: string }>;
};

const CHART_TOOLTIP_STYLE = { background: "hsl(var(--card))", border: "1px solid rgba(255,255,255,0.1)" };

export default function OwnerAnalyticsPage() {
  const searchParams = useSearchParams();
  const [gyms, setGyms] = useState<GymOption[]>([]);
  const [selectedGymId, setSelectedGymId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [commissionReport, setCommissionReport] = useState<CommissionRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchJson<{ gyms?: GymOption[]; error?: string }>("/api/owner/gym?compact=1", {
      retries: 1,
      useCache: true,
      cacheKey: "owner-gyms-compact",
      cacheTtlMs: 30000,
    })
      .then((result) => {
        if (!active) return;
        if (!result.ok) {
          throw new Error(result.error ?? "Failed to load gyms");
        }
        const list = result.data?.gyms ?? [];
        setGyms(list);
        const q = searchParams.get("gymId");
        if (q && list.some((g) => g.id === q)) setSelectedGymId(q);
        else if (list.length > 0) setSelectedGymId(list[0].id);
        else setSelectedGymId("");
      })
      .catch((e: unknown) => {
        if (!active) return;
        setGyms([]);
        setSelectedGymId("");
        setError(e instanceof Error ? e.message : "Failed to load gyms");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [searchParams]);

  useEffect(() => {
    if (!selectedGymId) {
      setData(null);
      setCommissionReport([]);
      return;
    }
    let active = true;
    setAnalyticsLoading(true);
    fetchJson<AnalyticsData>(`/api/owner/analytics?gymId=${selectedGymId}`, {
      retries: 1,
      useCache: true,
      cacheKey: `owner-analytics:${selectedGymId}`,
      cacheTtlMs: 20000,
    })
      .then((result) => {
        if (!active) return;
        if (!result.ok) {
          throw new Error(result.error ?? "Failed to load analytics");
        }
        setData(result.data ?? null);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setData(null);
        setError(e instanceof Error ? e.message : "Failed to load analytics");
      })
      .finally(() => {
        if (active) setAnalyticsLoading(false);
      });

    const loadCommission = () => {
      setReportLoading(true);
      fetchJson<{ report?: CommissionRow[]; error?: string }>(
        `/api/owner/commission-report?gymId=${selectedGymId}`,
        {
          retries: 1,
          useCache: true,
          cacheKey: `owner-commission:${selectedGymId}`,
          cacheTtlMs: 20000,
        }
      )
        .then((result) => {
          if (!active) return;
          if (!result.ok) {
            setCommissionReport([]);
            return;
          }
          setCommissionReport(result.data?.report ?? []);
        })
        .catch(() => {
          if (!active) return;
          setCommissionReport([]);
        })
        .finally(() => {
          if (active) setReportLoading(false);
        });
    };

    const cancelIdle = runWhenIdle(loadCommission);

    return () => {
      active = false;
      cancelIdle();
    };
  }, [selectedGymId]);

  if (loading) {
    return (
      <div className="p-6">
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (error && gyms.length === 0) {
    return (
      <div className="p-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Unable to load analytics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{error}</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild>
                <Link href="/dashboard/owner/gym">Add your first gym</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/auth/login?callbackUrl=/dashboard/owner/analytics">Re-authenticate</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const chartData = useMemo(
    () =>
      data?.revenueByMonth
        ? Object.entries(data.revenueByMonth)
            .map(([month, value]) => ({ month, revenue: value / 100 }))
            .sort((a, b) => a.month.localeCompare(b.month))
        : [],
    [data?.revenueByMonth]
  );

  const membersData = useMemo(
    () =>
      data?.newMembersByMonth
        ? Object.entries(data.newMembersByMonth)
            .map(([month, value]) => ({ month, members: value }))
            .sort((a, b) => a.month.localeCompare(b.month))
        : [],
    [data?.newMembersByMonth]
  );
  const emptyCopy = "No data yet — go live to start tracking analytics.";
  const growthSignal = membersData.at(-1)?.members ?? 0;

  return (
    <div className="p-6 space-y-10">
      <div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Analytics
          </h1>
          {selectedGymId && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/api/owner/analytics/export?gymId=${selectedGymId}`}>Export CSV</Link>
            </Button>
          )}
        </div>
        <p className="text-muted-foreground text-sm">A calm overview of revenue and member performance.</p>
      </div>

      {gyms.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Gym:</span>
          <Select value={selectedGymId} onValueChange={setSelectedGymId}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {gyms.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!analyticsLoading && error && gyms.length > 0 && (
        <Card className="glass-card">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      )}

      {analyticsLoading && (
        <Card className="glass-card">
          <CardContent className="p-6">
            <Skeleton className="h-32" />
          </CardContent>
        </Card>
      )}

      {!analyticsLoading && !data && gyms.length === 0 && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>No gyms found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Add a gym to unlock analytics.</p>
            <Button asChild>
              <Link href="/dashboard/owner/gym">Add your first gym</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {!analyticsLoading && data && (
        <>
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Revenue</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="glass-card md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Total revenue</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-3xl font-semibold text-primary">
                    {data.totalRevenue > 0 ? formatPrice(data.totalRevenue) : "—"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {data.totalRevenue > 0 ? "Captured payments" : emptyCopy}
                  </p>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-base">Estimated revenue</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-2xl font-semibold text-primary">
                    {data.estimatedRevenue > 0 ? formatPrice(data.estimatedRevenue) : "—"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {data.estimatedRevenue > 0 ? "Derived from paid bookings" : emptyCopy}
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Members & Engagement</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="glass-card md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Active members</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-3xl font-semibold text-primary">
                    {data.activeMembers > 0 ? data.activeMembers : "—"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {data.activeMembers > 0 ? `Total members: ${data.totalMembers}` : emptyCopy}
                  </p>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-base">Bookings this week</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-2xl font-semibold text-primary">
                    {data.bookingsCurrentWeek > 0 ? data.bookingsCurrentWeek : "—"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {data.bookingsCurrentWeek > 0 || data.bookingsPreviousWeek > 0
                      ? `Previous week: ${data.bookingsPreviousWeek}`
                      : emptyCopy}
                  </p>
                </CardContent>
              </Card>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-base">Leads (last 30 days)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-2xl font-semibold text-primary">
                    {data.leadsLast30Days > 0 ? data.leadsLast30Days : "—"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {data.leadsLast30Days > 0 ? `Total leads: ${data.totalLeads}` : emptyCopy}
                  </p>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-base">Estimated revenue (context)</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Estimated values are derived from paid booking totals and are not guaranteed revenue.
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Business Health</h2>
            <Card className="glass-card">
              <CardContent className="space-y-6 pt-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Total members (lifetime)</div>
                    <div className="text-2xl font-semibold">
                      {data.totalMembers > 0 ? data.totalMembers : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {data.totalMembers > 0 ? `Inactive: ${data.inactiveMembers}` : emptyCopy}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Active duos</div>
                    <div className="text-2xl font-semibold">
                      {data.activeDuos > 0 ? data.activeDuos : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {data.activeDuos > 0 ? "Pair memberships currently active" : emptyCopy}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Monthly commission report</div>
                    <div className="text-xs text-muted-foreground">
                      {commissionReport.length > 0 ? "Latest three months" : emptyCopy}
                    </div>
                  </div>
                </div>

                <div>
                  {reportLoading ? (
                    <Skeleton className="h-24" />
                  ) : commissionReport.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{emptyCopy}</p>
                  ) : (
                    <div className="overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="text-left text-xs text-muted-foreground">
                          <tr>
                            <th className="py-2">Month</th>
                            <th className="py-2">Bookings</th>
                            <th className="py-2">Commission</th>
                            <th className="py-2">Commission %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {commissionReport.map((row) => (
                            <tr key={row.month} className="border-t border-white/10">
                              <td className="py-2">{row.month}</td>
                              <td className="py-2">{row.totalBookings}</td>
                              <td className="py-2">{formatPrice(row.totalCommission)}</td>
                              <td className="py-2">{row.commissionPercent}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">🔒 Advanced Analytics (Locked)</h2>
            <div className="relative">
              <div className="pointer-events-none select-none blur-sm opacity-60 space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle className="text-sm">Growth signal</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold">{growthSignal}</div>
                      <div className="text-xs text-muted-foreground">New members this month</div>
                    </CardContent>
                  </Card>
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle className="text-sm">Duo rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold">{data.duoRate}%</div>
                      <div className="text-xs text-muted-foreground">Active duos vs active members</div>
                    </CardContent>
                  </Card>
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle className="text-sm">ARPM</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold">{formatPrice(data.avgRevenuePerMember)}</div>
                      <div className="text-xs text-muted-foreground">Average revenue per member</div>
                    </CardContent>
                  </Card>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle className="text-sm">Retention / churn</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold">—</div>
                      <div className="text-xs text-muted-foreground">Monthly retention overview</div>
                    </CardContent>
                  </Card>
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle className="text-sm">Conversion funnel</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="h-2 rounded-full bg-white/10" />
                      <div className="h-2 w-4/5 rounded-full bg-white/10" />
                      <div className="h-2 w-3/5 rounded-full bg-white/10" />
                      <div className="text-xs text-muted-foreground">Views → Leads → Members</div>
                    </CardContent>
                  </Card>
                  <Card className="glass-card md:col-span-1">
                    <CardHeader>
                      <CardTitle className="text-sm">Revenue trends over time</CardTitle>
                    </CardHeader>
                    <CardContent className="h-40">
                      {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <defs>
                              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis dataKey="month" stroke="rgba(255,255,255,0.5)" fontSize={12} />
                            <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} tickFormatter={(v) => `₹${v}`} />
                            <Tooltip
                              contentStyle={CHART_TOOLTIP_STYLE}
                              formatter={(value) => [`₹${value ?? 0}`, "Revenue"]}
                            />
                            <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#revenueGradient)" isAnimationActive={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                          {emptyCopy}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="absolute inset-0 flex items-center justify-center">
                <Card className="glass-card border-primary/30 max-w-md w-full">
                  <CardHeader>
                    <CardTitle>Unlock advanced analytics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Understand growth, retention, and member behaviour with deeper insights.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button asChild size="lg">
                        <Link href="/owners">Upgrade ₹1,499</Link>
                      </Button>
                      <Button asChild size="lg" variant="outline">
                        <Link href="/owners">Upgrade ₹1,999</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
