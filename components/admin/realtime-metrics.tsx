"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Metrics = {
  pendingGyms: number;
  newGyms24h: number;
  failedPayments24h: number;
  activeSubscriptions: number;
  updatedAt: string;
};

export function RealtimeAdminMetrics() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const res = await fetch("/api/admin/metrics", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load metrics");
        const data = (await res.json()) as Metrics;
        if (!active) return;
        setMetrics(data);
        setError(null);
      } catch {
        if (!active) return;
        setError("Unable to load realtime metrics");
      }
    };

    load();
    const timer = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Pending gyms</CardTitle>
        </CardHeader>
        <CardContent className="text-3xl font-semibold">
          {metrics?.pendingGyms ?? "—"}
        </CardContent>
      </Card>
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>New gyms (24h)</CardTitle>
        </CardHeader>
        <CardContent className="text-3xl font-semibold">
          {metrics?.newGyms24h ?? "—"}
        </CardContent>
      </Card>
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Failed payments (24h)</CardTitle>
        </CardHeader>
        <CardContent className="text-3xl font-semibold">
          {metrics?.failedPayments24h ?? "—"}
        </CardContent>
      </Card>
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Active subscriptions</CardTitle>
        </CardHeader>
        <CardContent className="text-3xl font-semibold">
          {metrics?.activeSubscriptions ?? "—"}
        </CardContent>
      </Card>
      {error && (
        <div className="md:col-span-2 lg:col-span-4 text-xs text-muted-foreground">
          {error}
        </div>
      )}
    </div>
  );
}
