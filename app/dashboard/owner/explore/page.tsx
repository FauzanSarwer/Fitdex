"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { Loader2, MapPin, Image as ImageIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJson } from "@/lib/client-fetch";
import { buildGymSlug } from "@/lib/utils";
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
  const paymentsEnabled = isPaymentsEnabled() || isAdmin;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchJson<{ gyms?: any[]; error?: string }>("/api/owner/explore", { retries: 1 })
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

  const title = useMemo(() => "Owner explore", []);

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
            <CardTitle>Could not load gyms</CardTitle>
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
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MapPin className="h-6 w-6" />
          {title}
        </h1>
        <p className="text-muted-foreground text-sm">
          Manage your gyms and review competitors. Open your gym to edit it and see owner-only analytics.
        </p>
      </motion.div>

      {gyms.length === 0 ? (
        <Card className="glass-card p-12 text-center">
          <p className="text-muted-foreground">No gyms found.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {gyms.map((gym) => {
            const isOwner = gym.isOwner;
            const isVerified = gym.verificationStatus === "VERIFIED";
            return (
              <Card key={gym.id} className="glass-card overflow-hidden">
                <div className="relative h-36 bg-gradient-to-br from-primary/30 via-primary/10 to-accent/20">
                  {gym.coverImageUrl ? (
                    <img src={gym.coverImageUrl} alt={gym.name} className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <ImageIcon className="h-8 w-8" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3 flex items-center gap-2 text-[10px]">
                    <span className={`rounded-full px-2 py-0.5 ${isOwner ? "bg-primary/20 text-primary" : "bg-amber-500/20 text-amber-400"}`}>
                      {isOwner ? "Your gym" : "Competitor"}
                    </span>
                    {isVerified ? (
                      <span className="rounded-full bg-emerald-500/20 text-emerald-400 px-2 py-0.5">Verified</span>
                    ) : (
                      <span className="rounded-full bg-amber-500/20 text-amber-400 px-2 py-0.5">Unverified</span>
                    )}
                  </div>
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{gym.name}</CardTitle>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {gym.address}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isOwner && gym.stats ? (
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
                  ) : isOwner ? (
                    <div className="rounded-lg border border-white/10 px-3 py-2 text-xs text-muted-foreground flex items-center justify-between gap-2">
                      <span>Premium analytics available on paid plans.</span>
                      <Button size="sm" variant="outline" onClick={() => setUpsellGym(gym)}>
                        Unlock
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-white/10 px-3 py-2 text-xs text-muted-foreground space-y-2">
                      <div className="flex items-center justify-between">
                        <span>Competitor analytics</span>
                        <Button size="sm" variant="outline" onClick={() => setUpsellGym(gym)}>
                          Unlock
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-white/10 px-3 py-2">
                          <div className="text-sm font-semibold text-foreground">XXX</div>
                          Monthly sales
                        </div>
                        <div className="rounded-lg border border-white/10 px-3 py-2">
                          <div className="text-sm font-semibold text-foreground">XXX</div>
                          Page visits
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {isOwner ? (
                      <Button size="sm" variant="secondary" asChild>
                        <Link href={`/dashboard/owner/explore/${gym.id}`}>View your gym</Link>
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/explore/${buildGymSlug(gym.name, gym.id)}`}>View profile</Link>
                      </Button>
                    )}
                    {isOwner ? (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/explore/${buildGymSlug(gym.name, gym.id)}`}>See customer preview</Link>
                      </Button>
                    ) : null}
                    {isOwner ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!paymentsEnabled || featuring === gym.id}
                        onClick={async () => {
                          if (!paymentsEnabled) {
                            toast({ title: "Payments not available yet", description: "Please try again later." });
                            return;
                          }
                          setFeaturing(gym.id);
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
                              body: JSON.stringify({ gymId: gym.id }),
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
                                prev.map((g) =>
                                  g.id === gym.id ? { ...g, featuredUntil: result.data?.featuredUntil } : g
                                )
                              );
                              setFeaturing(null);
                              return;
                            }
                            const checkout = await openRazorpayCheckout({
                              orderId: result.data?.orderId ?? "",
                              amount: result.data?.amount ?? 0,
                              currency: result.data?.currency ?? "INR",
                              name: "FITDEX",
                              onSuccess: async (res) => {
                                const verifyResult = await fetchJson<{
                                  featuredUntil?: string;
                                  error?: string;
                                }>("/api/owner/gym/feature/verify", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    gymId: gym.id,
                                    orderId: res.razorpay_order_id,
                                    paymentId: res.razorpay_payment_id,
                                    signature: res.razorpay_signature,
                                  }),
                                  retries: 1,
                                });
                                if (verifyResult.ok) {
                                  toast({ title: "Boost activated", description: "Your gym is featured for 3 days." });
                                  setGyms((prev) =>
                                    prev.map((g) =>
                                      g.id === gym.id ? { ...g, featuredUntil: verifyResult.data?.featuredUntil } : g
                                    )
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
                        }}
                      >
                        {featuring === gym.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : paymentsEnabled ? (
                          "Boost ₹99 / 3 days"
                        ) : (
                          "Payments not available"
                        )}
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

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
