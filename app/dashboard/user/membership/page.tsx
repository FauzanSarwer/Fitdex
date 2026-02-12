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
import { fetchJson } from "@/lib/client-fetch";
import { isPaymentsEnabled, openRazorpayCheckout } from "@/lib/razorpay-checkout";

function MembershipContent() {
  const searchParams = useSearchParams();
  const joinGymId = searchParams.get("join");
  const { toast } = useToast();
  const [memberships, setMemberships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);
  const paymentsEnabled = isPaymentsEnabled();

  useEffect(() => {
    let active = true;
    fetchJson<{ memberships?: any[]; error?: string }>("/api/memberships", { retries: 1 })
      .then((result) => {
        if (!active) return;
        if (!result.ok) {
          toast({ title: "Error", description: result.error ?? "Failed to load memberships", variant: "destructive" });
          setError(result.error ?? "Failed to load memberships");
          setLoading(false);
          return;
        }
        setMemberships(result.data?.memberships ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        toast({ title: "Error", description: "Failed to load memberships", variant: "destructive" });
        setError("Failed to load memberships");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [toast]);

  const activeMembership = memberships.find((m) => m.active);
  const pendingMembership = memberships.find((m) => !m.active && m.gymId === joinGymId) ?? memberships.find((m) => !m.active);

  async function createMembership(gymId: string, planType: "MONTHLY" | "YEARLY") {
    setCreating(true);
    try {
      const result = await fetchJson<{ membership?: any; finalPricePaise?: number; error?: string }>("/api/memberships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gymId, planType }),
        retries: 1,
      });
      if (!result.ok) {
        toast({ title: "Error", description: result.error ?? "Failed to create membership", variant: "destructive" });
        setCreating(false);
        return;
      }
      const membership = result.data?.membership;
      setMemberships((prev) => (membership ? [membership, ...prev] : prev));
      toast({ title: "Membership created", description: "Proceed to payment." });
      if (membership) {
        await openRazorpay(membership.id, result.data?.finalPricePaise ?? 0);
      }
    } catch {
      toast({ title: "Error", description: "Something went wrong", variant: "destructive" });
    }
    setCreating(false);
  }

  async function openRazorpay(membershipId: string, amountPaise: number) {
    if (!paymentsEnabled) {
      toast({ title: "Payments not available yet", description: "Please try again later." });
      return;
    }
    setPaying(membershipId);
    try {
      const orderResult = await fetchJson<{ orderId?: string; amount?: number; currency?: string; error?: string }>("/api/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId }),
        retries: 1,
      });
      if (!orderResult.ok || !orderResult.data?.orderId) {
        toast({ title: "Error", description: orderResult.error ?? "Failed to create order", variant: "destructive" });
        setPaying(null);
        return;
      }
      const checkout = await openRazorpayCheckout({
        orderId: orderResult.data.orderId,
        amount: orderResult.data?.amount ?? 0,
        currency: orderResult.data?.currency ?? "INR",
        name: "Fitdex",
        onSuccess: async (res) => {
          const verifyResult = await fetchJson<{ error?: string }>("/api/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: res.razorpay_order_id,
              razorpay_payment_id: res.razorpay_payment_id,
              razorpay_signature: res.razorpay_signature,
              membershipId,
            }),
            retries: 1,
          });
          if (verifyResult.ok) {
            toast({ title: "Payment received", description: "Activation will complete after confirmation." });
          } else {
            toast({ title: "Verification failed", description: verifyResult.error ?? "Payment failed", variant: "destructive" });
          }
        },
        onDismiss: () => setPaying(null),
      });
      if (!checkout.ok && checkout.error && checkout.error !== "DISMISSED") {
        const message = checkout.error === "PAYMENTS_DISABLED" ? "Payments not available yet" : checkout.error;
        toast({ title: "Payments unavailable", description: message, variant: "destructive" });
      }
    } catch {
      setPaying(null);
      toast({ title: "Payment failed", variant: "destructive" });
    }
    setPaying(null);
  }

  async function cancelMembership(membershipId: string) {
    const result = await fetchJson<{ error?: string }>("/api/memberships/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ membershipId }),
      retries: 1,
    });
    if (result.ok) {
      toast({ title: "Membership cancelled" });
      setMemberships((prev) =>
        prev.map((m) => (m.id === membershipId ? { ...m, active: false } : m))
      );
    } else {
      toast({ title: "Failed to cancel", description: result.error ?? "Unable to cancel membership", variant: "destructive" });
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="glass-card p-10 text-center">
          <CardHeader>
            <CardTitle>Could not load memberships</CardTitle>
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
        className="space-y-2"
      >
        <h1 className="text-2xl font-bold">Membership</h1>
        <p className="text-muted-foreground text-sm">A simple path to consistent training and savings.</p>
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="glass-card border border-white/10">
          <CardHeader>
            <CardTitle>How it works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">1</span>
              <p>Pick a gym you love and choose monthly or yearly.</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">2</span>
              <p>Pay securely and get instant membership access.</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">3</span>
              <p>Invite a duo partner to unlock extra savings on renewal.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border border-white/10">
          <CardHeader>
            <CardTitle>Benefits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Predictable pricing</span>
              <span className="text-xs rounded-full bg-white/10 px-2 py-1">Transparent</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Partner savings</span>
              <span className="text-xs rounded-full bg-emerald-500/15 px-2 py-1 text-emerald-200">Duo perks</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Anytime support</span>
              <span className="text-xs rounded-full bg-white/10 px-2 py-1">In-app</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="h-px bg-white/10" />

      {activeMembership && (
        <Card className="glass-card max-w-2xl border border-white/10">
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

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass-card border border-white/10">
          <CardHeader>
            <CardTitle>When active</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Your gym pass stays active until the expiry date shown above.
          </CardContent>
        </Card>
        <Card className="glass-card border border-white/10">
          <CardHeader>
            <CardTitle>If expired</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            We’ll remind you to renew so you never lose momentum.
          </CardContent>
        </Card>
        <Card className="glass-card border border-white/10">
          <CardHeader>
            <CardTitle>Renewal CTA</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            A single primary button will appear here when renewal is available.
          </CardContent>
        </Card>
      </div>

      {memberships.filter((m) => !m.active).length > 0 && !activeMembership && (
        <Card className="glass-card border border-white/10">
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
                      disabled={!paymentsEnabled || paying === m.id}
                      onClick={() => openRazorpay(m.id, m.finalPrice)}
                    >
                      {paying === m.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : paymentsEnabled ? (
                        "Pay now"
                      ) : (
                        "Payments not available yet"
                      )}
                    </Button>
                  </div>
                ))}
          </CardContent>
        </Card>
      )}

      {joinGymId && !activeMembership && !memberships.some((m) => m.gymId === joinGymId) && (
        <Card className="glass-card border border-white/10">
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
        <Card className="glass-card p-8 text-left border border-white/10">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Ready when you are</h2>
            <p className="text-sm text-muted-foreground">
              Start with a gym you like. Your membership unlocks consistent access and duo savings.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild>
                <Link href="/explore">Explore gyms</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/user/duo">Learn about duo</Link>
              </Button>
            </div>
          </div>
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
