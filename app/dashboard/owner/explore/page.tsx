"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { MapPin, ShieldCheck, Sparkles, Pencil, Image as ImageIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJson } from "@/lib/client-fetch";
import { useToast } from "@/hooks/use-toast";

export default function OwnerExplorePage() {
  const { toast } = useToast();
  const MAX_UPLOAD_BYTES = 500 * 1024;
  const [gyms, setGyms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
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

  const toRupees = (value: number | null | undefined) =>
    value != null ? String(Math.round(value / 100)) : "";
  const toPaise = (value: string) => Math.round((parseFloat(value || "0") || 0) * 100);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchJson<{ gyms?: any[]; error?: string }>("/api/owner/explore", { retries: 1 })
      .then((result) => {
        if (!active) return;
        if (!result.ok) {
          setError(result.error ?? "Failed to load gyms");
          setGyms([]);
          return;
        }
        setGyms(result.data?.gyms ?? []);
      })
      .catch(() => {
        if (!active) return;
        setError("Failed to load gyms");
        setGyms([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const openEdit = (gym: any) => {
    setEditing(gym);
    setEditForm({
      name: gym.name ?? "",
      address: gym.address ?? "",
      coverImageUrl: gym.coverImageUrl ?? "",
      openTime: gym.openTime ?? "",
      closeTime: gym.closeTime ?? "",
      openDays: gym.openDays ? String(gym.openDays).split(",") : ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
      dayPassPrice: toRupees(gym.dayPassPrice),
      monthlyPrice: toRupees(gym.monthlyPrice),
      quarterlyPrice: toRupees(gym.quarterlyPrice),
      yearlyPrice: toRupees(gym.yearlyPrice),
    });
  };

  const handleSave = async () => {
    if (!editing?.id) return;
    setSaving(true);
    try {
      const result = await fetchJson<{ gym?: any; error?: string }>("/api/owner/gym", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymId: editing.id,
          name: editForm.name,
          address: editForm.address,
          coverImageUrl: editForm.coverImageUrl,
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
      toast({ title: "Gym updated" });
      setGyms((prev) =>
        prev.map((g) => (g.id === editing.id ? { ...g, ...(result.data?.gym ?? {}) } : g))
      );
      setEditing(null);
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
    setSaving(false);
  };

  const title = useMemo(() => (editing?.name ? `Edit ${editing.name}` : "Edit gym"), [editing]);

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
            <CardTitle>Could not load gyms</CardTitle>
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
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MapPin className="h-6 w-6" />
          Owner explore
        </h1>
        <p className="text-muted-foreground text-sm">
          Manage your gyms and review competitors. Your gyms include edit tools and analytics (premium).
        </p>
      </motion.div>

      {gyms.length === 0 ? (
        <Card className="glass-card p-12 text-center">
          <p className="text-muted-foreground">No gyms found.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {gyms.map((gym) => {
            const isOwner = gym.isOwner;
            const isVerified = gym.verificationStatus === "VERIFIED";
            return (
              <Card key={gym.id} className="glass-card overflow-hidden">
                <div className="relative h-36 bg-gradient-to-br from-primary/30 via-primary/10 to-accent/20">
                  {gym.coverImageUrl ? (
                    <img src={gym.coverImageUrl} alt={gym.name} className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <ImageIcon className="h-8 w-8" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3 flex items-center gap-2 text-[10px]">
                    <span className={`rounded-full px-2 py-0.5 ${isOwner ? "bg-primary/20 text-primary" : "bg-amber-500/20 text-amber-400"}`}>
                      {isOwner ? "Your gym" : "Competitor"}
                    </span>
                    {isVerified ? (
                      <span className="rounded-full bg-emerald-500/20 text-emerald-400 px-2 py-0.5">Verified</span>
                    ) : (
                      <span className="rounded-full bg-amber-500/20 text-amber-400 px-2 py-0.5">Unverified</span>
                    )}
                  </div>
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{gym.name}</CardTitle>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {gym.address}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isOwner && gym.stats ? (
                    <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                      <div className="rounded-lg border border-white/10 px-3 py-2">
                        <div className="text-sm font-semibold text-foreground">{gym.stats.membersJoined}</div>
                        Members joined
                      </div>
                      <div className="rounded-lg border border-white/10 px-3 py-2">
                        <div className="text-sm font-semibold text-foreground">{gym.stats.pageViews}</div>
                        Page visits
                      </div>
                    </div>
                  ) : isOwner ? (
                    <div className="rounded-lg border border-white/10 px-3 py-2 text-xs text-muted-foreground">
                      Premium analytics available on paid plans.
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    {isOwner ? (
                      <Dialog open={editing?.id === gym.id} onOpenChange={(open) => !open && setEditing(null)}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="secondary" onClick={() => openEdit(gym)}>
                            <Pencil className="mr-1 h-3 w-3" />
                            Edit
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>{title}</DialogTitle>
                          </DialogHeader>
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Name</Label>
                              <Input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                              <Label>Address</Label>
                              <Input value={editForm.address} onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                              <Label>Cover photo</Label>
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
                                    setEditForm((p) => ({ ...p, coverImageUrl: uploadJson.secure_url }));
                                  } catch {
                                    toast({ title: "Upload failed", variant: "destructive" });
                                  }
                                  setUploading(false);
                                }}
                              />
                              {editForm.coverImageUrl && (
                                <img src={editForm.coverImageUrl} alt="Gym" className="h-28 w-full rounded-lg object-cover" />
                              )}
                              {uploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
                            </div>
                            <div className="space-y-2">
                              <Label>Opening time</Label>
                              <Input type="time" value={editForm.openTime} onChange={(e) => setEditForm((p) => ({ ...p, openTime: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                              <Label>Closing time</Label>
                              <Input type="time" value={editForm.closeTime} onChange={(e) => setEditForm((p) => ({ ...p, closeTime: e.target.value }))} />
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
                          <div className="mt-4 flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                            <Button onClick={handleSave} disabled={saving || uploading}>
                              {saving || uploading ? "Saving…" : "Save changes"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    ) : null}
                    {isOwner ? (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/explore/${gym.id}`}>See customer preview</Link>
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/explore/${gym.id}`}>View profile</Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
