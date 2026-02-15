"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchJson } from "@/lib/client-fetch";
import { cn } from "@/lib/utils";

const TYPES = ["ENTRY", "EXIT", "PAYMENT"] as const;

type QrPreviewGym = {
  gym: { id: string; name: string; logoUrl?: string | null };
  entries: Array<{ type: (typeof TYPES)[number]; staticUrl: string; lastGeneratedAt: string | null }>;
};

export default function OwnerQrManagementPage() {
  const { data: session } = useSession();
  const [gyms, setGyms] = useState<QrPreviewGym[]>([]);
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<(typeof TYPES)[number]>("ENTRY");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    let active = true;
    fetchJson<{ gyms?: QrPreviewGym[]; error?: string }>("/api/owner/qr", { retries: 1 })
      .then((res) => {
        if (!active) return;
        if (!res.ok) {
          setError(res.error ?? "Failed to load QR data");
          return;
        }
        const items = res.data?.gyms ?? [];
        setGyms(items);
        setSelectedGymId((prev) => prev ?? items[0]?.gym.id ?? null);
      })
      .catch(() => {
        if (active) setError("Failed to load QR data");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedGym = gyms.find((gym) => gym.gym.id === selectedGymId) ?? null;
  const selectedEntry = selectedGym?.entries.find((entry) => entry.type === selectedType) ?? null;

  const assetBase = selectedGymId
    ? `/api/qr/asset/${selectedGymId}/${selectedType}`
    : null;

  const handleRegenerate = async (revoke = false) => {
    if (!selectedGymId) return;
    setRegenerating(true);
    const res = await fetchJson("/api/owner/qr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gymId: selectedGymId, type: selectedType, revoke }),
    });
    if (!res.ok) {
      setError(res.error ?? "Failed to regenerate QR");
    } else {
      setError(null);
    }
    setRegenerating(false);
  };

  const handleDownload = (format: "png" | "svg" | "pdf", layout?: "A4" | "A5") => {
    if (!assetBase) return;
    const query = new URLSearchParams({ format });
    if (layout) query.set("layout", layout);
    window.open(`${assetBase}?${query.toString()}`, "_blank");
  };

  const gymOptions = useMemo(() => gyms.map((gym) => ({ value: gym.gym.id, label: gym.gym.name })), [gyms]);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading QR management...</div>;
  }

  if (error && gyms.length === 0) {
    return <div className="p-6 text-sm text-muted-foreground">{error}</div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">QR Management</h1>
        <p className="text-sm text-muted-foreground">Manage entry, exit, and payment QR codes for your gyms.</p>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Gym selector</CardTitle>
          <CardDescription>Pick the gym you want to manage.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedGymId ?? ""} onValueChange={(value) => setSelectedGymId(value)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select gym" />
            </SelectTrigger>
            <SelectContent>
              {gymOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex flex-wrap gap-2">
            {TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedType(type)}
                className={cn(
                  "rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition",
                  selectedType === type
                    ? "bg-primary text-primary-foreground"
                    : "border border-white/10 text-muted-foreground hover:text-foreground"
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Live preview</CardTitle>
            <CardDescription>High-contrast QR for wall displays.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {assetBase ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${assetBase}?format=png&size=420`}
                  alt="QR preview"
                  className="h-64 w-64 rounded-xl bg-white p-2"
                />
              </div>
            ) : null}
            <div className="text-xs text-muted-foreground">
              Last generated: {selectedEntry?.lastGeneratedAt ? new Date(selectedEntry.lastGeneratedAt).toLocaleString() : "Never"}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>Regenerate or download print assets.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => handleRegenerate(false)} disabled={regenerating}>
                Regenerate
              </Button>
              <Button variant="outline" onClick={() => handleRegenerate(true)} disabled={regenerating}>
                Revoke & Reissue
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Download</p>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" size="sm" onClick={() => handleDownload("png")}>
                  PNG
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDownload("svg")}>
                  SVG
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDownload("pdf", "A4")}>
                  PDF A4
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={() => handleDownload("pdf", "A5")}>
                PDF A5
              </Button>
            </div>

            {error ? <p className="text-xs text-amber-200">{error}</p> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
