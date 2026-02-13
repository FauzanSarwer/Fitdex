"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Loader2, MapPin, Image as ImageIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJson } from "@/lib/client-fetch";
import { buildGymSlug, formatPrice } from "@/lib/utils";
import { isPaymentsEnabled, openRazorpayCheckout } from "@/lib/razorpay-checkout";
import { useToast } from "@/hooks/use-toast";

export default function OwnerExplorePage() {
  const { toast } = useToast();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role;
  const isAdmin = role === "ADMIN";
  const [gyms, setGyms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [featuring, setFeaturing] = useState<string | null>(null);
  const [upsellGym, setUpsellGym] = useState<any | null>(null);
  const [boostGym, setBoostGym] = useState<any | null>(null);
  const paymentsEnabled = isPaymentsEnabled() || isAdmin;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchJson<{ gyms?: any[]; error?: string }>("/api/owner/explore", {
      retries: 1,
      useCache: true,
      cacheKey: "owner-explore-gyms",
      cacheTtlMs: 20000,
    })
      .then((result) => {
        if (!active) return;
        if (!result.ok) {
          setError(result.error ?? "Failed to load gyms");
          setGyms([]);
          return;
        }
        setGyms(result.data?.gyms ?? []);
      })
      .catch(() => {
        if (!active) return;
        setError("Failed to load gyms");
        setGyms([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const startBoost = async (gymId: string) => {
    if (!paymentsEnabled) {
      toast({ title: "Payments not available yet", description: "Please try again later." });
      return;
    }
    setFeaturing(gymId);
    try {
      const result = await fetchJson<{
        amount: number;
        currency?: string;
        orderId: string;
        featuredUntil?: string;
        error?: string;
      }>("/api/owner/gym/feature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gymId }),
        retries: 1,
      });
      if (!result.ok) {
        toast({
          title: "Error",
          description: result.error ?? "Failed to start payment",
          variant: "destructive",
        });
        setFeaturing(null);
        return;
      }
      if (isAdmin && result.data?.featuredUntil) {
        toast({ title: "Boost activated", description: "Admin access applied." });
        setGyms((prev) =>
          prev.map((gym) => (gym.id === gymId ? { ...gym, featuredUntil: result.data?.featuredUntil } : gym))
        );
        setFeaturing(null);
        return;
      }
      const checkout = await openRazorpayCheckout({
        orderId: result.data?.orderId ?? "",
        amount: result.data?.amount ?? 0,
        currency: result.data?.currency ?? "INR",
        name: "Fitdex",
        onSuccess: async (res) => {
          const verifyResult = await fetchJson<{
            featuredUntil?: string;
            error?: string;
          }>("/api/owner/gym/feature/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              gymId,
              orderId: res.razorpay_order_id,
              paymentId: res.razorpay_payment_id,
              signature: res.razorpay_signature,
            }),
            retries: 1,
          });
          if (verifyResult.ok) {
            toast({ title: "Boost activated", description: "Your gym is featured for 3 days." });
            setGyms((prev) =>
              prev.map((gym) => (gym.id === gymId ? { ...gym, featuredUntil: verifyResult.data?.featuredUntil } : gym))
            );
          } else {
            toast({
              title: "Verification failed",
              description: verifyResult.error ?? "Payment failed",
              variant: "destructive",
            });
          }
        },
      });
      if (!checkout.ok && checkout.error && checkout.error !== "DISMISSED") {
        const message = checkout.error === "PAYMENTS_DISABLED" ? "Payments not available yet" : checkout.error;
        toast({ title: "Payments unavailable", description: message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
    setFeaturing(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Owner explore</h1>
          <p className="text-sm text-muted-foreground">
            Benchmark your offers, spot gaps, and boost visibility when you want extra demand.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/explore">View public explore</Link>
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <Card className="glass-card border border-white/10 p-6">
          <CardHeader className="pb-2">
            <CardTitle>Unable to load explore</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </CardContent>
        </Card>
      ) : gyms.length === 0 ? (
        <Card className="glass-card border border-white/10 p-10 text-center">
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">No gyms listed yet. Add your first gym to see insights.</p>
            <Button asChild>
              <Link href="/dashboard/owner/gym">Add your gym</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {gyms.map((gym) => {
            const isOwnerGym = !!gym.isOwner;
            const hasStats = !!gym.stats;
            const hasDuo = (gym.partnerDiscountPercent ?? 0) > 0;
            const images = (gym.imageUrls ?? []).length > 0
              ? (gym.imageUrls ?? [])
              : gym.coverImageUrl
                ? [gym.coverImageUrl]
                : [];
            return (
              <Card key={gym.id} className="glass-card border border-white/10">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{gym.name}</CardTitle>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span>{gym.address ?? "Address not shared"}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {gym.featuredUntil ? (
                        <span className="text-[10px] uppercase tracking-wide rounded-full bg-primary/20 text-primary px-2 py-0.5">
                          Featured
                        </span>
                      ) : null}
                      {gym.verificationStatus === "VERIFIED" ? (
                        <span className="text-[10px] uppercase tracking-wide rounded-full bg-emerald-500/20 text-emerald-300 px-2 py-0.5">
                          Verified
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase tracking-wide rounded-full bg-slate-500/20 text-slate-300 px-2 py-0.5">
                          Listed
                        </span>
                      )}
                      {hasDuo && (
                        <span className="text-[10px] uppercase tracking-wide rounded-full bg-indigo-500/20 text-indigo-200 px-2 py-0.5">
                          Duo {gym.partnerDiscountPercent}%
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-16 w-24 overflow-hidden rounded-lg border border-white/10 bg-white/5 flex items-center justify-center">
                      {images[0] ? (
                        <img src={images[0]} alt={gym.name} className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>{gym.openDays ? `Open ${gym.openDays}` : "Hours coming soon"}</p>
                      <p>
                        {gym.monthlyPrice ? `Monthly from ${formatPrice(gym.monthlyPrice)}` : "Pricing not shared"}
                      </p>
                    </div>
                  </div>

                  {isOwnerGym ? (
                    hasStats ? (
                      <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                        <div className="rounded-lg border border-white/10 px-3 py-2">
                          <div className="text-sm font-semibold text-foreground">{gym.stats.membersJoined}</div>
                          Members joined
                        </div>
                        <div className="rounded-lg border border-white/10 px-3 py-2">
                          <div className="text-sm font-semibold text-foreground">{gym.stats.pageViews}</div>
                          Page visits
                        </div>
                      </div>
                    ) : (
                      <div className="relative overflow-hidden rounded-lg border border-white/10 px-3 py-3 text-xs text-muted-foreground">
                        <div className="grid grid-cols-2 gap-3 blur-[3px]">
                          <div className="rounded-lg border border-white/10 px-3 py-2">
                            <div className="text-sm font-semibold text-foreground">XXX</div>
                            Members joined
                          </div>
                          <div className="rounded-lg border border-white/10 px-3 py-2">
                            <div className="text-sm font-semibold text-foreground">XXX</div>
                            Page visits
                          </div>
                        </div>
                        <div className="absolute inset-0 flex items-center justify-between gap-3 bg-background/70 px-3 backdrop-blur-sm">
                          <div>
                            <p className="text-xs font-semibold text-foreground">Premium analytics</p>
                            <p className="text-[11px] text-muted-foreground">
                              Benchmark vs nearby gyms and spot demand shifts.
                            </p>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => setUpsellGym(gym)}>
                            Unlock insights
                          </Button>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="rounded-lg border border-white/10 px-3 py-3 text-xs text-muted-foreground">
                      Competitor analytics are available with premium insights.
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {isOwnerGym ? (
                      <Button size="sm" variant="secondary" asChild>
                        <Link href={`/dashboard/owner/explore/${gym.id}`}>View your gym</Link>
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/explore/${buildGymSlug(gym.name, gym.id)}`}>View profile</Link>
                      </Button>
                    )}
                    {isOwnerGym ? (
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/dashboard/owner/explore/${gym.id}`}>Match pricing</Link>
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setUpsellGym(gym)}>
                        Compare pricing
                      </Button>
                    )}
                    {isOwnerGym ? (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/explore/${buildGymSlug(gym.name, gym.id)}`}>See customer preview</Link>
                      </Button>
                    ) : null}
                    {isOwnerGym ? (
                      <Button
                        size="sm"
                        className="bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-glow"
                        disabled={!paymentsEnabled || featuring === gym.id}
                        onClick={() => setBoostGym(gym)}
                      >
                        {featuring === gym.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Boost for ₹99"}
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!boostGym} onOpenChange={(open) => !open && setBoostGym(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Boost visibility for ₹99</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Get top placement in Explore for 3 days. Best for launch weeks, events, and new offers.</p>
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs">{boostGym?.name}</div>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setBoostGym(null)}>
              Not now
            </Button>
            <Button
              className="bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-glow"
              disabled={!boostGym || featuring === boostGym?.id}
              onClick={async () => {
                if (!boostGym) return;
                await startBoost(boostGym.id);
                setBoostGym(null);
              }}
            >
              {featuring === boostGym?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Boost now"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!upsellGym} onOpenChange={(open) => !open && setUpsellGym(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Unlock premium analytics</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              See competitor performance, sales insights, and member trends for {upsellGym?.name ?? "this gym"}.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-white/10 p-4">
                <div className="text-sm font-semibold">Starter</div>
                <div className="text-2xl font-bold text-primary">₹1,499</div>
                <div className="text-xs text-muted-foreground">per month</div>
              </div>
              <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
                <div className="text-sm font-semibold">Pro</div>
                <div className="text-2xl font-bold text-primary">₹1,999</div>
                <div className="text-xs text-muted-foreground">per month</div>
              </div>
            </div>
            <Button asChild className="w-full">
              <Link href="/owners">Buy premium analytics</Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
