"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchJson } from "@/lib/client-fetch";
import { useToast } from "@/hooks/use-toast";

export function AdminGymEditor({ gym }: { gym: any }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: gym.name ?? "",
    address: gym.address ?? "",
    amenities: (gym.amenities ?? []).join(", "),
    hasAC: !!gym.hasAC,
    gymTier: gym.gymTier ?? "SUPPORTING",
    suspend: !!gym.suspendedAt,
    ownerConsent: !!gym.ownerConsentAt,
    isFeatured: !!gym.isFeatured,
    featuredStartAt: gym.featuredStartAt ? new Date(gym.featuredStartAt).toISOString().slice(0, 10) : "",
    featuredEndAt: gym.featuredEndAt ? new Date(gym.featuredEndAt).toISOString().slice(0, 10) : "",
    lastContactedAt: gym.lastContactedAt ? new Date(gym.lastContactedAt).toISOString().slice(0, 10) : "",
    responsivenessScore: gym.responsivenessScore ?? 0,
    responsivenessOverride: gym.responsivenessOverride ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const result = await fetchJson<{ gym?: any; error?: string }>("/api/admin/gym", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gymId: gym.id,
        name: form.name,
        address: form.address,
        amenities: form.amenities,
        hasAC: form.hasAC,
        gymTier: form.gymTier,
        suspend: form.suspend,
        ownerConsent: form.ownerConsent,
        isFeatured: form.isFeatured,
        featuredStartAt: form.featuredStartAt || null,
        featuredEndAt: form.featuredEndAt || null,
        lastContactedAt: form.lastContactedAt || null,
        responsivenessScore: Number(form.responsivenessScore),
        responsivenessOverride: form.responsivenessOverride === "" ? null : Number(form.responsivenessOverride),
      }),
      retries: 1,
    });
    if (result.ok) {
      toast({ title: "Gym updated" });
    } else {
      toast({ title: "Update failed", description: result.error ?? "Please try again", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>Edit gym</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <Input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Amenities</Label>
            <Input value={form.amenities} onChange={(e) => setForm((p) => ({ ...p, amenities: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Gym tier</Label>
            <select
              className="w-full rounded-md border border-white/10 bg-background px-3 py-2 text-sm"
              value={form.gymTier}
              onChange={(e) => setForm((p) => ({ ...p, gymTier: e.target.value }))}
            >
              <option value="CORE">CORE</option>
              <option value="SUPPORTING">SUPPORTING</option>
              <option value="EDGE">EDGE</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Last contacted</Label>
            <Input
              type="date"
              value={form.lastContactedAt}
              onChange={(e) => setForm((p) => ({ ...p, lastContactedAt: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Responsiveness score</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={form.responsivenessScore}
              onChange={(e) => setForm((p) => ({ ...p, responsivenessScore: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Responsiveness override</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={form.responsivenessOverride}
              onChange={(e) => setForm((p) => ({ ...p, responsivenessOverride: e.target.value }))}
              placeholder="Optional override"
            />
          </div>
          <div className="space-y-2">
            <Label>AC</Label>
            <div className="flex items-center gap-2">
              <input
                id="admin-hasAC"
                type="checkbox"
                checked={form.hasAC}
                onChange={(e) => setForm((p) => ({ ...p, hasAC: e.target.checked }))}
              />
              <Label htmlFor="admin-hasAC" className="text-sm text-muted-foreground">Has AC</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Consent recorded</Label>
            <div className="flex items-center gap-2">
              <input
                id="admin-consent"
                type="checkbox"
                checked={form.ownerConsent}
                onChange={(e) => setForm((p) => ({ ...p, ownerConsent: e.target.checked }))}
              />
              <Label htmlFor="admin-consent" className="text-sm text-muted-foreground">Owner consent on file</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Suspended</Label>
            <div className="flex items-center gap-2">
              <input
                id="admin-suspend"
                type="checkbox"
                checked={form.suspend}
                onChange={(e) => setForm((p) => ({ ...p, suspend: e.target.checked }))}
              />
              <Label htmlFor="admin-suspend" className="text-sm text-muted-foreground">Suspend gym listing</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Featured override</Label>
            <div className="flex items-center gap-2">
              <input
                id="admin-featured"
                type="checkbox"
                checked={form.isFeatured}
                onChange={(e) => setForm((p) => ({ ...p, isFeatured: e.target.checked }))}
              />
              <Label htmlFor="admin-featured" className="text-sm text-muted-foreground">Force featured badge</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Featured start</Label>
            <Input
              type="date"
              value={form.featuredStartAt}
              onChange={(e) => setForm((p) => ({ ...p, featuredStartAt: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Featured end</Label>
            <Input
              type="date"
              value={form.featuredEndAt}
              onChange={(e) => setForm((p) => ({ ...p, featuredEndAt: e.target.value }))}
            />
          </div>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </CardContent>
    </Card>
  );
}
