"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signOut } from "next-auth/react";
import { User, LogOut } from "lucide-react";
import { fetchJson } from "@/lib/client-fetch";
import { useToast } from "@/hooks/use-toast";

export default function OwnerSettingsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    phoneNumber: "",
    billingEmail: "",
    city: "",
    state: "",
    timezone: "",
    notifyMemberships: true,
    notifyPromos: true,
    notifyDuo: true,
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchJson<{ settings?: any; error?: string }>("/api/user/settings", { retries: 1 })
      .then((result) => {
        if (!active) return;
        if (!result.ok) {
          setError(result.error ?? "Failed to load settings");
          return;
        }
        const s = result.data?.settings;
        setForm({
          name: s?.name ?? session?.user?.name ?? "",
          phoneNumber: s?.phoneNumber ?? "",
          billingEmail: s?.billingEmail ?? "",
          city: s?.city ?? "",
          state: s?.state ?? "",
          timezone: s?.timezone ?? "",
          notifyMemberships: s?.notifyMemberships ?? true,
          notifyPromos: s?.notifyPromos ?? true,
          notifyDuo: s?.notifyDuo ?? true,
        });
      })
      .catch(() => {
        if (!active) return;
        setError("Failed to load settings");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session?.user?.name]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const result = await fetchJson<{ settings?: any; error?: string }>("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phoneNumber: form.phoneNumber,
          billingEmail: form.billingEmail,
          city: form.city,
          state: form.state,
          timezone: form.timezone,
          notifyMemberships: form.notifyMemberships,
          notifyPromos: form.notifyPromos,
          notifyDuo: form.notifyDuo,
        }),
        retries: 1,
      });
      if (!result.ok) {
        toast({ title: "Save failed", description: result.error ?? "Please try again.", variant: "destructive" });
        setSaving(false);
        return;
      }
      toast({ title: "Settings saved" });
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User className="h-6 w-6" />
          Settings
        </h1>
        <p className="text-muted-foreground text-sm">Account and preferences.</p>
      </motion.div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Owner details and billing preferences.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Owner name</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Contact phone</Label>
              <Input value={form.phoneNumber} onChange={(e) => setForm((p) => ({ ...p, phoneNumber: e.target.value }))} placeholder="+91" />
            </div>
            <div className="space-y-2">
              <Label>Billing email</Label>
              <Input value={form.billingEmail} onChange={(e) => setForm((p) => ({ ...p, billingEmail: e.target.value }))} placeholder="billing@" />
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Input value={form.timezone} onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))} placeholder="Asia/Kolkata" />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input value={form.state} onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.notifyMemberships}
                onChange={(e) => setForm((p) => ({ ...p, notifyMemberships: e.target.checked }))}
                className="h-4 w-4 accent-primary"
              />
              Membership updates
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.notifyDuo}
                onChange={(e) => setForm((p) => ({ ...p, notifyDuo: e.target.checked }))}
                className="h-4 w-4 accent-primary"
              />
              Duo updates
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.notifyPromos}
                onChange={(e) => setForm((p) => ({ ...p, notifyPromos: e.target.checked }))}
                className="h-4 w-4 accent-primary"
              />
              Promotions
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={saveSettings} disabled={saving || loading}>
              {saving ? "Saving…" : "Save settings"}
            </Button>
            {error && <p className="text-xs text-amber-400">{error}</p>}
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Sign out</CardTitle>
          <CardDescription>Sign out of your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => signOut({ callbackUrl: "/" })}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
