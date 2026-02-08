"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Percent, Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/client-fetch";

export default function OwnerDiscountsPage() {
  const { toast } = useToast();
  const [gyms, setGyms] = useState<any[]>([]);
  const [selectedGymId, setSelectedGymId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    partnerDiscountPercent: "",
    quarterlyDiscountType: "PERCENT",
    quarterlyDiscountValue: "",
    yearlyDiscountType: "PERCENT",
    yearlyDiscountValue: "",
    welcomeDiscountType: "PERCENT",
    welcomeDiscountValue: "",
  });
  const [promoCode, setPromoCode] = useState("");
  const [promoType, setPromoType] = useState<"PERCENT" | "FLAT">("PERCENT");
  const [promoValue, setPromoValue] = useState("");
  const [promoValidUntil, setPromoValidUntil] = useState("");
  const [promoSaving, setPromoSaving] = useState(false);
  const [promoCodes, setPromoCodes] = useState<any[]>([]);

  const toRupees = (value: number) => String(Math.round(value / 100));
  const toPaise = (value: string) => Math.round((parseFloat(value || "0") || 0) * 100);

  useEffect(() => {
    let active = true;
    fetchJson<{ gyms?: any[]; error?: string }>("/api/owner/gym?compact=1", { retries: 1 })
      .then((result) => {
        if (!active) return;
        if (!result.ok) {
          setError(result.error ?? "Failed to load gyms");
          setLoading(false);
          return;
        }
        const list = result.data?.gyms ?? [];
        setGyms(list);
        if (list.length > 0) {
          setSelectedGymId(list[0].id);
          const g = list[0];
          setForm({
            partnerDiscountPercent: String(g.partnerDiscountPercent ?? 10),
            quarterlyDiscountType: g.quarterlyDiscountType ?? "PERCENT",
            quarterlyDiscountValue:
              (g.quarterlyDiscountType ?? "PERCENT") === "FLAT"
                ? toRupees(g.quarterlyDiscountValue ?? 0)
                : String(g.quarterlyDiscountValue ?? 10),
            yearlyDiscountType: g.yearlyDiscountType ?? "PERCENT",
            yearlyDiscountValue:
              (g.yearlyDiscountType ?? "PERCENT") === "FLAT"
                ? toRupees(g.yearlyDiscountValue ?? 0)
                : String(g.yearlyDiscountValue ?? 15),
            welcomeDiscountType: g.welcomeDiscountType ?? "PERCENT",
            welcomeDiscountValue:
              (g.welcomeDiscountType ?? "PERCENT") === "FLAT"
                ? toRupees(g.welcomeDiscountValue ?? 0)
                : String(g.welcomeDiscountValue ?? 10),
          });
        }
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError("Failed to load gyms");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const g = gyms.find((x) => x.id === selectedGymId);
    if (g) {
      setForm({
        partnerDiscountPercent: String(g.partnerDiscountPercent ?? 10),
        quarterlyDiscountType: g.quarterlyDiscountType ?? "PERCENT",
        quarterlyDiscountValue:
          (g.quarterlyDiscountType ?? "PERCENT") === "FLAT"
            ? toRupees(g.quarterlyDiscountValue ?? 0)
            : String(g.quarterlyDiscountValue ?? 10),
        yearlyDiscountType: g.yearlyDiscountType ?? "PERCENT",
        yearlyDiscountValue:
          (g.yearlyDiscountType ?? "PERCENT") === "FLAT"
            ? toRupees(g.yearlyDiscountValue ?? 0)
            : String(g.yearlyDiscountValue ?? 15),
        welcomeDiscountType: g.welcomeDiscountType ?? "PERCENT",
        welcomeDiscountValue:
          (g.welcomeDiscountType ?? "PERCENT") === "FLAT"
            ? toRupees(g.welcomeDiscountValue ?? 0)
            : String(g.welcomeDiscountValue ?? 10),
      });
    }
  }, [selectedGymId, gyms]);

  useEffect(() => {
    if (!selectedGymId) return;
    let active = true;
    fetchJson<{ codes?: any[]; error?: string }>(`/api/owner/discount-codes?gymId=${selectedGymId}`, { retries: 1 })
      .then((result) => {
        if (!active) return;
        if (!result.ok) {
          setError(result.error ?? "Failed to load discount codes");
          setPromoCodes([]);
          return;
        }
        setPromoCodes(result.data?.codes ?? []);
      })
      .catch(() => {
        if (!active) return;
        setError("Failed to load discount codes");
        setPromoCodes([]);
      });
    return () => {
      active = false;
    };
  }, [selectedGymId]);

  async function handleAddPromo() {
    if (!selectedGymId || !promoCode.trim() || !promoValue) return;
    setPromoSaving(true);
    try {
      const result = await fetchJson<{ code?: any; error?: string }>("/api/owner/discount-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymId: selectedGymId,
          code: promoCode.trim(),
          discountType: promoType,
          discountValue: promoType === "FLAT" ? toPaise(promoValue) : parseInt(promoValue, 10) || 0,
          validUntil: promoValidUntil || undefined,
        }),
        retries: 1,
      });
      if (!result.ok) {
        toast({ title: "Error", description: result.error ?? "Failed", variant: "destructive" });
        setPromoSaving(false);
        return;
      }
      toast({ title: "Promo code added" });
      const createdCode = result.data?.code;
      if (createdCode) {
        setPromoCodes((prev) => [createdCode, ...prev]);
      }
      setPromoCode("");
      setPromoValue("");
      setPromoValidUntil("");
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
    setPromoSaving(false);
  }

  async function handleSave() {
    if (!selectedGymId) return;
    setSaving(true);
    try {
      const result = await fetchJson<{ gym?: any; error?: string }>("/api/owner/gym", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymId: selectedGymId,
          partnerDiscountPercent: parseInt(form.partnerDiscountPercent, 10) || 0,
          quarterlyDiscountType: form.quarterlyDiscountType,
          quarterlyDiscountValue:
            form.quarterlyDiscountType === "FLAT"
              ? toPaise(form.quarterlyDiscountValue)
              : parseInt(form.quarterlyDiscountValue, 10) || 0,
          yearlyDiscountType: form.yearlyDiscountType,
          yearlyDiscountValue:
            form.yearlyDiscountType === "FLAT"
              ? toPaise(form.yearlyDiscountValue)
              : parseInt(form.yearlyDiscountValue, 10) || 0,
          welcomeDiscountType: form.welcomeDiscountType,
          welcomeDiscountValue:
            form.welcomeDiscountType === "FLAT"
              ? toPaise(form.welcomeDiscountValue)
              : parseInt(form.welcomeDiscountValue, 10) || 0,
        }),
        retries: 1,
      });
      if (!result.ok) {
        toast({ title: "Error", description: result.error ?? "Failed", variant: "destructive" });
        setSaving(false);
        return;
      }
      toast({ title: "Discounts updated" });
      setGyms((prev) =>
        prev.map((g) => (g.id === selectedGymId ? { ...g, ...(result.data?.gym ?? {}) } : g))
      );
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

  if (error) {
    return (
      <div className="p-6">
        <Card className="glass-card p-10 text-center">
          <CardHeader>
            <CardTitle>Could not load discounts</CardTitle>
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
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Percent className="h-6 w-6" />
          Discounts
        </h1>
        <p className="text-muted-foreground text-sm">Configure discount rules per gym.</p>
      </motion.div>

      {gyms.length > 0 && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Gym:</span>
            <Select value={selectedGymId} onValueChange={setSelectedGymId}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {gyms.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Discount configuration</CardTitle>
              <CardDescription>
                Discounts follow FitDex stacking rules. Welcome cannot stack. Duo stacks only with quarterly/yearly. Promo stacks with quarterly/yearly.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Partner discount (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={form.partnerDiscountPercent}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, partnerDiscountPercent: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quarterly discount</Label>
                  <div className="flex gap-2">
                    <Select
                      value={form.quarterlyDiscountType}
                      onValueChange={(v) => setForm((p) => ({ ...p, quarterlyDiscountType: v }))}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PERCENT">Percent</SelectItem>
                        <SelectItem value="FLAT">Flat ₹</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="0"
                      value={form.quarterlyDiscountValue}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, quarterlyDiscountValue: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Yearly discount</Label>
                  <div className="flex gap-2">
                    <Select
                      value={form.yearlyDiscountType}
                      onValueChange={(v) => setForm((p) => ({ ...p, yearlyDiscountType: v }))}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PERCENT">Percent</SelectItem>
                        <SelectItem value="FLAT">Flat ₹</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="0"
                      value={form.yearlyDiscountValue}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, yearlyDiscountValue: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Welcome discount</Label>
                  <div className="flex gap-2">
                    <Select
                      value={form.welcomeDiscountType}
                      onValueChange={(v) => setForm((p) => ({ ...p, welcomeDiscountType: v }))}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PERCENT">Percent</SelectItem>
                        <SelectItem value="FLAT">Flat ₹</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="0"
                      value={form.welcomeDiscountValue}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, welcomeDiscountValue: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </div>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Promo codes</CardTitle>
              <CardDescription>
                Create discount codes for members to use at checkout.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Input
                  placeholder="Code (e.g. SAVE10)"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  className="w-32"
                />
                <Select value={promoType} onValueChange={(v) => setPromoType(v as "PERCENT" | "FLAT")}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENT">Percent</SelectItem>
                    <SelectItem value="FLAT">Flat ₹</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder={promoType === "FLAT" ? "₹ off" : "% off"}
                  value={promoValue}
                  onChange={(e) => setPromoValue(e.target.value)}
                  className="w-28"
                />
                <Input
                  type="date"
                  placeholder="Valid until"
                  value={promoValidUntil}
                  onChange={(e) => setPromoValidUntil(e.target.value)}
                  className="w-40"
                />
                <Button size="sm" onClick={handleAddPromo} disabled={promoSaving}>
                  {promoSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                </Button>
              </div>
              {promoCodes.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium">Active codes</p>
                  {promoCodes.map((c) => (
                    <div
                      key={c.id}
                      className="flex justify-between py-1 text-sm text-muted-foreground"
                    >
                      <span className="font-mono">{c.code}</span>
                      <span>
                        {c.discountType === "FLAT" ? `₹${Math.round(c.discountValue / 100)}` : `${c.discountValue}%`}
                        {" "}· {c.usedCount}/{c.maxUses} uses · until {new Date(c.validUntil).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {gyms.length === 0 && (
        <Card className="glass-card p-12 text-center">
          <p className="text-muted-foreground">Add a gym first to set discounts.</p>
        </Card>
      )}
    </div>
  );
}
