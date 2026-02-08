"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
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
import { BarChart3, TrendingUp, Users, Sparkles, Wallet, Percent } from "lucide-react";
import { fetchJson } from "@/lib/client-fetch";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function OwnerAnalyticsPage() {
  const searchParams = useSearchParams();
  const [gyms, setGyms] = useState<any[]>([]);
  const [selectedGymId, setSelectedGymId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
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
    payments: any[];
  } | null>(null);
  const [commissionReport, setCommissionReport] = useState<
    Array<{ month: string; totalBookings: number; totalCommission: number; commissionPercent: number }>
  >([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const hasProAccess = false;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchJson<{ gyms?: any[]; error?: string }>("/api/owner/gym", { retries: 1 })
      .then((result) => {
        if (!active) return;
        if (!result.ok) {
          throw new Error(result.error ?? "Failed to load gyms");
        }
        const list = result.data?.gyms ?? [];
        setGyms(list);
        const q = searchParams.get("gymId");
        if (q && list.some((g: any) => g.id === q)) setSelectedGymId(q);
        else if (list.length > 0) setSelectedGymId(list[0].id);
        else setSelectedGymId("");
      })
      .catch((e: any) => {
        if (!active) return;
        setGyms([]);
        setSelectedGymId("");
        setError(e?.message ?? "Failed to load gyms");
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
    fetchJson<any>(`/api/owner/analytics?gymId=${selectedGymId}`, { retries: 1 })
      .then((result) => {
        if (!active) return;
        if (!result.ok) {
          throw new Error(result.error ?? "Failed to load analytics");
        }
        setData(result.data ?? null);
        setError(null);
      })
      .catch((e: any) => {
        if (!active) return;
        setData(null);
        setError(e?.message ?? "Failed to load analytics");
      })
      .finally(() => {
        if (active) setAnalyticsLoading(false);
      });

    setReportLoading(true);
    fetchJson<{ report?: Array<{ month: string; totalBookings: number; totalCommission: number; commissionPercent: number }>; error?: string }>(
      `/api/owner/commission-report?gymId=${selectedGymId}`,
      { retries: 1 }
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

    return () => {
      active = false;
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

  const chartData = data?.revenueByMonth
    ? Object.entries(data.revenueByMonth)
        .map(([month, value]) => ({ month, revenue: value / 100 }))
        .sort((a, b) => a.month.localeCompare(b.month))
    : [];

  const membersData = data?.newMembersByMonth
    ? Object.entries(data.newMembersByMonth)
        .map(([month, value]) => ({ month, members: value }))
        .sort((a, b) => a.month.localeCompare(b.month))
    : [];

  const planData = data?.planDistribution
    ? Object.entries(data.planDistribution).map(([plan, count]) => ({
        plan,
        count,
      }))
    : [];

  const statusData = data?.paymentsByStatus
    ? Object.entries(data.paymentsByStatus).map(([status, count]) => ({
        status,
        count,
      }))
    : [];

  const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#22c55e", "#f59e0b"];

  return (
    <div className="p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
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
        <p className="text-muted-foreground text-sm">Revenue and engagement.</p>
      </motion.div>

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
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total revenue</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">
                  {formatPrice(data.totalRevenue)}
                </p>
                <p className="text-xs text-muted-foreground">Captured payments</p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Estimated revenue</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">
                  {formatPrice(data.estimatedRevenue)}
                </p>
                <p className="text-xs text-muted-foreground">Estimated from paid bookings</p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Active members</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">
                  {data.activeMembers}
                </p>
                <p className="text-xs text-muted-foreground">Total memberships: {data.totalMembers}</p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Leads</CardTitle>
                <Sparkles className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">{data.totalLeads}</p>
                <p className="text-xs text-muted-foreground">Last 30 days: {data.leadsLast30Days}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Bookings this week</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">{data.bookingsCurrentWeek}</p>
                <p className="text-xs text-muted-foreground">Previous week: {data.bookingsPreviousWeek}</p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Estimated revenue note</CardTitle>
                <Percent className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Estimated values are derived from paid booking totals and are not guaranteed revenue.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Monthly commission report</CardTitle>
            </CardHeader>
            <CardContent>
              {reportLoading ? (
                <Skeleton className="h-24" />
              ) : commissionReport.length === 0 ? (
                <p className="text-sm text-muted-foreground">No commission data yet.</p>
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
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Active duos</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{data.activeDuos}</p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">ARPM</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatPrice(data.avgRevenuePerMember)}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total members</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{data.totalMembers}</p>
                <p className="text-xs text-muted-foreground">Inactive: {data.inactiveMembers}</p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Duo rate</CardTitle>
                <Percent className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{data.duoRate}%</p>
                <p className="text-xs text-muted-foreground">Active duos vs active members</p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Growth signal</CardTitle>
                <Sparkles className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{membersData.at(-1)?.members ?? 0}</p>
                <p className="text-xs text-muted-foreground">New members this month</p>
              </CardContent>
            </Card>
          </div>

          <div className={`grid gap-4 lg:grid-cols-2 ${hasProAccess ? "" : "blur-sm"}`}>
            {chartData.length > 0 && (
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Revenue by month</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
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
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid rgba(255,255,255,0.1)" }}
                        formatter={(value) => [`₹${value ?? 0}`, "Revenue"]}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#revenueGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {membersData.length > 0 && (
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>New members</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={membersData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="month" stroke="rgba(255,255,255,0.5)" fontSize={12} />
                      <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid rgba(255,255,255,0.1)" }}
                      />
                      <Line type="monotone" dataKey="members" stroke="hsl(var(--accent))" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          <div className={`grid gap-4 lg:grid-cols-2 ${hasProAccess ? "" : "blur-sm"}`}>
            {planData.length > 0 && (
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Plan distribution</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={planData} dataKey="count" nameKey="plan" innerRadius={60} outerRadius={90}>
                        {planData.map((_, idx) => (
                          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid rgba(255,255,255,0.1)" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {statusData.length > 0 && (
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Payment status</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statusData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="status" stroke="rgba(255,255,255,0.5)" fontSize={12} />
                      <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid rgba(255,255,255,0.1)" }}
                      />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {!hasProAccess && (
            <Card className="glass-card border-primary/30">
              <CardHeader>
                <CardTitle>Unlock analytics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Advanced analytics are available on paid plans. Upgrade to view charts, trends, and detailed insights.
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
          )}

          {data.payments?.length > 0 && (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Recent payments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.payments.slice(0, 10).map((p: any) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between py-2 border-b border-white/10 last:border-0 text-sm"
                    >
                      <span>{new Date(p.createdAt).toLocaleString()}</span>
                      <span className="text-primary font-medium">{formatPrice(p.amount)}</span>
                      <span className="text-muted-foreground">{p.status}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
