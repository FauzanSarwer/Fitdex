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
import { isPaymentsEnabled, openRazorpayCheckout } from "@/lib/razorpay-checkout";

export default function OwnerGymPage() {
  const { toast } = useToast();
  const MAX_UPLOAD_BYTES = 500 * 1024;
  const [gyms, setGyms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    address: "",
    coverImageUrl: "",
    openTime: "",
    closeTime: "",
    openDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT"] as string[],
    dayPassPrice: "",
    monthlyPrice: "",
    quarterlyPrice: "",
    yearlyPrice: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [featuring, setFeaturing] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const paymentsEnabled = isPaymentsEnabled();

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
          coverImageUrl: form.coverImageUrl,
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
        coverImageUrl: "",
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
                <Label>Gym photo (required)</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (!file.type.startsWith("image/")) {
                      toast({ title: "Invalid file", description: "Only image files are allowed.", variant: "destructive" });
                      return;
                    }
                    if (file.size > MAX_UPLOAD_BYTES) {
                      toast({ title: "File too large", description: "Image must be 500KB or less.", variant: "destructive" });
                      return;
                    }
                    setUploading(true);
                    try {
                      const sigResult = await fetchJson<{
                        signature?: string;
                        timestamp?: number;
                        cloudName?: string;
                        apiKey?: string;
                        folder?: string;
                        error?: string;
                      }>("/api/uploads/signature", { retries: 1 });
                      if (!sigResult.ok || !sigResult.data?.signature || !sigResult.data.cloudName) {
                        toast({ title: "Upload failed", description: sigResult.error ?? "Missing upload config", variant: "destructive" });
                        setUploading(false);
                        return;
                      }
                      if (!sigResult.data.apiKey || !sigResult.data.timestamp) {
                        toast({ title: "Upload failed", description: "Upload configuration incomplete.", variant: "destructive" });
                        setUploading(false);
                        return;
                      }
                      const formData = new FormData();
                      formData.append("file", file);
                      formData.append("api_key", sigResult.data.apiKey ?? "");
                      formData.append("timestamp", String(sigResult.data.timestamp));
                      formData.append("signature", sigResult.data.signature);
                      if (sigResult.data.folder) formData.append("folder", sigResult.data.folder);
                      const uploadRes = await fetch(
                        `https://api.cloudinary.com/v1_1/${sigResult.data.cloudName}/image/upload`,
                        { method: "POST", body: formData }
                      );
                      const uploadJson = await uploadRes.json();
                      if (!uploadRes.ok || !uploadJson.secure_url) {
                        toast({ title: "Upload failed", description: "Could not upload image", variant: "destructive" });
                        setUploading(false);
                        return;
                      }
                      setForm((p) => ({ ...p, coverImageUrl: uploadJson.secure_url }));
                    } catch {
                      toast({ title: "Upload failed", variant: "destructive" });
                    }
                    setUploading(false);
                  }}
                  required={!form.coverImageUrl}
                />
                {form.coverImageUrl && (
                  <div className="mt-2 overflow-hidden rounded-xl border border-white/10">
                    <img src={form.coverImageUrl} alt="Gym cover" className="h-32 w-full object-cover" />
                  </div>
                )}
                {uploading && <p className="text-xs text-muted-foreground">Uploading image…</p>}
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
            <Button type="submit" disabled={saving || uploading}>
              {saving || uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add gym"}
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
                    disabled={!paymentsEnabled || featuring === g.id}
                    onClick={async () => {
                      if (!paymentsEnabled) {
                        toast({ title: "Payments not available yet", description: "Please try again later." });
                        return;
                      }
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
                        const checkout = await openRazorpayCheckout({
                          orderId: result.data?.orderId ?? "",
                          amount: result.data?.amount ?? 0,
                          currency: result.data?.currency ?? "INR",
                          name: "GYMDUO",
                          onSuccess: async (res) => {
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
                    {featuring === g.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : paymentsEnabled ? (
                      "Feature ₹99 / 3 days"
                    ) : (
                      "Payments not available yet"
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!paymentsEnabled || verifying === g.id}
                    onClick={async () => {
                      if (!paymentsEnabled) {
                        toast({ title: "Payments not available yet", description: "Please try again later." });
                        return;
                      }
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
                        const checkout = await openRazorpayCheckout({
                          orderId: result.data?.orderId ?? "",
                          amount: result.data?.amount ?? 0,
                          currency: result.data?.currency ?? "INR",
                          name: "GYMDUO",
                          onSuccess: async (res) => {
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
                        if (!checkout.ok && checkout.error && checkout.error !== "DISMISSED") {
                          const message = checkout.error === "PAYMENTS_DISABLED" ? "Payments not available yet" : checkout.error;
                          toast({ title: "Payments unavailable", description: message, variant: "destructive" });
                        }
                      } catch {
                        toast({ title: "Error", variant: "destructive" });
                      }
                      setVerifying(null);
                    }}
                  >
                    {verifying === g.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : paymentsEnabled ? (
                      "Verify ₹99 / month"
                    ) : (
                      "Payments not available yet"
                    )}
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
