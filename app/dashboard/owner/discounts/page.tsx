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

export default function OwnerDiscountsPage() {
  const { toast } = useToast();
  const [gyms, setGyms] = useState<any[]>([]);
  const [selectedGymId, setSelectedGymId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    partnerDiscountPercent: "",
    quarterlyDiscountPercent: "",
    yearlyDiscountPercent: "",
    welcomeDiscountPercent: "",
    maxDiscountCapPercent: "",
  });
  const [promoCode, setPromoCode] = useState("");
  const [promoPercent, setPromoPercent] = useState("");
  const [promoValidUntil, setPromoValidUntil] = useState("");
  const [promoSaving, setPromoSaving] = useState(false);
  const [promoCodes, setPromoCodes] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/owner/gym")
      .then((r) => r.json())
      .then((d) => {
        const list = d.gyms ?? [];
        setGyms(list);
        if (list.length > 0) {
          setSelectedGymId(list[0].id);
          const g = list[0];
          setForm({
            partnerDiscountPercent: String(g.partnerDiscountPercent ?? 10),
            quarterlyDiscountPercent: String(g.quarterlyDiscountPercent ?? 10),
            yearlyDiscountPercent: String(g.yearlyDiscountPercent ?? 15),
            welcomeDiscountPercent: String(g.welcomeDiscountPercent ?? 10),
            maxDiscountCapPercent: String(g.maxDiscountCapPercent ?? 40),
          });
        }
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const g = gyms.find((x) => x.id === selectedGymId);
    if (g) {
      setForm({
        partnerDiscountPercent: String(g.partnerDiscountPercent ?? 10),
        quarterlyDiscountPercent: String(g.quarterlyDiscountPercent ?? 10),
        yearlyDiscountPercent: String(g.yearlyDiscountPercent ?? 15),
        welcomeDiscountPercent: String(g.welcomeDiscountPercent ?? 10),
        maxDiscountCapPercent: String(g.maxDiscountCapPercent ?? 40),
      });
    }
  }, [selectedGymId, gyms]);

  useEffect(() => {
    if (selectedGymId) {
      fetch(`/api/owner/discount-codes?gymId=${selectedGymId}`)
        .then((r) => r.json())
        .then((d) => setPromoCodes(d.codes ?? []));
    }
  }, [selectedGymId]);

  async function handleAddPromo() {
    if (!selectedGymId || !promoCode.trim() || !promoPercent) return;
    setPromoSaving(true);
    try {
      const res = await fetch("/api/owner/discount-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymId: selectedGymId,
          code: promoCode.trim(),
          discountPercent: parseInt(promoPercent, 10) || 0,
          validUntil: promoValidUntil || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Error", description: data.error ?? "Failed", variant: "destructive" });
        setPromoSaving(false);
        return;
      }
      toast({ title: "Promo code added" });
      setPromoCodes((prev) => [data.code, ...prev]);
      setPromoCode("");
      setPromoPercent("");
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
      const res = await fetch("/api/owner/gym", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymId: selectedGymId,
          partnerDiscountPercent: parseInt(form.partnerDiscountPercent, 10) || 0,
          quarterlyDiscountPercent: parseInt(form.quarterlyDiscountPercent, 10) || 0,
          yearlyDiscountPercent: parseInt(form.yearlyDiscountPercent, 10) || 0,
          welcomeDiscountPercent: parseInt(form.welcomeDiscountPercent, 10) || 0,
          maxDiscountCapPercent: parseInt(form.maxDiscountCapPercent, 10) || 40,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Error", description: data.error ?? "Failed", variant: "destructive" });
        setSaving(false);
        return;
      }
      toast({ title: "Discounts updated" });
      setGyms((prev) =>
        prev.map((g) => (g.id === selectedGymId ? { ...g, ...data.gym } : g))
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
                Partner (duo), quarterly, yearly, and welcome discounts stack. Total is capped at max %. Partner discount % is set here — applies when members invite partners to join (together or after joining; inviter gets discount on next renewal).
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
                  <Label>Quarterly discount (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={form.quarterlyDiscountPercent}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, quarterlyDiscountPercent: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Yearly discount (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={form.yearlyDiscountPercent}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, yearlyDiscountPercent: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Welcome discount (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={form.welcomeDiscountPercent}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, welcomeDiscountPercent: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max total discount cap (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={form.maxDiscountCapPercent}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, maxDiscountCapPercent: e.target.value }))
                    }
                  />
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
                <Input
                  type="number"
                  placeholder="% off"
                  value={promoPercent}
                  onChange={(e) => setPromoPercent(e.target.value)}
                  className="w-20"
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
                      <span>{c.discountPercent}% · {c.usedCount}/{c.maxUses} uses · until {new Date(c.validUntil).toLocaleDateString()}</span>
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
