"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/client-fetch";
import { isPaymentsEnabled, openRazorpayCheckout } from "@/lib/razorpay-checkout";
import { useToast } from "@/hooks/use-toast";

const PLAN_LABELS: Record<string, string> = {
  STARTER: "Starter",
  PRO: "Pro",
};

export default function OwnerSubscriptionPage() {
  const { toast } = useToast();
  const [subscription, setSubscription] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const paymentsEnabled = isPaymentsEnabled();

  const loadSubscription = async () => {
    setLoading(true);
    const result = await fetchJson<{ subscription?: any; error?: string }>("/api/owner/subscription", { retries: 1 });
    if (result.ok) {
      setSubscription(result.data?.subscription ?? null);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSubscription().catch(() => setLoading(false));
  }, []);

  const startCheckout = async (plan: "STARTER" | "PRO") => {
    if (!paymentsEnabled) {
      toast({ title: "Payments not available", description: "Please try again later." });
      return;
    }
    setProcessing(plan);
    try {
      const orderResult = await fetchJson<{ orderId?: string; amount?: number; currency?: string; error?: string }>(
        "/api/owner/subscription/order",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan }),
          retries: 1,
        }
      );
      if (!orderResult.ok || !orderResult.data?.orderId) {
        toast({ title: "Error", description: orderResult.error ?? "Failed to start checkout", variant: "destructive" });
        setProcessing(null);
        return;
      }
      const checkout = await openRazorpayCheckout({
        orderId: orderResult.data.orderId,
        amount: orderResult.data.amount ?? 0,
        currency: orderResult.data.currency ?? "INR",
        name: "FITDEX",
        onSuccess: async (res) => {
          const verifyResult = await fetchJson<{ subscription?: any; error?: string }>(
            "/api/owner/subscription/verify",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: res.razorpay_order_id,
                paymentId: res.razorpay_payment_id,
                signature: res.razorpay_signature,
              }),
              retries: 1,
            }
          );
          if (verifyResult.ok) {
            toast({ title: "Subscription active", description: "Your plan has been updated." });
            setSubscription(verifyResult.data?.subscription ?? null);
          } else {
            toast({ title: "Verification failed", description: verifyResult.error ?? "Payment failed", variant: "destructive" });
          }
        },
      });
      if (!checkout.ok && checkout.error && checkout.error !== "DISMISSED") {
        const message = checkout.error === "PAYMENTS_DISABLED" ? "Payments not available" : checkout.error;
        toast({ title: "Payments unavailable", description: message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
    setProcessing(null);
  };

  const cancelSubscription = async () => {
    setProcessing("CANCEL");
    const result = await fetchJson<{ subscription?: any; error?: string }>("/api/owner/subscription/cancel", {
      method: "POST",
      retries: 1,
    });
    if (result.ok) {
      toast({ title: "Subscription canceled", description: "You’ll keep access until the end of the period." });
      setSubscription(result.data?.subscription ?? subscription);
    } else {
      toast({ title: "Cancel failed", description: result.error ?? "Please try again.", variant: "destructive" });
    }
    setProcessing(null);
  };

  const active = subscription && subscription.status === "ACTIVE" && new Date(subscription.expiresAt).getTime() > Date.now();
  const plan = subscription?.plan as "STARTER" | "PRO" | undefined;
  const planLabel = plan ? PLAN_LABELS[plan] ?? plan : "No plan";

  return (
    <div className="p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="h-6 w-6" />
          Manage subscription
        </h1>
        <p className="text-muted-foreground text-sm">View plan details, renewals, and upgrades.</p>
      </motion.div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Current plan</CardTitle>
          <CardDescription>Your active subscription details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="h-8 w-40 rounded bg-white/10 animate-pulse" />
          ) : (
            <>
              <div className="text-lg font-semibold">{planLabel}</div>
              {subscription ? (
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>Purchased on {new Date(subscription.createdAt).toLocaleDateString()}</div>
                  <div>
                    {subscription.status === "CANCELED" ? "Ends on" : "Renews on"} {new Date(subscription.expiresAt).toLocaleDateString()}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No active subscription yet.</div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>Upgrade or manage your plan.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={() => startCheckout("STARTER")}
            disabled={processing != null || plan === "STARTER" && active}
          >
            {processing === "STARTER" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buy Starter"}
          </Button>
          <Button
            onClick={() => startCheckout("PRO")}
            disabled={processing != null || plan === "PRO" && active}
          >
            {processing === "PRO" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upgrade to Pro"}
          </Button>
          {active && subscription?.status !== "CANCELED" && (
            <Button variant="outline" onClick={cancelSubscription} disabled={processing != null}>
              {processing === "CANCEL" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel subscription"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
