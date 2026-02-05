"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPrice } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, TrendingUp, Users } from "lucide-react";
import {
  BarChart,
  Bar,
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
  const [data, setData] = useState<{
    totalRevenue: number;
    revenueByMonth: Record<string, number>;
    activeMembers: number;
    activeDuos: number;
    payments: any[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/owner/gym")
      .then((r) => r.json())
      .then((d) => {
        const list = d.gyms ?? [];
        setGyms(list);
        const q = searchParams.get("gymId");
        if (q && list.some((g: any) => g.id === q)) setSelectedGymId(q);
        else if (list.length > 0) setSelectedGymId(list[0].id);
        setLoading(false);
      });
  }, [searchParams]);

  useEffect(() => {
    if (!selectedGymId) return;
    fetch(`/api/owner/analytics?gymId=${selectedGymId}`)
      .then((r) => r.json())
      .then(setData);
  }, [selectedGymId]);

  if (loading) {
    return (
      <div className="p-6">
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const chartData = data?.revenueByMonth
    ? Object.entries(data.revenueByMonth)
        .map(([month, value]) => ({ month, revenue: value / 100 }))
        .sort((a, b) => a.month.localeCompare(b.month))
    : [];

  return (
    <div className="p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          Analytics
        </h1>
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

      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total revenue</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">
                  {formatPrice(data.totalRevenue)}
                </p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Active members</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{data.activeMembers}</p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Active duos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{data.activeDuos}</p>
              </CardContent>
            </Card>
          </div>

          {chartData.length > 0 && (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Revenue by month</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="month" stroke="rgba(255,255,255,0.5)" fontSize={12} />
                    <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} tickFormatter={(v) => `₹${v}`} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid rgba(255,255,255,0.1)" }}
                      formatter={(value: number) => [`₹${value}`, "Revenue"]}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
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
