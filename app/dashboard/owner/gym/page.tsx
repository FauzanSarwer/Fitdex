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
  // All hooks, state, and handlers at the top
  const { data: session } = useSession();
  const { toast } = useToast();
  const [gyms, setGyms] = useState<any[]>([]);
  const [form, setForm] = useState<GymFormState>(emptyForm);
  const [editForm, setEditForm] = useState<GymFormState>(emptyForm);
  const [selectedGymId, setSelectedGymId] = useState<string>("");
  const [customAmenity, setCustomAmenity] = useState("");
  const [customEditAmenity, setCustomEditAmenity] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [primaryGym, setPrimaryGym] = useState<any>(null);
  const [existingConsent, setExistingConsent] = useState(false);
  const [consentSaving, setConsentSaving] = useState(false);
  const [boostGym, setBoostGym] = useState<any>(null);
  const [featuring, setFeaturing] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [onboardingProgress, setOnboardingProgress] = useState(0);
  const [onboardingSteps, setOnboardingSteps] = useState<any[]>([]);
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Add useEffect and all logic here as needed

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
  }

  // ...existing useEffect, handlers, and logic...
  if (loading) {
    return (
      <div className="p-6">
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }
  // ...existing UI and logic, properly closed...
  return (
    <div className="p-6 space-y-6">
      {/* ...existing dashboard JSX, ensure all elements are properly closed and wrapped... */}
      {/* Place your full UI here, as in your original code. */}
    </div>
  );
}
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
