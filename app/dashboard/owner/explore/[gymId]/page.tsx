"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { ArrowLeft, Clock, Loader2, MapPin, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJson } from "@/lib/client-fetch";
import { isPaymentsEnabled, openRazorpayCheckout } from "@/lib/razorpay-checkout";
import { buildGymSlug, formatPrice } from "@/lib/utils";
import { getGymOpenStatus } from "@/lib/gym-hours";
import { useToast } from "@/hooks/use-toast";

interface GymData {
  id: string;
  name: string;
  address: string;
  verificationStatus: string;
  coverImageUrl: string | null;
  imageUrls?: string[] | null;
  openTime?: string | null;
  closeTime?: string | null;
  openDays?: string | null;
  dayPassPrice?: number | null;
  monthlyPrice: number;
  quarterlyPrice: number;
  yearlyPrice: number;
  partnerDiscountPercent: number;
  quarterlyDiscountType: "PERCENT" | "FLAT";
  quarterlyDiscountValue: number;
  yearlyDiscountType: "PERCENT" | "FLAT";
  yearlyDiscountValue: number;
  welcomeDiscountType: "PERCENT" | "FLAT";
  welcomeDiscountValue: number;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  youtubeUrl?: string | null;
  featuredUntil?: string | Date | null;
  verifiedUntil?: string | Date | null;
  hasPremiumAccess?: boolean;
  stats?: { membersJoined: number; pageViews: number } | null;
  isOwner?: boolean;
}

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export default function OwnerGymProfilePage() {
  const params = useParams();
  const gymId = params.gymId as string;
  const { toast } = useToast();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role;
  const isAdmin = role === "ADMIN";
  const [gym, setGym] = useState<GymData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [featuring, setFeaturing] = useState(false);
  const paymentsEnabled = isPaymentsEnabled() || isAdmin;
  const [editForm, setEditForm] = useState({
    name: "",
    address: "",
    imageUrls: ["", "", "", ""] as string[],
    instagramUrl: "",
    facebookUrl: "",
    youtubeUrl: "",
    openTime: "",
    closeTime: "",
    openDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT"] as string[],
    dayPassPrice: "",
    monthlyPrice: "",
    quarterlyPrice: "",
    yearlyPrice: "",
  });

  const toRupees = (value: number | null | undefined) =>
    value != null ? String(Math.round(value / 100)) : "";
  const toPaise = (value: string) => Math.round((parseFloat(value || "0") || 0) * 100);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchJson<{ gyms?: GymData[]; error?: string }>("/api/owner/explore", { retries: 1 })
      .then((result) => {
        if (!active) return;
        if (!result.ok) {
          setError(result.error ?? "Gym not found");
          setLoading(false);
          return;
        }
        const found = (result.data?.gyms ?? []).find((item) => item.id === gymId);
        if (!found || !found.isOwner) {
          setError("You do not have access to this gym.");
          setLoading(false);
          return;
        }
        setGym(found);
        const seedImages = (found.imageUrls ?? (found.coverImageUrl ? [found.coverImageUrl] : [])).slice(0, 4);
        const paddedImages = [...seedImages, "", "", "", ""].slice(0, 4);
        setEditForm({
          name: found.name ?? "",
          address: found.address ?? "",
          imageUrls: paddedImages,
          instagramUrl: found.instagramUrl ?? "",
          facebookUrl: found.facebookUrl ?? "",
          youtubeUrl: found.youtubeUrl ?? "",
          openTime: found.openTime ?? "",
          closeTime: found.closeTime ?? "",
          openDays: found.openDays ? String(found.openDays).split(",") : ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
          dayPassPrice: toRupees(found.dayPassPrice),
          monthlyPrice: toRupees(found.monthlyPrice),
          quarterlyPrice: toRupees(found.quarterlyPrice),
          yearlyPrice: toRupees(found.yearlyPrice),
        });
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError("Failed to load gym details");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [gymId]);

  const pricing = useMemo(() => {
    if (!gym) return [] as Array<{ label: string; price: number; note: string }>;
    const monthly = gym.monthlyPrice;
    const quarterly = gym.quarterlyPrice ?? Math.round(gym.monthlyPrice * 3 * 0.9);
    const yearly = gym.yearlyPrice;
    const yearlySavePercent = monthly > 0 ? Math.round(100 - (yearly / 12 / monthly) * 100) : 0;
    const quarterlySavePercent = monthly > 0 ? Math.round(100 - (quarterly / 3 / monthly) * 100) : 0;

    return [
      ...(gym.dayPassPrice && gym.dayPassPrice > 0
        ? [
            {
              label: "Day pass",
              price: gym.dayPassPrice,
              note: "One-day access",
            },
          ]
        : []),
      {
        label: "Monthly",
        price: monthly,
        note: "Pay as you go",
      },
      {
        label: "Quarterly",
        price: quarterly,
        note: quarterlySavePercent ? `Save ${quarterlySavePercent}%` : "Best for 3 months",
      },
      {
        label: "Yearly",
        price: yearly,
        note: yearlySavePercent ? `Save ${yearlySavePercent}%` : "Best value",
      },
    ];
  }, [gym]);

  const formatDiscount = (type: "PERCENT" | "FLAT", value: number) => {
    if (!value || value <= 0) return "0";
    return type === "PERCENT" ? `${value}%` : formatPrice(value);
  };

  const uploadImage = async (file: File, index: number) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Only image files are allowed.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast({ title: "File too large", description: "Image must be 2MB or less.", variant: "destructive" });
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
        toast({
          title: "Upload failed",
          description: uploadJson?.error?.message ?? "Could not upload image",
          variant: "destructive",
        });
        setUploading(false);
        return;
      }
      setEditForm((p) => {
        const next = [...p.imageUrls];
        next[index] = uploadJson.secure_url;
        return { ...p, imageUrls: next };
      });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    }
    setUploading(false);
  };

  const moveImage = (from: number, to: number) => {
    setEditForm((p) => {
      const next = [...p.imageUrls];
      const target = next[from];
      next[from] = next[to];
      next[to] = target;
      return { ...p, imageUrls: next };
    });
  };

  const clearImage = (index: number) => {
    setEditForm((p) => {
      const next = [...p.imageUrls];
      next[index] = "";
      return { ...p, imageUrls: next };
    });
  };

  const handleSave = async () => {
    if (!gym?.id) return;
    if (!editForm.imageUrls[0]) {
      toast({ title: "Add a primary image", description: "At least one gym image is required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const result = await fetchJson<{ gym?: GymData; error?: string }>("/api/owner/gym", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymId: gym.id,
          name: editForm.name,
          address: editForm.address,
          imageUrls: editForm.imageUrls,
          instagramUrl: editForm.instagramUrl,
          facebookUrl: editForm.facebookUrl,
          youtubeUrl: editForm.youtubeUrl,
          openTime: editForm.openTime || null,
          closeTime: editForm.closeTime || null,
          openDays: editForm.openDays.length > 0 ? editForm.openDays.join(",") : null,
          dayPassPrice: editForm.dayPassPrice ? toPaise(editForm.dayPassPrice) : null,
          monthlyPrice: toPaise(editForm.monthlyPrice) || undefined,
          quarterlyPrice: editForm.quarterlyPrice ? toPaise(editForm.quarterlyPrice) : null,
          yearlyPrice: toPaise(editForm.yearlyPrice) || undefined,
        }),
        retries: 1,
      });
      if (!result.ok) {
        toast({ title: "Error", description: result.error ?? "Failed to save", variant: "destructive" });
        setSaving(false);
        return;
      }
      if (result.data?.gym) {
        setGym((prev) => (prev ? { ...prev, ...result.data?.gym } : prev));
      }
      toast({ title: "Gym updated" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-10">
        <Skeleton className="h-72 rounded-3xl mb-6" />
        <Skeleton className="h-40 rounded-3xl" />
      </div>
    );
  }

  if (error || !gym) {
    return (
      <div className="container mx-auto px-4 py-10">
        <Card className="glass-card p-10 text-center">
          <CardHeader>
            <CardTitle>Unable to load gym</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{error ?? "Please try again."}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild variant="outline">
                <Link href="/dashboard/owner/explore">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to owner explore
                </Link>
              </Button>
              <Button onClick={() => window.location.reload()}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isVerified = gym.verificationStatus === "VERIFIED";

  return (
    <div className="container mx-auto px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost">
            <Link href="/dashboard/owner/explore">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Owner explore
            </Link>
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/explore/${buildGymSlug(gym.name, gym.id)}`}>See customer preview</Link>
            </Button>
            <Button
              variant="secondary"
              disabled={!paymentsEnabled || featuring}
              onClick={async () => {
                if (!paymentsEnabled) {
                  toast({ title: "Payments not available yet", description: "Please try again later." });
                  return;
                }
                setFeaturing(true);
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
                    setFeaturing(false);
                    return;
                  }
                  if (isAdmin && result.data?.featuredUntil) {
                    toast({ title: "Boost activated", description: "Admin access applied." });
                    setGym((prev) => (prev ? { ...prev, featuredUntil: result.data?.featuredUntil } : prev));
                    setFeaturing(false);
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
                        setGym((prev) => (prev ? { ...prev, featuredUntil: verifyResult.data?.featuredUntil } : prev));
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
                setFeaturing(false);
              }}
            >
              {featuring ? <Loader2 className="h-4 w-4 animate-spin" /> : "Boost ₹99 / 3 days"}
            </Button>
          </div>
        </div>

        <Card className="glass-card overflow-hidden border-primary/20">
          <div className="relative h-60 bg-gradient-to-br from-primary/30 via-primary/10 to-accent/20 flex items-center justify-center">
            {gym.coverImageUrl ? (
              <img
                src={gym.coverImageUrl}
                alt={gym.name}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="text-center text-primary/80">
                <Sparkles className="mx-auto h-14 w-14" />
                <p className="text-sm">Gym photo coming soon</p>
              </div>
            )}
            <div className="absolute top-4 right-4 flex items-center gap-2">
              {gym.featuredUntil && new Date(gym.featuredUntil).getTime() > Date.now() && (
                <span className="rounded-full bg-primary/20 text-primary px-3 py-1 text-xs">Featured</span>
              )}
              {isVerified ? (
                <span className="rounded-full bg-emerald-500/20 text-emerald-400 px-3 py-1 text-xs">Verified</span>
              ) : (
                <span className="rounded-full bg-amber-500/20 text-amber-400 px-3 py-1 text-xs">Unverified</span>
              )}
            </div>
          </div>
          <CardHeader className="space-y-2">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold">{gym.name}</h1>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {gym.address}
                </p>
                <p className={`text-xs mt-2 ${getGymOpenStatus({ ...gym, useIst: true }).isOpen ? "text-emerald-400" : "text-muted-foreground"}`}>
                  {getGymOpenStatus({ ...gym, useIst: true }).label}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button size="lg" variant="outline" asChild>
                  <Link href={`/explore/${buildGymSlug(gym.name, gym.id)}`}>Customer preview</Link>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3">
              <ShieldCheck className={`h-6 w-6 ${isVerified ? "text-primary" : "text-muted-foreground"}`} />
              <div>
                <div className="text-sm font-medium">{isVerified ? "Verified partner" : "Unverified gym"}</div>
                <div className="text-xs text-muted-foreground">
                  {isVerified ? "Secure payments & support" : "Verification pending."}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-primary" />
              <div>
                <div className="text-sm font-medium">Duo discount</div>
                <div className="text-xs text-muted-foreground">Up to {gym.partnerDiscountPercent}% off</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-6 w-6 text-primary" />
              <div>
                <div className="text-sm font-medium">Instant access</div>
                <div className="text-xs text-muted-foreground">Activate membership in minutes</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            {gym.stats ? (
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Owner analytics</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2 text-sm text-muted-foreground">
                  <div className="rounded-lg border border-white/10 px-4 py-3">
                    <div className="text-lg font-semibold text-foreground">{gym.stats.membersJoined}</div>
                    Members joined
                  </div>
                  <div className="rounded-lg border border-white/10 px-4 py-3">
                    <div className="text-lg font-semibold text-foreground">{gym.stats.pageViews}</div>
                    Page visits
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Owner analytics</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Upgrade to a paid plan to unlock premium analytics for your gym.
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              {pricing.map((p) => (
                <Card key={p.label} className="glass-card hover:border-primary/30 transition-all duration-300 hover:-translate-y-1">
                  <CardHeader>
                    <CardTitle>{p.label}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-2xl font-bold text-primary">
                      {formatPrice(p.price)}
                    </div>
                    <div className="text-sm text-muted-foreground">{p.note}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Discounts & perks</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 text-sm text-muted-foreground">
                <div>Welcome discount: up to {formatDiscount(gym.welcomeDiscountType, gym.welcomeDiscountValue)}</div>
                <div>Yearly discount: up to {formatDiscount(gym.yearlyDiscountType, gym.yearlyDiscountValue)}</div>
                <div>Quarterly discount: up to {formatDiscount(gym.quarterlyDiscountType, gym.quarterlyDiscountValue)}</div>
              </CardContent>
            </Card>
          </div>

          <Card className="glass-card h-fit">
            <CardHeader>
              <CardTitle>Edit gym details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input value={editForm.address} onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Gym images (1 required, max 4)</Label>
                <div className="grid gap-3">
                  {editForm.imageUrls.map((url, index) => (
                    <div key={index} className="rounded-lg border border-white/10 p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Priority {index + 1}</span>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={index === 0}
                            onClick={() => moveImage(index, index - 1)}
                          >
                            Up
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={index === editForm.imageUrls.length - 1}
                            onClick={() => moveImage(index, index + 1)}
                          >
                            Down
                          </Button>
                          {url && (
                            <Button type="button" size="sm" variant="ghost" onClick={() => clearImage(index)}>
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadImage(file, index);
                        }}
                      />
                      {url && <img src={url} alt={`Gym ${index + 1}`} className="h-28 w-full rounded-lg object-cover" />}
                    </div>
                  ))}
                </div>
                {uploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Instagram (optional)</Label>
                  <Input
                    value={editForm.instagramUrl}
                    onChange={(e) => setEditForm((p) => ({ ...p, instagramUrl: e.target.value }))}
                    placeholder="https://instagram.com/yourgym"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Facebook (optional)</Label>
                  <Input
                    value={editForm.facebookUrl}
                    onChange={(e) => setEditForm((p) => ({ ...p, facebookUrl: e.target.value }))}
                    placeholder="https://facebook.com/yourgym"
                  />
                </div>
                <div className="space-y-2">
                  <Label>YouTube (optional)</Label>
                  <Input
                    value={editForm.youtubeUrl}
                    onChange={(e) => setEditForm((p) => ({ ...p, youtubeUrl: e.target.value }))}
                    placeholder="https://youtube.com/@yourgym"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Opening time</Label>
                  <Input type="time" value={editForm.openTime} onChange={(e) => setEditForm((p) => ({ ...p, openTime: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Closing time</Label>
                  <Input type="time" value={editForm.closeTime} onChange={(e) => setEditForm((p) => ({ ...p, closeTime: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Open days</Label>
                <div className="flex flex-wrap gap-2">
                  {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() =>
                        setEditForm((p) => ({
                          ...p,
                          openDays: p.openDays.includes(day)
                            ? p.openDays.filter((d) => d !== day)
                            : [...p.openDays, day],
                        }))
                      }
                      className={`rounded-full border px-3 py-1 text-xs ${
                        editForm.openDays.includes(day)
                          ? "border-primary/60 bg-primary/10 text-primary"
                          : "border-white/10 text-muted-foreground"
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Day pass price (₹)</Label>
                  <Input type="number" value={editForm.dayPassPrice} onChange={(e) => setEditForm((p) => ({ ...p, dayPassPrice: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Monthly price (₹)</Label>
                  <Input type="number" value={editForm.monthlyPrice} onChange={(e) => setEditForm((p) => ({ ...p, monthlyPrice: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Quarterly price (₹)</Label>
                  <Input type="number" value={editForm.quarterlyPrice} onChange={(e) => setEditForm((p) => ({ ...p, quarterlyPrice: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Yearly price (₹)</Label>
                  <Input type="number" value={editForm.yearlyPrice} onChange={(e) => setEditForm((p) => ({ ...p, yearlyPrice: e.target.value }))} />
                </div>
              </div>
              <Button onClick={handleSave} disabled={saving || uploading} className="w-full">
                {saving || uploading ? "Saving…" : "Save changes"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </div>
  );
}
