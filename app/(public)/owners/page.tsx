"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  Headphones,
  MapPin,
  Star,
  Users,
  Zap,
  Check,
  X,
  Dumbbell,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { isOwner } from "@/lib/permissions";
import { fetchJson } from "@/lib/client-fetch";
import { isPaymentsEnabled, openRazorpayCheckout } from "@/lib/razorpay-checkout";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BENEFITS = [
  {
    icon: MapPin,
    title: "Reach more members",
    desc: "Get discovered by thousands of fitness seekers in Delhi NCR through our map-based discovery.",
  },
  {
    icon: Users,
    title: "Duo-driven signups",
    desc: "The duo partner discount brings pairs through your doors—more members, higher retention.",
  },
  {
    icon: BarChart3,
    title: "Analytics & insights",
    desc: "Track memberships, duos, revenue, and trends—all in one dashboard.",
  },
  {
    icon: Zap,
    title: "Real payments",
    desc: "Integrated Razorpay. Members pay online, you get paid. No manual tracking.",
  },
];

type OwnerPlanType = "STARTER" | "PRO" | "FEATURED";

const PLANS: Array<{
  name: string;
  planType: OwnerPlanType | "FREE";
  price: number;
  period: string;
  features: Array<{ label: string; available: boolean }>;
  cta: string;
  popular?: boolean;
}> = [
  {
    name: "Free",
    planType: "FREE",
    price: 0,
    period: "month",
    features: [
      { label: "Gym listing on map", available: true },
      { label: "Membership management", available: false },
      { label: "Analytics dashboard", available: false },
      { label: "Priority support", available: false },
      { label: "Discount & promo management", available: false },
    ],
    cta: "Free",
  },
  {
    name: "Starter",
    planType: "STARTER",
    price: 1499,
    period: "month",
    features: [
      { label: "Gym listing on map", available: true },
      { label: "Membership management", available: true },
      { label: "Analytics dashboard", available: true },
      { label: "Priority support", available: true },
      { label: "Discount & promo management", available: false },
    ],
    cta: "Get started",
  },
  {
    name: "Pro",
    planType: "PRO",
    price: 1999,
    period: "month",
    features: [
      { label: "Everything in Starter", available: true },
      { label: "Featured gym placement", available: true },
      { label: "Discount & promo management", available: true },
      { label: "Member insights & reports", available: true },
      { label: "Dedicated account manager", available: true },
    ],
    popular: true,
    cta: "Go Pro",
  },
  {
    name: "Feature your gym",
    planType: "FEATURED",
    price: 99,
    period: "3 days",
    features: [
      { label: "Featured badge", available: true },
      { label: "Top placement in Explore", available: true },
      { label: "Boosted discovery for new members", available: true },
    ],
    cta: "Boost for 3 days",
  },
];

export default function OwnersPage() {
  const { data: session, status } = useSession();
  const owner = status === "authenticated" && isOwner(session);
  const role = (session?.user as { role?: string })?.role;
  const isAdmin = role === "ADMIN";
  const { toast } = useToast();
  const [subscription, setSubscription] = useState<any | null>(null);
  const [loadingSub, setLoadingSub] = useState(false);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const paymentsEnabled = isPaymentsEnabled() || isAdmin;

  useEffect(() => {
    if (!owner) return;
    let active = true;
    setLoadingSub(true);
    fetchJson<{ subscription?: any }>("/api/owner/subscription", { retries: 1 })
      .then((result) => {
        if (!active) return;
        if (result.ok) setSubscription(result.data?.subscription ?? null);
      })
      .finally(() => {
        if (active) setLoadingSub(false);
      });
    return () => {
      active = false;
    };
  }, [owner]);

  const activePlan = subscription?.status === "ACTIVE" && new Date(subscription.expiresAt).getTime() > Date.now()
    ? subscription.plan
    : null;

  const startCheckout = async (plan: "STARTER" | "PRO") => {
    if (!paymentsEnabled) {
      toast({ title: "Payments not available", description: "Please try again later." });
      return;
    }
    setProcessingPlan(plan);
    try {
      if (isAdmin) {
        const adminResult = await fetchJson<{ subscription?: any; error?: string }>(
          "/api/owner/subscription/order",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan }),
            retries: 1,
          }
        );
        if (adminResult.ok) {
          const refreshed = await fetchJson<{ subscription?: any }>("/api/owner/subscription", { retries: 1 });
          setSubscription(refreshed.ok ? refreshed.data?.subscription ?? null : subscription);
          toast({ title: "Admin access", description: "Plan activated for testing." });
        } else {
          toast({ title: "Error", description: adminResult.error ?? "Failed to activate", variant: "destructive" });
        }
        setProcessingPlan(null);
        return;
      }
      const orderResult = await fetchJson<{ orderId?: string; amount?: number; currency?: string; error?: string }>(
        "/api/owner/subscription/order",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan }),
        }
      );
      if (!orderResult.ok || !orderResult.data?.orderId) {
        toast({ title: "Error", description: orderResult.error ?? "Failed to start checkout", variant: "destructive" });
        setProcessingPlan(null);
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
    setProcessingPlan(null);
  };

  return (
    <div className="container mx-auto px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-3xl mx-auto mb-16"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary mb-6">
          <Dumbbell className="h-4 w-4" />
          For Gym Owners
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          List your gym on FitDex
        </h1>
        <p className="text-muted-foreground mt-4 text-lg">
          Reach more members, get analytics, and manage everything in one place. Join hundreds of gyms already on the platform.
        </p>
      </motion.div>

      {/* Benefits */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-20"
      >
        <h2 className="text-2xl font-bold text-center mb-10">Why list on FitDex?</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {BENEFITS.map((b, i) => (
            <Card key={i} className="glass-card border-white/10">
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 mb-2">
                  <b.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">{b.title}</h3>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{b.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.section>

      {/* Pricing */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-20"
      >
        <h2 className="text-2xl font-bold text-center mb-2">Simple pricing</h2>
        <p className="text-muted-foreground text-center mb-10">
          Choose the plan that fits your gym. No hidden fees.
        </p>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PLANS.map((plan, i) => (
            <Card
              key={i}
              className={`glass-card relative overflow-hidden flex flex-col ${
                plan.popular ? "border-primary/50 ring-2 ring-primary/20" : "border-white/10"
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 right-0 flex items-center gap-1 bg-primary/20 text-primary px-3 py-1 text-xs font-medium rounded-bl-lg">
                  <Star className="h-3 w-3" />
                  Popular
                </div>
              )}
              <CardHeader>
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-bold">₹{plan.price.toLocaleString()}</span>
                  <span className="text-muted-foreground">/{plan.period}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 flex flex-col flex-1">
                <ul className="space-y-3 flex-1">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm">
                      {f.available ? (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className={f.available ? "text-foreground" : "text-muted-foreground"}>{f.label}</span>
                    </li>
                  ))}
                </ul>
                {plan.planType === "FREE" ? (
                  <Button className="w-full mt-auto" size="lg" variant="outline" disabled>
                    Free plan
                  </Button>
                ) : owner ? (
                  plan.planType === "FEATURED" ? (
                    <Button asChild className="w-full mt-auto" size="lg" variant={plan.popular ? "default" : "outline"}>
                      <Link href="/dashboard/owner/explore">Boost a gym</Link>
                    </Button>
                  ) : activePlan && activePlan === plan.planType ? (
                    <Button asChild className="w-full mt-auto" size="lg" variant={plan.popular ? "default" : "outline"}>
                      <Link href="/dashboard/owner/subscription">Manage</Link>
                    </Button>
                  ) : activePlan === "STARTER" && plan.planType === "PRO" ? (
                    <Button
                      className="w-full mt-auto"
                      size="lg"
                      onClick={() => startCheckout("PRO")}
                      disabled={processingPlan != null || loadingSub}
                    >
                      {processingPlan === "PRO" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upgrade"}
                    </Button>
                  ) : (
                    <Button
                      className="w-full mt-auto"
                      size="lg"
                      variant={plan.popular ? "default" : "outline"}
                      onClick={() => startCheckout(plan.planType === "PRO" ? "PRO" : "STARTER")}
                      disabled={processingPlan != null || loadingSub}
                    >
                      {processingPlan === plan.planType ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buy now"}
                    </Button>
                  )
                ) : (
                  <Button asChild className="w-full mt-auto" size="lg" variant={plan.popular ? "default" : "outline"}>
                    <Link href={`/auth/login?callbackUrl=${encodeURIComponent("/dashboard/owner")}`}>
                      Buy now
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
        {!owner && (
          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{" "}
            <Link href="/auth/register" className="text-primary hover:underline">
              Sign up as owner
            </Link>{" "}
            to create one.
          </p>
        )}
      </motion.section>

      {/* CTA - Login to owner dashboard */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-center"
      >
        <Card className="glass-card border-primary/30 max-w-xl mx-auto p-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 mx-auto mb-4">
            <Headphones className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Ready to grow your gym?</h2>
          <p className="text-muted-foreground mb-6">
            {status === "loading" ? (
              <span className="inline-block h-5 w-48 bg-white/10 rounded animate-pulse" />
            ) : owner ? (
              "Head to your dashboard to manage your gyms."
            ) : (
              "Log in to your owner account or create one to list your gym."
            )}
          </p>
          {status !== "loading" && (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {owner ? (
                <Button asChild size="lg">
                  <Link href="/dashboard/owner">Go to Owner Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button asChild size="lg">
                    <Link href={`/auth/login?callbackUrl=${encodeURIComponent("/dashboard/owner")}`}>
                      Log in to Owner Dashboard
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link href="/auth/register?role=owner">Create owner account</Link>
                  </Button>
                </>
              )}
            </div>
          )}
        </Card>
      </motion.section>
    </div>
  );
}
