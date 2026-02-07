"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJson } from "@/lib/client-fetch";
import { formatPrice } from "@/lib/utils";

type Transaction = {
  id: string;
  gymId: string;
  totalAmount: number;
  platformCommissionAmount: number;
  gymPayoutAmount: number;
  paymentStatus: string;
  settlementStatus: string;
};

export default function OwnerDashboardPage() {
  const [gyms, setGyms] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchJson<{ gyms?: any[]; error?: string }>("/api/owner/gym", { retries: 1 }),
      fetchJson<{ transactions?: Transaction[]; error?: string }>("/api/owner/transactions", { retries: 1 }),
    ])
      .then(([gymResult, txResult]) => {
        if (!active) return;
        if (!gymResult.ok) {
          setError(gymResult.error ?? "Failed to load gyms");
          setGyms([]);
          return;
        }
        setGyms(gymResult.data?.gyms ?? []);
        if (txResult.ok) {
          setTransactions(txResult.data?.transactions ?? []);
        } else {
          setTransactions([]);
        }
      })
      .catch(() => {
        if (!active) return;
        setGyms([]);
        setTransactions([]);
        setError("Failed to load dashboard");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="glass-card p-10 text-center">
          <CardHeader>
            <CardTitle>Could not load dashboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalMembers = gyms.reduce(
    (sum, gym) => sum + (gym._count?.memberships ?? 0),
    0
  );

  const formatStatus = (status: string) => status.replace(/_/g, " ");

  return (
    <div className="p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold">Owner dashboard</h1>
          <p className="text-muted-foreground text-sm">Read-only view of verification and payouts.</p>
        </div>
      </motion.div>

      {gyms.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="glass-card">
            <CardHeader>
              <CardDescription>Total gyms</CardDescription>
              <CardTitle className="text-3xl">{gyms.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="glass-card">
            <CardHeader>
              <CardDescription>Total members</CardDescription>
              <CardTitle className="text-3xl">{totalMembers}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {gyms.length === 0 ? (
        <Card className="glass-card p-12 text-center">
          <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">No gyms yet</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild>
              <Link href="/dashboard/owner/gym">Add your first gym</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/owners">See plans</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {gyms.map((gym) => (
            <Card key={gym.id} className="glass-card">
              <CardHeader>
                <CardTitle>{gym.name}</CardTitle>
                <CardDescription>{gym.address}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs">
                    Status: <span className="font-semibold">{formatStatus(gym.verificationStatus)}</span>
                  </span>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {gym._count?.memberships ?? 0} members
                  </div>
                </div>

                {gym.verificationStatus !== "VERIFIED" && (
                  <div className="space-y-2 text-sm">
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-200">
                      Membership acceptance is disabled until verification is complete.
                    </div>
                    <div className="text-muted-foreground">
                      Notes: {gym.verificationNotes ?? "No admin notes yet."}
                    </div>
                  </div>
                )}

                {gym.verificationStatus === "VERIFIED" && (
                  <div className="grid gap-3 text-sm">
                    {(() => {
                      const gymTransactions = transactions.filter((t) => t.gymId === gym.id);
                      const paidTransactions = gymTransactions.filter((t) => t.paymentStatus === "PAID");
                      const membershipsSold = paidTransactions.length;
                      const gross = paidTransactions.reduce((sum, t) => sum + (t.totalAmount ?? 0), 0);
                      const commission = paidTransactions.reduce(
                        (sum, t) => sum + (t.platformCommissionAmount ?? 0),
                        0
                      );
                      const net = paidTransactions.reduce(
                        (sum, t) => sum + (t.gymPayoutAmount ?? 0),
                        0
                      );
                      const settlementCounts = paidTransactions.reduce(
                        (acc, t) => {
                          const key = t.settlementStatus ?? "UNKNOWN";
                          acc[key] = (acc[key] ?? 0) + 1;
                          return acc;
                        },
                        {} as Record<string, number>
                      );
                      const settlementSummary = Object.entries(settlementCounts)
                        .map(([status, count]) => `${formatStatus(status)}: ${count}`)
                        .join(" · ");

                      return (
                        <div className="space-y-2">
                          <div className="grid gap-2 md:grid-cols-2">
                            <div>Memberships sold: <span className="font-semibold">{membershipsSold}</span></div>
                            <div>Gross amount: <span className="font-semibold">{formatPrice(gross)}</span></div>
                            <div>Platform commission: <span className="font-semibold">{formatPrice(commission)}</span></div>
                            <div>Net payout: <span className="font-semibold">{formatPrice(net)}</span></div>
                          </div>
                          <div className="text-muted-foreground">
                            Settlement status: {settlementSummary || "No settlements yet"}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
