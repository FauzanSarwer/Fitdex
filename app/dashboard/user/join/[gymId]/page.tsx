"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  MapPin,
  User,
  Dumbbell,
  Users,
  Tag,
  Loader2,
  Check,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/utils";
import type { PlanType } from "@/lib/discounts";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJson } from "@/lib/client-fetch";
import { isPaymentsEnabled, openRazorpayCheckout } from "@/lib/razorpay-checkout";

declare global {
  interface Window {
    Razorpay?: new (options: {
      key: string;
      amount: number;
      currency: string;
      name: string;
      order_id: string;
      handler: (res: {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
      }) => void;
      modal?: { ondismiss?: () => void };
    }) => { open: () => void };
  }
}

interface GymData {
  id: string;
  name: string;
  address: string;
  coverImageUrl: string | null;
  owner: { id: string; name: string | null };
  dayPassPrice?: number | null;
  monthlyPrice: number;
  quarterlyPrice: number;
  yearlyPrice: number;
  partnerDiscountPercent: number;
  yearlySavePercent: number;
  quarterlySavePercent: number;
}

function JoinContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const gymId = params.gymId as string;
  const { toast } = useToast();
  const [gym, setGym] = useState<GymData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("MONTHLY");
  const [discountCode, setDiscountCode] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [inviteInfo, setInviteInfo] = useState<{ message: string; valid: boolean } | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [hasDuo, setHasDuo] = useState(false);
  const [inviteCreated, setInviteCreated] = useState<{ code: string } | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const paymentsEnabled = isPaymentsEnabled();

  useEffect(() => {
    let active = true;
    if (!gymId) return () => { active = false; };
    fetchJson<{ gym?: GymData; error?: string }>(`/api/gyms/${gymId}`, { retries: 1 })
      .then((result) => {
        if (!active) return;
        if (!result.ok || !result.data?.gym) {
          setError(result.error ?? "Gym not found");
          setLoading(false);
          return;
        }
        setGym(result.data.gym);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError("Failed to load gym");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [gymId]);

  useEffect(() => {
    const inviteParam = searchParams.get("invite");
    if (inviteParam && !inviteCode) {
      setInviteCode(inviteParam.toUpperCase());
    }
  }, [inviteCode, searchParams]);

  useEffect(() => {
    if (!inviteCode.trim() || !gymId) {
      setInviteInfo(null);
      return;
    }
    const controller = new AbortController();
    fetch("/api/invites/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: inviteCode.trim(), gymId }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.valid) {
          setInviteInfo({ valid: true, message: d.message ?? "Invite applied" });
        } else {
          setInviteInfo({ valid: false, message: d.message ?? "Invalid invite" });
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [inviteCode, gymId]);

  useEffect(() => {
    fetchJson<{ duos?: any[] }>("/api/duos", { retries: 1 })
      .then((result) => {
        if (!result.ok) return;
        const active = (result.data?.duos ?? []).find((x: any) => x.active && x.gym?.id === gymId);
        setHasDuo(!!active);
      })
      .catch(() => {});
  }, [gymId]);

  async function handleCreateInvite() {
    if (!gymId) return;
    setCreatingInvite(true);
    try {
      const result = await fetchJson<{ code?: string; error?: string }>("/api/duos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gymId, joinTogether: true }),
        retries: 1,
      });
      if (!result.ok || !result.data?.code) {
        toast({ title: "Error", description: result.error ?? "Failed to create invite", variant: "destructive" });
        return;
      }
      setInviteCreated({ code: result.data.code });
      toast({ title: "Invite created", description: "Share this code with your partner" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setCreatingInvite(false);
    }
  }

  async function handleCheckout() {
    if (!gymId || !selectedPlan) return;
    setCheckingOut(true);
    try {
      const result = await fetchJson<{ membership?: { id: string }; finalPricePaise?: number; error?: string }>("/api/memberships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymId,
          planType: selectedPlan,
          discountCode: discountCode.trim() || undefined,
          inviteCode: inviteCode.trim() || undefined,
        }),
        retries: 1,
      });
      if (!result.ok || !result.data?.membership?.id) {
        toast({
          title: "Error",
          description: result.error ?? "Failed to create membership",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Redirecting to checkout",
        description: "Complete payment to activate your membership.",
      });
      const paid = await openRazorpay(result.data.membership.id, result.data.finalPricePaise ?? 0);
      if (paid) {
        router.push("/dashboard/user/membership");
      }
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setCheckingOut(false);
    }
  }

  async function openRazorpay(membershipId: string, amountPaise: number): Promise<boolean> {
    try {
      if (!paymentsEnabled) {
        toast({ title: "Payments not available yet", description: "Please try again later." });
        return false;
      }
      const orderResult = await fetchJson<{ orderId?: string; amount?: number; currency?: string; error?: string }>("/api/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId }),
        retries: 1,
      });
      if (!orderResult.ok || !orderResult.data?.orderId) {
        toast({
          title: "Error",
          description: orderResult.error ?? "Failed to create order",
          variant: "destructive",
        });
        return false;
      }
      const checkout = await openRazorpayCheckout({
        orderId: orderResult.data.orderId,
        amount: orderResult.data?.amount ?? amountPaise,
        currency: orderResult.data?.currency ?? "INR",
        name: "GYMDUO",
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
      });
      if (!checkout.ok) {
        if (checkout.error && checkout.error !== "DISMISSED") {
          const message = checkout.error === "PAYMENTS_DISABLED" ? "Payments not available yet" : checkout.error;
          toast({ title: "Payments unavailable", description: message, variant: "destructive" });
        }
        return false;
      }
      return true;
    } catch {
      toast({ title: "Payment failed", variant: "destructive" });
      return false;
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Skeleton className="h-48 rounded-2xl mb-6" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  if (error || !gym) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card className="glass-card p-10 text-center">
          <CardHeader>
            <CardTitle>Unable to load gym</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{error ?? "Please try again."}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const plans = [
    ...(gym.dayPassPrice && gym.dayPassPrice > 0
      ? [
          {
            type: "DAY_PASS" as PlanType,
            label: "Day pass",
            price: gym.dayPassPrice,
            savePercent: null,
            desc: "One-day access",
          },
        ]
      : []),
    {
      type: "MONTHLY" as PlanType,
      label: "Monthly",
      price: gym.monthlyPrice,
      savePercent: null,
      desc: "Pay as you go",
    },
    {
      type: "QUARTERLY" as PlanType,
      label: "Quarterly",
      price: gym.quarterlyPrice,
      savePercent: gym.quarterlySavePercent,
      desc: "3 months",
    },
    {
      type: "YEARLY" as PlanType,
      label: "Yearly",
      price: gym.yearlyPrice,
      savePercent: gym.yearlySavePercent,
      desc: "Best value",
    },
  ];

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/explore" className="hover:text-foreground">
            Explore
          </Link>
          <span>/</span>
          <span className="text-foreground">{gym.name}</span>
        </div>

        {/* Gym hero – photo, name, owner, address */}
        <Card className="glass-card overflow-hidden border-primary/20">
          <div className="relative h-40 bg-gradient-to-br from-primary/30 via-primary/10 to-accent/20 flex items-center justify-center">
            {gym.coverImageUrl ? (
              <img
                src={gym.coverImageUrl}
                alt={gym.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-primary/80">
                <Dumbbell className="h-16 w-16" />
                <span className="text-sm font-medium">{gym.name}</span>
              </div>
            )}
            <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-black/40 px-2 py-1 text-xs">
              <Sparkles className="h-3 w-3" />
              Popular in your area
            </div>
          </div>
          <CardHeader>
            <h1 className="text-2xl font-bold">{gym.name}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>Owner: {gym.owner?.name ?? "Gym"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span>{gym.address}</span>
            </div>
          </CardHeader>
        </Card>

        {/* Plan selection */}
        <Card className="glass-card">
          <CardHeader>
            <h2 className="text-lg font-semibold">Choose your plan</h2>
            <p className="text-sm text-muted-foreground">
              Longer plans = bigger savings. Lock in your rate now.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {plans.map((p) => (
              <button
                key={p.type}
                type="button"
                onClick={() => setSelectedPlan(p.type)}
                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left ${
                  selectedPlan === p.type
                    ? "border-primary bg-primary/10"
                    : "border-white/10 hover:border-white/20"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{p.label}</span>
                    {p.savePercent != null && p.savePercent > 0 && (
                      <span className="text-xs font-medium text-primary bg-primary/20 px-2 py-0.5 rounded-full">
                        Save {p.savePercent}%
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{p.desc}</p>
                </div>
                <div className="text-right">
                  <span className="font-bold">{formatPrice(p.price)}</span>
                  {(p.type === "QUARTERLY" || p.type === "YEARLY") && (
                    <p className="text-xs text-muted-foreground">
                      {formatPrice(Math.round(p.price / (p.type === "QUARTERLY" ? 3 : 12)))}/mo
                    </p>
                  )}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Partner invite — join together */}
        {gym.partnerDiscountPercent > 0 && (
          <Card className="glass-card border-amber-500/30 bg-amber-500/5">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-amber-500" />
                <span className="font-semibold">Join with a partner — save {gym.partnerDiscountPercent}%</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {hasDuo
                  ? "You have an active duo — discount applies!"
                  : "Invite someone to join this gym with you. Both get the partner discount. (Set by gym owner.)"}
              </p>
            </CardHeader>
            {!hasDuo && (
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">Partner invited you? Enter their code:</p>
                  <Input
                    placeholder="Partner invite code"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    className="uppercase max-w-[200px]"
                  />
                  {inviteInfo && (
                    <p className={`mt-2 text-xs ${inviteInfo.valid ? "text-primary" : "text-destructive"}`}>
                      {inviteInfo.message}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Or invite a partner to join with you:</p>
                  {inviteCreated ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="px-3 py-2 rounded-lg bg-amber-500/20 font-mono text-lg">
                          {inviteCreated.code}
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigator.clipboard.writeText(inviteCreated.code)}
                        >
                          Copy code
                        </Button>
                        <p className="text-xs text-muted-foreground">Share the code with your partner</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            const link = `${window.location.origin}/invite/${inviteCreated.code}`;
                            navigator.clipboard.writeText(link);
                            toast({ title: "Link copied", description: "Invite link copied to clipboard" });
                          }}
                        >
                          Copy partner link
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const link = `${window.location.origin}/invite/${inviteCreated.code}`;
                            const text = `Join me at GymDuo and unlock partner discount: ${link}`;
                            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
                          }}
                        >
                          Send via WhatsApp
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCreateInvite}
                      disabled={creatingInvite}
                    >
                      {creatingInvite ? <Loader2 className="h-4 w-4 animate-spin" /> : "Get invite code"}
                    </Button>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Discount code */}
        <Card className="glass-card">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Have a promo code?</span>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Enter code"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value)}
                className="uppercase"
              />
            </div>
          </CardContent>
        </Card>

        {/* Checkout CTA */}
        <Card className="glass-card border-primary/30">
          <CardContent className="pt-6">
            <Button
              className="w-full h-12 text-base"
              size="lg"
              onClick={handleCheckout}
              disabled={checkingOut || !paymentsEnabled}
            >
              {checkingOut ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : !paymentsEnabled ? (
                "Payments not available yet"
              ) : (
                <>
                  Proceed to checkout
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground mt-3">
              {paymentsEnabled ? "You’ll complete payment on the next screen" : "Payments are not available yet."}
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default function JoinGymPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      }
    >
      <JoinContent />
    </Suspense>
  );
}
