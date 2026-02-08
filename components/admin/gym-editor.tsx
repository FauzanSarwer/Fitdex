"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchJson } from "@/lib/client-fetch";
import { useToast } from "@/hooks/use-toast";
import { AMENITY_OPTIONS } from "@/lib/amenities";

export function AdminGymEditor({ gym }: { gym: any }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: gym.name ?? "",
    address: gym.address ?? "",
    amenities: (gym.amenities ?? []) as string[],
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
  const [customAmenity, setCustomAmenity] = useState("");

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
            <label className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2 text-sm text-muted-foreground">
              <input
                id="admin-hasAC"
                type="checkbox"
                className="h-4 w-4 rounded border-white/20 bg-transparent accent-primary"
                checked={form.hasAC}
                onChange={(e) => setForm((p) => ({ ...p, hasAC: e.target.checked }))}
              />
              Has AC
            </label>
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
