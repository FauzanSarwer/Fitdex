"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Loader2, Sparkles, ShieldCheck } from "lucide-react";
import { fetchJson } from "@/lib/client-fetch";
import { isPaymentsEnabled, openRazorpayCheckout } from "@/lib/razorpay-checkout";
import { AMENITY_OPTIONS } from "@/lib/amenities";

type GymFormState = {
  name: string;
  address: string;
  imageUrls: string[];
  instagramUrl: string;
  facebookUrl: string;
  youtubeUrl: string;
  openTime: string;
  closeTime: string;
  openDays: string[];
  dayPassPrice: string;
  monthlyPrice: string;
  quarterlyPrice: string;
  yearlyPrice: string;
  hasAC: boolean;
  amenities: string[];
  ownerConsent: boolean;
  invoiceTypeDefault: "GST" | "NON_GST" | "";
};

const emptyForm: GymFormState = {
  name: "",
  address: "",
  imageUrls: ["", "", "", ""],
  instagramUrl: "",
  facebookUrl: "",
  youtubeUrl: "",
  openTime: "",
  closeTime: "",
  openDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
  dayPassPrice: "",
  monthlyPrice: "",
  quarterlyPrice: "",
  yearlyPrice: "",
  hasAC: false,
  amenities: [],
  ownerConsent: false,
  invoiceTypeDefault: "",
};

export default function OwnerGymPage() {
  const { toast } = useToast();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role;
  const isAdmin = role === "ADMIN";
  const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
  const [gyms, setGyms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<GymFormState>(emptyForm);
  const [editForm, setEditForm] = useState<GymFormState>(emptyForm);
  const [selectedGymId, setSelectedGymId] = useState("");
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [featuring, setFeaturing] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [consentSaving, setConsentSaving] = useState(false);
  const [customAmenity, setCustomAmenity] = useState("");
  const [customEditAmenity, setCustomEditAmenity] = useState("");
  const [existingConsent, setExistingConsent] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [boostGym, setBoostGym] = useState<any | null>(null);
  const paymentsEnabled = isPaymentsEnabled() || isAdmin;

  const primaryGym = gyms[0];
  const onboardingSteps = [
    {
      label: "Create your first gym",
      done: gyms.length > 0,
    },
    {
      label: "Add pricing & hours",
      done: !!primaryGym?.monthlyPrice && !!primaryGym?.openTime && !!primaryGym?.closeTime,
    },
    {
      label: "Upload gym images",
      done: (primaryGym?.imageUrls?.length ?? 0) > 0 || !!primaryGym?.coverImageUrl,
    },
    {
      label: "Submit verification",
      done: !!primaryGym && primaryGym.verificationStatus !== "UNVERIFIED",
    },
    {
      label: "Owner consent recorded",
      done: !!primaryGym?.ownerConsentAt,
    },
  ];
  const completedSteps = onboardingSteps.filter((s) => s.done).length;
  const onboardingProgress = Math.round((completedSteps / onboardingSteps.length) * 100);

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
        const list = result.data?.gyms ?? [];
        setGyms(list);
        if (list.length > 0) {
          setSelectedGymId((prev) => prev || list[0].id);
        }
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

  useEffect(() => {
    if (!selectedGymId) return;
    const gym = gyms.find((g) => g.id === selectedGymId);
    if (!gym) return;
    const toRupees = (value?: number | null) => (value != null ? String(Math.round(value / 100)) : "");
    const openDays = typeof gym.openDays === "string" && gym.openDays.length > 0
      ? gym.openDays.split(",").map((d: string) => d.trim()).filter(Boolean)
      : ["MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const images = Array.isArray(gym.imageUrls) && gym.imageUrls.length > 0
      ? [...gym.imageUrls]
      : gym.coverImageUrl
        ? [gym.coverImageUrl]
        : [];
    const paddedImages = [...images, "", "", "", ""].slice(0, 4);
    setEditForm({
      name: gym.name ?? "",
      address: gym.address ?? "",
      imageUrls: paddedImages,
      instagramUrl: gym.instagramUrl ?? "",
      facebookUrl: gym.facebookUrl ?? "",
      youtubeUrl: gym.youtubeUrl ?? "",
      openTime: gym.openTime ?? "",
      closeTime: gym.closeTime ?? "",
      openDays,
      dayPassPrice: toRupees(gym.dayPassPrice),
      monthlyPrice: toRupees(gym.monthlyPrice),
      quarterlyPrice: toRupees(gym.quarterlyPrice),
      yearlyPrice: toRupees(gym.yearlyPrice),
      hasAC: !!gym.hasAC,
      amenities: Array.isArray(gym.amenities) ? gym.amenities : [],
      ownerConsent: !!gym.ownerConsentAt,
      invoiceTypeDefault: gym.invoiceTypeDefault ?? "",
    });
  }, [gyms, selectedGymId]);

  const uploadImage = async (file: File, index: number, target: "add" | "edit") => {
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
      const setter = target === "edit" ? setEditForm : setForm;
      setter((p) => {
        const next = [...p.imageUrls];
        next[index] = uploadJson.secure_url;
        return { ...p, imageUrls: next };
      });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    }
    setUploading(false);
  };

  const moveImage = (from: number, to: number, target: "add" | "edit") => {
    const setter = target === "edit" ? setEditForm : setForm;
    setter((p) => {
      const next = [...p.imageUrls];
      const target = next[from];
      next[from] = next[to];
      next[to] = target;
      return { ...p, imageUrls: next };
    });
  };

  const clearImage = (index: number, target: "add" | "edit") => {
    const setter = target === "edit" ? setEditForm : setForm;
    setter((p) => {
      const next = [...p.imageUrls];
      next[index] = "";
      return { ...p, imageUrls: next };
    });
  };

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
            toast({ title: "Boost activated", description: "Your gym is now featured for 3 days." });
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    if (!form.imageUrls[0]) {
      toast({ title: "Add a primary image", description: "At least one gym image is required.", variant: "destructive" });
      setSaving(false);
      return;
    }
    try {
      const result = await fetchJson<{ gym?: any; error?: string }>("/api/owner/gym", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          address: form.address,
          imageUrls: form.imageUrls,
          instagramUrl: form.instagramUrl,
          facebookUrl: form.facebookUrl,
          youtubeUrl: form.youtubeUrl,
          openTime: form.openTime || null,
          closeTime: form.closeTime || null,
          openDays: form.openDays.length > 0 ? form.openDays.join(",") : null,
          dayPassPrice: form.dayPassPrice ? Math.round(parseFloat(form.dayPassPrice) * 100) : null,
          monthlyPrice: Math.round(parseFloat(form.monthlyPrice) * 100) || 29900,
          quarterlyPrice: form.quarterlyPrice ? Math.round(parseFloat(form.quarterlyPrice) * 100) : null,
          yearlyPrice: Math.round(parseFloat(form.yearlyPrice) * 100) || 299000,
          hasAC: form.hasAC,
          amenities: form.amenities,
          ownerConsent: form.ownerConsent,
          invoiceTypeDefault: form.invoiceTypeDefault || null,
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
      setForm(emptyForm);
      setShowAddForm(false);
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
    setSaving(false);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGymId) return;
    setUpdating(true);
    if (!editForm.imageUrls[0]) {
      toast({ title: "Add a primary image", description: "At least one gym image is required.", variant: "destructive" });
      setUpdating(false);
      return;
    }
    try {
      const result = await fetchJson<{ gym?: any; error?: string }>("/api/owner/gym", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymId: selectedGymId,
          name: editForm.name,
          address: editForm.address,
          imageUrls: editForm.imageUrls,
          instagramUrl: editForm.instagramUrl,
          facebookUrl: editForm.facebookUrl,
          youtubeUrl: editForm.youtubeUrl,
          openTime: editForm.openTime || null,
          closeTime: editForm.closeTime || null,
          openDays: editForm.openDays.length > 0 ? editForm.openDays.join(",") : null,
          dayPassPrice: editForm.dayPassPrice ? Math.round(parseFloat(editForm.dayPassPrice) * 100) : null,
          monthlyPrice: Math.round(parseFloat(editForm.monthlyPrice) * 100) || 29900,
          quarterlyPrice: editForm.quarterlyPrice ? Math.round(parseFloat(editForm.quarterlyPrice) * 100) : null,
          yearlyPrice: Math.round(parseFloat(editForm.yearlyPrice) * 100) || 299000,
          hasAC: editForm.hasAC,
          amenities: editForm.amenities,
          invoiceTypeDefault: editForm.invoiceTypeDefault || null,
        }),
        retries: 1,
      });
      if (!result.ok) {
        toast({ title: "Error", description: result.error ?? "Failed", variant: "destructive" });
        setUpdating(false);
        return;
      }
      const updatedGym = result.data?.gym;
      toast({ title: "Gym updated", description: updatedGym?.name ?? "Changes saved" });
      if (updatedGym) {
        setGyms((prev) => prev.map((g) => (g.id === updatedGym.id ? updatedGym : g)));
      }
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
    setUpdating(false);
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

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Owner onboarding</CardTitle>
          <CardDescription>Complete these steps to go live and start receiving leads.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-semibold text-primary">{onboardingProgress}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/10">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-primary to-accent"
              style={{ width: `${onboardingProgress}%` }}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {onboardingSteps.map((step) => (
              <div
                key={step.label}
                className={`rounded-xl border px-4 py-3 text-sm ${
                  step.done
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                    : "border-white/10 text-muted-foreground"
                }`}
              >
                {step.done ? "✓" : "•"} {step.label}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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

      {gyms.length > 0 && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Edit gym</CardTitle>
            <CardDescription>Update your existing gym details.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Gym:</span>
                  <select
                    className="rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm"
                    value={selectedGymId}
                    onChange={(e) => setSelectedGymId(e.target.value)}
                  >
                    {gyms.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" disabled={updating || uploading}>
                  {updating || uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Gold's Gym – Saket"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input
                    value={editForm.address}
                    onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))}
                    placeholder="Address"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Amenities</Label>
                  <div className="flex flex-wrap gap-2">
                    {AMENITY_OPTIONS.map((option) => {
                      const active = editForm.amenities.includes(option.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            setEditForm((p) => {
                              const next = active
                                ? p.amenities.filter((item) => item !== option.value)
                                : [...p.amenities, option.value];
                              return { ...p, amenities: next };
                            })
                          }
                          className={`rounded-full border px-3 py-1 text-xs transition ${
                            active
                              ? "border-primary/40 bg-primary/20 text-primary"
                              : "border-white/10 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <span className="mr-1">{option.emoji}</span>
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={customEditAmenity}
                      onChange={(e) => setCustomEditAmenity(e.target.value)}
                      placeholder="Add custom amenity"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const trimmed = customEditAmenity.trim();
                        if (!trimmed) return;
                        setEditForm((p) =>
                          p.amenities.includes(trimmed)
                            ? p
                            : { ...p, amenities: [...p.amenities, trimmed] }
                        );
                        setCustomEditAmenity("");
                      }}
                    >
                      Add
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>AC available</Label>
                  <label className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2 text-sm text-muted-foreground">
                    <input
                      id="hasACEdit"
                      type="checkbox"
                      className="h-4 w-4 rounded border-white/20 bg-transparent accent-primary"
                      checked={editForm.hasAC}
                      onChange={(e) => setEditForm((p) => ({ ...p, hasAC: e.target.checked }))}
                    />
                    This gym has air conditioning
                  </label>
                </div>
                <div className="space-y-2">
                  <Label>Gym images (1 required, max 4)</Label>
                  <div className="grid gap-3 md:grid-cols-2">
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
                              onClick={() => moveImage(index, index - 1, "edit")}
                            >
                              Up
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={index === editForm.imageUrls.length - 1}
                              onClick={() => moveImage(index, index + 1, "edit")}
                            >
                              Down
                            </Button>
                            {url && (
                              <Button type="button" size="sm" variant="ghost" onClick={() => clearImage(index, "edit")}>
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
                            if (file) uploadImage(file, index, "edit");
                          }}
                          required={index === 0 && !editForm.imageUrls[0]}
                        />
                        {url && (
                          <div className="mt-2 overflow-hidden rounded-xl border border-white/10">
                            <img src={url} alt={`Gym ${index + 1}`} className="h-32 w-full object-cover" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {uploading && <p className="text-xs text-muted-foreground">Uploading image…</p>}
                </div>
                <div className="md:col-span-2 grid gap-4 md:grid-cols-3">
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
                <div className="space-y-2">
                  <Label>Opening time</Label>
                  <Input
                    type="time"
                    value={editForm.openTime}
                    onChange={(e) => setEditForm((p) => ({ ...p, openTime: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Closing time</Label>
                  <Input
                    type="time"
                    value={editForm.closeTime}
                    onChange={(e) => setEditForm((p) => ({ ...p, closeTime: e.target.value }))}
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
                <div className="space-y-2">
                  <Label>Day pass price (₹) — optional</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={editForm.dayPassPrice}
                    onChange={(e) => setEditForm((p) => ({ ...p, dayPassPrice: e.target.value }))}
                    placeholder="99"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Monthly price (₹)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={editForm.monthlyPrice}
                    onChange={(e) => setEditForm((p) => ({ ...p, monthlyPrice: e.target.value }))}
                    placeholder="299"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quarterly price (₹) — optional, auto-calculated if blank</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={editForm.quarterlyPrice}
                    onChange={(e) => setEditForm((p) => ({ ...p, quarterlyPrice: e.target.value }))}
                    placeholder="807 (≈10% off)"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Yearly price (₹)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={editForm.yearlyPrice}
                    onChange={(e) => setEditForm((p) => ({ ...p, yearlyPrice: e.target.value }))}
                    placeholder="2990"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default invoice type</Label>
                  <select
                    value={editForm.invoiceTypeDefault}
                    onChange={(e) => setEditForm((p) => ({ ...p, invoiceTypeDefault: e.target.value as "GST" | "NON_GST" | "" }))}
                    className="h-10 w-full rounded-md border border-white/10 bg-background px-3 text-sm"
                  >
                    <option value="">Select type</option>
                    <option value="GST">GST invoice</option>
                    <option value="NON_GST">Non-GST invoice</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Required for automatic invoice generation after payments.
                  </p>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Add new gym</h2>
        <Button type="button" variant="outline" onClick={() => setShowAddForm((prev) => !prev)}>
          {showAddForm ? "Hide" : "Add New Gym"}
        </Button>
      </div>

      {showAddForm && (
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
                  <Label>Amenities</Label>
                  <div className="flex flex-wrap gap-2">
                    {AMENITY_OPTIONS.map((option) => {
                      const active = form.amenities.includes(option.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            setForm((p) => {
                              const next = active
                                ? p.amenities.filter((item) => item !== option.value)
                                : [...p.amenities, option.value];
                              return { ...p, amenities: next };
                            })
                          }
                          className={`rounded-full border px-3 py-1 text-xs transition ${
                            active
                              ? "border-primary/40 bg-primary/20 text-primary"
                              : "border-white/10 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <span className="mr-1">{option.emoji}</span>
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={customAmenity}
                      onChange={(e) => setCustomAmenity(e.target.value)}
                      placeholder="Add custom amenity"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const trimmed = customAmenity.trim();
                        if (!trimmed) return;
                        setForm((p) =>
                          p.amenities.includes(trimmed)
                            ? p
                            : { ...p, amenities: [...p.amenities, trimmed] }
                        );
                        setCustomAmenity("");
                      }}
                    >
                      Add
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>AC available</Label>
                  <label className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2 text-sm text-muted-foreground">
                    <input
                      id="hasAC"
                      type="checkbox"
                      className="h-4 w-4 rounded border-white/20 bg-transparent accent-primary"
                      checked={form.hasAC}
                      onChange={(e) => setForm((p) => ({ ...p, hasAC: e.target.checked }))}
                    />
                    This gym has air conditioning
                  </label>
                </div>
                <div className="space-y-2">
                <Label>Gym images (1 required, max 4)</Label>
                  <div className="grid gap-3 md:grid-cols-2">
                  {form.imageUrls.map((url, index) => (
                    <div key={index} className="rounded-lg border border-white/10 p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Priority {index + 1}</span>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={index === 0}
                            onClick={() => moveImage(index, index - 1, "add")}
                          >
                            Up
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={index === form.imageUrls.length - 1}
                            onClick={() => moveImage(index, index + 1, "add")}
                          >
                            Down
                          </Button>
                          {url && (
                            <Button type="button" size="sm" variant="ghost" onClick={() => clearImage(index, "add")}>
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
                          if (file) uploadImage(file, index, "add");
                        }}
                        required={index === 0 && !form.imageUrls[0]}
                      />
                      {url && (
                        <div className="mt-2 overflow-hidden rounded-xl border border-white/10">
                          <img src={url} alt={`Gym ${index + 1}`} className="h-32 w-full object-cover" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {uploading && <p className="text-xs text-muted-foreground">Uploading image…</p>}
              </div>
              <div className="md:col-span-2 grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Instagram (optional)</Label>
                  <Input
                    value={form.instagramUrl}
                    onChange={(e) => setForm((p) => ({ ...p, instagramUrl: e.target.value }))}
                    placeholder="https://instagram.com/yourgym"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Facebook (optional)</Label>
                  <Input
                    value={form.facebookUrl}
                    onChange={(e) => setForm((p) => ({ ...p, facebookUrl: e.target.value }))}
                    placeholder="https://facebook.com/yourgym"
                  />
                </div>
                <div className="space-y-2">
                  <Label>YouTube (optional)</Label>
                  <Input
                    value={form.youtubeUrl}
                    onChange={(e) => setForm((p) => ({ ...p, youtubeUrl: e.target.value }))}
                    placeholder="https://youtube.com/@yourgym"
                  />
                </div>
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
              <div className="space-y-2">
                <Label>Default invoice type</Label>
                <select
                  value={form.invoiceTypeDefault}
                  onChange={(e) => setForm((p) => ({ ...p, invoiceTypeDefault: e.target.value as "GST" | "NON_GST" | "" }))}
                  className="h-10 w-full rounded-md border border-white/10 bg-background px-3 text-sm"
                >
                  <option value="">Select type</option>
                  <option value="GST">GST invoice</option>
                  <option value="NON_GST">Non-GST invoice</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Required for automatic invoice generation after payments.
                </p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-start gap-2">
                  <input
                    id="ownerConsent"
                    type="checkbox"
                    checked={form.ownerConsent}
                    onChange={(e) => setForm((p) => ({ ...p, ownerConsent: e.target.checked }))}
                    required
                  />
                  <Label htmlFor="ownerConsent" className="text-sm text-muted-foreground">
                    I confirm I have the owner’s consent to list this gym on Fitdex and accept all platform terms.
                  </Label>
                </div>
              </div>
            </div>
            <Button type="submit" disabled={saving || uploading}>
              {saving || uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add gym"}
            </Button>
          </form>
        </CardContent>
      </Card>
      )}

      {primaryGym && !primaryGym.ownerConsentAt && (
        <Card className="glass-card border-amber-500/30 bg-amber-500/10">
          <CardHeader>
            <CardTitle>Owner consent required</CardTitle>
            <CardDescription>This gym will not go live until consent is recorded.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2">
              <input
                id="ownerConsentExisting"
                type="checkbox"
                checked={existingConsent}
                onChange={(e) => setExistingConsent(e.target.checked)}
              />
              <Label htmlFor="ownerConsentExisting" className="text-sm text-muted-foreground">
                I confirm I have the owner’s consent to list {primaryGym.name} on Fitdex.
              </Label>
            </div>
            <Button
              size="sm"
              disabled={!existingConsent || consentSaving}
              onClick={async () => {
                setConsentSaving(true);
                const result = await fetchJson<{ gym?: any; error?: string }>("/api/owner/gym", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ gymId: primaryGym.id, ownerConsent: true }),
                  retries: 1,
                });
                if (result.ok && result.data?.gym) {
                  setGyms((prev) => prev.map((g) => (g.id === primaryGym.id ? result.data?.gym : g)));
                  toast({ title: "Consent saved", description: "Your gym can now go live." });
                  setExistingConsent(false);
                } else {
                  toast({ title: "Failed to save", description: result.error ?? "Please try again", variant: "destructive" });
                }
                setConsentSaving(false);
              }}
            >
              {consentSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Record consent"}
            </Button>
          </CardContent>
        </Card>
      )}

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
                  {(g.featuredEndAt ?? g.featuredUntil) && new Date(g.featuredEndAt ?? g.featuredUntil).getTime() > Date.now() && (
                    <div className="mt-1 inline-flex items-center gap-1 text-xs text-primary">
                      <Sparkles className="h-3 w-3" />
                      Featured until {new Date(g.featuredEndAt ?? g.featuredUntil).toLocaleDateString()}
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
                    className="bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-glow"
                    disabled={!paymentsEnabled || featuring === g.id}
                    onClick={() => setBoostGym(g)}
                  >
                    {featuring === g.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : paymentsEnabled ? (
                      "Boost for ₹99"
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
                          verifiedUntil?: string;
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
                        if (isAdmin && result.data?.verifiedUntil) {
                          toast({ title: "Verified badge activated", description: "Admin access applied." });
                          setGyms((prev) =>
                            prev.map((gym) =>
                              gym.id === g.id
                                ? { ...gym, verifiedUntil: result.data?.verifiedUntil }
                                : gym
                            )
                          );
                          setVerifying(null);
                          return;
                        }
                        const checkout = await openRazorpayCheckout({
                          orderId: result.data?.orderId ?? "",
                          amount: result.data?.amount ?? 0,
                          currency: result.data?.currency ?? "INR",
                          name: "FITDEX",
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

      <Dialog open={!!boostGym} onOpenChange={(open) => !open && setBoostGym(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Boost visibility for ₹99</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Get top placement in Explore for 3 days. Best for launch weeks, events, and new offers.
            </p>
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs">
              {boostGym?.name}
            </div>
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
    </div>
  );
}
