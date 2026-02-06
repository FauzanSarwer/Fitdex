"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Loader2 } from "lucide-react";

export default function OwnerGymPage() {
  const { toast } = useToast();
  const [gyms, setGyms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    address: "",
    latitude: "",
    longitude: "",
    monthlyPrice: "",
    quarterlyPrice: "",
    yearlyPrice: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/owner/gym")
      .then((r) => r.json())
      .then((d) => {
        setGyms(d.gyms ?? []);
        setLoading(false);
      });
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/owner/gym", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          address: form.address,
          latitude: parseFloat(form.latitude) || 28.6139,
          longitude: parseFloat(form.longitude) || 77.209,
          monthlyPrice: Math.round(parseFloat(form.monthlyPrice) * 100) || 29900,
          quarterlyPrice: form.quarterlyPrice ? Math.round(parseFloat(form.quarterlyPrice) * 100) : null,
          yearlyPrice: Math.round(parseFloat(form.yearlyPrice) * 100) || 299000,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Error", description: data.error ?? "Failed", variant: "destructive" });
        setSaving(false);
        return;
      }
      toast({ title: "Gym added", description: data.gym?.name });
      setGyms((prev) => [data.gym, ...prev]);
      setForm({ name: "", address: "", latitude: "", longitude: "", monthlyPrice: "", quarterlyPrice: "", yearlyPrice: "" });
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
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
