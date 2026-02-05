"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

declare global {
  interface Window {
    Razorpay?: new (options: {
      key: string;
      amount: number;
      currency: string;
      name: string;
      order_id: string;
      handler: (res: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
    }) => { open: () => void };
  }
}

function MembershipContent() {
  const searchParams = useSearchParams();
  const joinGymId = searchParams.get("join");
  const { toast } = useToast();
  const [memberships, setMemberships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/memberships")
      .then((r) => r.json())
      .then((d) => {
        setMemberships(d.memberships ?? []);
        setLoading(false);
      });
  }, []);

  const activeMembership = memberships.find((m) => m.active);
  const pendingMembership = memberships.find((m) => !m.active && m.gymId === joinGymId) ?? memberships.find((m) => !m.active);

  async function createMembership(gymId: string, planType: "MONTHLY" | "YEARLY") {
    setCreating(true);
    try {
      const res = await fetch("/api/memberships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gymId, planType }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Error", description: data.error ?? "Failed to create membership", variant: "destructive" });
        setCreating(false);
        return;
      }
      setMemberships((prev) => [data.membership, ...prev]);
      toast({ title: "Membership created", description: "Proceed to payment." });
      await openRazorpay(data.membership.id, data.finalPricePaise);
    } catch {
      toast({ title: "Error", description: "Something went wrong", variant: "destructive" });
    }
    setCreating(false);
  }

  async function openRazorpay(membershipId: string, amountPaise: number) {
    setPaying(membershipId);
    try {
      const orderRes = await fetch("/api/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        toast({ title: "Error", description: orderData.error ?? "Failed to create order", variant: "destructive" });
        setPaying(null);
        return;
      }
      const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "XXXXX";
      if (typeof window.Razorpay === "undefined") {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        document.body.appendChild(script);
        await new Promise((r) => script.onload = r);
      }
      const rzp = new window.Razorpay!({
        key,
        amount: orderData.amount,
        currency: orderData.currency ?? "INR",
        name: "GYMDUO",
        order_id: orderData.orderId,
        handler: async (res) => {
          const verifyRes = await fetch("/api/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: res.razorpay_order_id,
              razorpay_payment_id: res.razorpay_payment_id,
              razorpay_signature: res.razorpay_signature,
              membershipId,
            }),
          });
          if (verifyRes.ok) {
            toast({ title: "Payment successful", description: "Membership activated." });
            setMemberships((prev) =>
              prev.map((m) =>
                m.id === membershipId ? { ...m, active: true } : m
              )
            );
          } else {
            toast({ title: "Verification failed", variant: "destructive" });
          }
          setPaying(null);
        },
      });
      rzp.open();
    } catch {
      setPaying(null);
      toast({ title: "Payment failed", variant: "destructive" });
    }
  }

  async function cancelMembership(membershipId: string) {
    const res = await fetch("/api/memberships/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ membershipId }),
    });
    if (res.ok) {
      toast({ title: "Membership cancelled" });
      setMemberships((prev) =>
        prev.map((m) => (m.id === membershipId ? { ...m, active: false } : m))
      );
    } else {
      toast({ title: "Failed to cancel", variant: "destructive" });
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold">Membership</h1>
        <p className="text-muted-foreground text-sm">Manage your gym membership.</p>
      </motion.div>

      {activeMembership && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>{activeMembership.gym.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              {activeMembership.planType} · {formatPrice(activeMembership.finalPrice)} · Expires{" "}
              {new Date(activeMembership.expiresAt).toLocaleDateString()}
            </p>
            {activeMembership.discountBreakdown && (
              <pre className="text-xs text-muted-foreground overflow-auto max-h-24">
                {JSON.stringify(JSON.parse(activeMembership.discountBreakdown), null, 2)}
              </pre>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => cancelMembership(activeMembership.id)}
            >
              Cancel membership
            </Button>
          </CardContent>
        </Card>
      )}

      {memberships.filter((m) => !m.active).length > 0 && !activeMembership && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Pending payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
              {memberships
                .filter((m) => !m.active)
                .map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-2 border-b border-white/10 last:border-0">
                    <div>
                      <p className="font-medium">{m.gym?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatPrice(m.finalPrice)} · {m.planType}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      disabled={paying === m.id}
                      onClick={() => openRazorpay(m.id, m.finalPrice)}
                    >
                      {paying === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pay now"}
                    </Button>
                  </div>
                ))}
          </CardContent>
        </Card>
      )}

      {joinGymId && !activeMembership && !memberships.some((m) => m.gymId === joinGymId) && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Join this gym</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button
              disabled={creating}
              onClick={() => createMembership(joinGymId, "MONTHLY")}
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Monthly"}
            </Button>
            <Button
              variant="outline"
              disabled={creating}
              onClick={() => createMembership(joinGymId, "YEARLY")}
            >
              Yearly
            </Button>
          </CardContent>
        </Card>
      )}

      {!activeMembership && memberships.filter((m) => !m.active).length === 0 && !joinGymId && (
        <Card className="glass-card p-8 text-center">
          <p className="text-muted-foreground mb-4">No membership yet</p>
          <Button asChild>
            <Link href="/explore">Explore gyms</Link>
          </Button>
        </Card>
      )}
    </div>
  );
}

export default function MembershipPage() {
  return (
    <Suspense fallback={<div className="p-6"><Skeleton className="h-64 rounded-2xl" /></div>}>
      <MembershipContent />
    </Suspense>
  );
}
