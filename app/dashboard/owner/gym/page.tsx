"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Loader2, Sparkles, ShieldCheck } from "lucide-react";
import { fetchJson } from "@/lib/client-fetch";

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
    }) => { open: () => void };
  }
}

export default function OwnerGymPage() {
  const { toast } = useToast();
  const [gyms, setGyms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    address: "",
    latitude: "",
    longitude: "",
    openTime: "",
    closeTime: "",
    openDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT"] as string[],
    dayPassPrice: "",
    monthlyPrice: "",
    quarterlyPrice: "",
    yearlyPrice: "",
  });
  const [saving, setSaving] = useState(false);
  const [featuring, setFeaturing] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchJson<{ gyms?: any[]; error?: string }>("/api/owner/gym", { retries: 1 })
      .then((result) => {
        if (!active) return;
        if (!result.ok) {
          setGyms([]);
          setError(result.error ?? "Failed to load gyms");
          return;
        }
        setGyms(result.data?.gyms ?? []);
      })
      .catch(() => {
        if (!active) return;
        setGyms([]);
        setError("Failed to load gyms");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await fetchJson<{ gym?: any; error?: string }>("/api/owner/gym", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          address: form.address,
          latitude: parseFloat(form.latitude) || 28.6139,
          longitude: parseFloat(form.longitude) || 77.209,
          openTime: form.openTime || null,
          closeTime: form.closeTime || null,
          openDays: form.openDays.length > 0 ? form.openDays.join(",") : null,
          dayPassPrice: form.dayPassPrice ? Math.round(parseFloat(form.dayPassPrice) * 100) : null,
          monthlyPrice: Math.round(parseFloat(form.monthlyPrice) * 100) || 29900,
          quarterlyPrice: form.quarterlyPrice ? Math.round(parseFloat(form.quarterlyPrice) * 100) : null,
          yearlyPrice: Math.round(parseFloat(form.yearlyPrice) * 100) || 299000,
        }),
        retries: 1,
      });
      if (!result.ok) {
        toast({ title: "Error", description: result.error ?? "Failed", variant: "destructive" });
        setSaving(false);
        return;
      }
      const createdGym = result.data?.gym;
      toast({ title: "Gym added", description: createdGym?.name });
      if (createdGym) {
        setGyms((prev) => [createdGym, ...prev]);
      }
      setForm({
        name: "",
        address: "",
        latitude: "",
        longitude: "",
        openTime: "",
        closeTime: "",
        openDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
        dayPassPrice: "",
        monthlyPrice: "",
        quarterlyPrice: "",
        yearlyPrice: "",
      });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="p-6">
        <Skeleton className="h-64 rounded-2xl" />
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
          <MapPin className="h-6 w-6" />
          Gym
        </h1>
        <p className="text-muted-foreground text-sm">Add or manage your gym.</p>
      </motion.div>

      {error && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Unable to load gyms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{error}</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild variant="outline">
                <Link href="/auth/login?callbackUrl=/dashboard/owner/gym">Re-authenticate</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Add gym</CardTitle>
          <CardDescription>Prices in ₹ (will be stored in paise).</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Gold's Gym – Saket"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={form.address}
                  onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                  placeholder="Address"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Latitude</Label>
                <Input
                  type="number"
                  step="any"
                  value={form.latitude}
                  onChange={(e) => setForm((p) => ({ ...p, latitude: e.target.value }))}
                  placeholder="28.6139"
                />
              </div>
              <div className="space-y-2">
                <Label>Longitude</Label>
                <Input
                  type="number"
                  step="any"
                  value={form.longitude}
                  onChange={(e) => setForm((p) => ({ ...p, longitude: e.target.value }))}
                  placeholder="77.209"
                />
              </div>
              <div className="space-y-2">
                <Label>Opening time</Label>
                <Input
                  type="time"
                  value={form.openTime}
                  onChange={(e) => setForm((p) => ({ ...p, openTime: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Closing time</Label>
                <Input
                  type="time"
                  value={form.closeTime}
                  onChange={(e) => setForm((p) => ({ ...p, closeTime: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Open days</Label>
                <div className="flex flex-wrap gap-2">
                  {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          openDays: p.openDays.includes(day)
                            ? p.openDays.filter((d) => d !== day)
                            : [...p.openDays, day],
                        }))
                      }
                      className={`rounded-full border px-3 py-1 text-xs ${
                        form.openDays.includes(day)
                          ? "border-primary/60 bg-primary/10 text-primary"
                          : "border-white/10 text-muted-foreground"
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Day pass price (₹) — optional</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={form.dayPassPrice}
                  onChange={(e) => setForm((p) => ({ ...p, dayPassPrice: e.target.value }))}
                  placeholder="99"
                />
              </div>
              <div className="space-y-2">
                <Label>Monthly price (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={form.monthlyPrice}
                  onChange={(e) => setForm((p) => ({ ...p, monthlyPrice: e.target.value }))}
                  placeholder="299"
                />
              </div>
              <div className="space-y-2">
                <Label>Quarterly price (₹) — optional, auto-calculated if blank</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={form.quarterlyPrice}
                  onChange={(e) => setForm((p) => ({ ...p, quarterlyPrice: e.target.value }))}
                  placeholder="807 (≈10% off)"
                />
              </div>
              <div className="space-y-2">
                <Label>Yearly price (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={form.yearlyPrice}
                  onChange={(e) => setForm((p) => ({ ...p, yearlyPrice: e.target.value }))}
                  placeholder="2990"
                />
              </div>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add gym"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {gyms.length > 0 && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Your gyms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {gyms.map((g) => (
              <div key={g.id} className="flex items-center justify-between py-2 border-b border-white/10 last:border-0">
                <div>
                  <p className="font-medium">{g.name}</p>
                  <p className="text-sm text-muted-foreground">{g.address}</p>
                  {g.featuredUntil && new Date(g.featuredUntil).getTime() > Date.now() && (
                    <div className="mt-1 inline-flex items-center gap-1 text-xs text-primary">
                      <Sparkles className="h-3 w-3" />
                      Featured until {new Date(g.featuredUntil).toLocaleDateString()}
                    </div>
                  )}
                  {g.verifiedUntil && new Date(g.verifiedUntil).getTime() > Date.now() && (
                    <div className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-400">
                      <ShieldCheck className="h-3 w-3" />
                      Verified until {new Date(g.verifiedUntil).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={featuring === g.id}
                    onClick={async () => {
                      setFeaturing(g.id);
                      try {
                        const result = await fetchJson<{
                          amount: number;
                          currency?: string;
                          orderId: string;
                          error?: string;
                        }>("/api/owner/gym/feature", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ gymId: g.id }),
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
                        const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
                        if (!key || key === "XXXXX") {
                          toast({ title: "Payments unavailable", description: "Missing Razorpay key", variant: "destructive" });
                          setFeaturing(null);
                          return;
                        }
                        if (typeof window.Razorpay === "undefined") {
                          const script = document.createElement("script");
                          script.src = "https://checkout.razorpay.com/v1/checkout.js";
                          script.async = true;
                          document.body.appendChild(script);
                          await new Promise((r) => (script.onload = r));
                        }
                        const rzp = new window.Razorpay!({
                          key,
                          amount: result.data?.amount ?? 0,
                          currency: result.data?.currency ?? "INR",
                          name: "GYMDUO",
                          order_id: result.data?.orderId ?? "",
                          handler: async (res) => {
                            const verifyResult = await fetchJson<{
                              featuredUntil?: string;
                              error?: string;
                            }>("/api/owner/gym/feature/verify", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                gymId: g.id,
                                orderId: res.razorpay_order_id,
                                paymentId: res.razorpay_payment_id,
                                signature: res.razorpay_signature,
                              }),
                              retries: 1,
                            });
                            if (verifyResult.ok) {
                              toast({ title: "Featured activated", description: "Your gym is now featured for 3 days." });
                              setGyms((prev) =>
                                prev.map((gym) =>
                                  gym.id === g.id
                                    ? { ...gym, featuredUntil: verifyResult.data?.featuredUntil }
                                    : gym
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
                        rzp.open();
                      } catch {
                        toast({ title: "Error", variant: "destructive" });
                      }
                      setFeaturing(null);
                    }}
                  >
                    {featuring === g.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Feature ₹99 / 3 days"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={verifying === g.id}
                    onClick={async () => {
                      setVerifying(g.id);
                      try {
                        const result = await fetchJson<{
                          amount: number;
                          currency?: string;
                          orderId: string;
                          error?: string;
                        }>("/api/owner/gym/verify", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ gymId: g.id }),
                          retries: 1,
                        });
                        if (!result.ok) {
                          toast({
                            title: "Error",
                            description: result.error ?? "Failed to start payment",
                            variant: "destructive",
                          });
                          setVerifying(null);
                          return;
                        }
                        const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
                        if (!key || key === "XXXXX") {
                          toast({ title: "Payments unavailable", description: "Missing Razorpay key", variant: "destructive" });
                          setVerifying(null);
                          return;
                        }
                        if (typeof window.Razorpay === "undefined") {
                          const script = document.createElement("script");
                          script.src = "https://checkout.razorpay.com/v1/checkout.js";
                          script.async = true;
                          document.body.appendChild(script);
                          await new Promise((r) => (script.onload = r));
                        }
                        const rzp = new window.Razorpay!({
                          key,
                          amount: result.data?.amount ?? 0,
                          currency: result.data?.currency ?? "INR",
                          name: "GYMDUO",
                          order_id: result.data?.orderId ?? "",
                          handler: async (res) => {
                            const verifyResult = await fetchJson<{
                              verifiedUntil?: string;
                              error?: string;
                            }>("/api/owner/gym/verify/verify", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                gymId: g.id,
                                orderId: res.razorpay_order_id,
                                paymentId: res.razorpay_payment_id,
                                signature: res.razorpay_signature,
                              }),
                              retries: 1,
                            });
                            if (verifyResult.ok) {
                              toast({ title: "Verified badge activated", description: "Your gym is verified for 30 days." });
                              setGyms((prev) =>
                                prev.map((gym) =>
                                  gym.id === g.id
                                    ? { ...gym, verifiedUntil: verifyResult.data?.verifiedUntil }
                                    : gym
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
                        rzp.open();
                      } catch {
                        toast({ title: "Error", variant: "destructive" });
                      }
                      setVerifying(null);
                    }}
                  >
                    {verifying === g.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify ₹99 / month"}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
