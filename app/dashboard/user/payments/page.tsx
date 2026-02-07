"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard } from "lucide-react";
import { fetchJson } from "@/lib/client-fetch";

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<{ payments?: any[]; error?: string }>("/api/payments", { retries: 1 })
      .then((result) => {
        if (!result.ok) {
          setError(result.error ?? "Failed to load payments");
          setLoading(false);
          return;
        }
        setPayments(result.data?.payments ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load payments");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="glass-card p-10 text-center">
          <CardHeader>
            <CardTitle>Could not load payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="h-6 w-6" />
          Payment history
        </h1>
        <p className="text-muted-foreground text-sm">All your transactions.</p>
      </motion.div>

      {payments.length === 0 ? (
        <Card className="glass-card p-12 text-center">
          <p className="text-muted-foreground">No payments yet.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {payments.map((p) => (
            <Card key={p.id} className="glass-card">
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium">{p.gym?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(p.createdAt).toLocaleString()} · {p.status}
                  </p>
                </div>
                <p className="font-semibold text-primary">{formatPrice(p.amount)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
