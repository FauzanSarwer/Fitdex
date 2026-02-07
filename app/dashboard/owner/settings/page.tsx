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
  const [gyms, setGyms] = useState<any[]>([]);
  const [bankGymId, setBankGymId] = useState("");
  const [bankForm, setBankForm] = useState({
    accountNumber: "",
    ifsc: "",
    accountHolderName: "",
  });
  const [bankSaving, setBankSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phoneNumber: "",
    billingEmail: "",
    billingAddress: "",
    businessName: "",
    businessType: "",
    supportEmail: "",
    supportPhone: "",
    supportWhatsapp: "",
    logoUrl: "",
    twoFactorEnabled: false,
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
          billingAddress: s?.billingAddress ?? "",
          businessName: s?.businessName ?? "",
          businessType: s?.businessType ?? "",
          supportEmail: s?.supportEmail ?? "",
          supportPhone: s?.supportPhone ?? "",
          supportWhatsapp: s?.supportWhatsapp ?? "",
          logoUrl: s?.logoUrl ?? "",
          twoFactorEnabled: s?.twoFactorEnabled ?? false,
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

  useEffect(() => {
    let active = true;
    fetchJson<{ gyms?: any[]; error?: string }>("/api/owner/gym", { retries: 1 })
      .then((result) => {
        if (!active) return;
        if (result.ok) {
          setGyms(result.data?.gyms ?? []);
          if (!bankGymId && result.data?.gyms?.[0]?.id) setBankGymId(result.data.gyms[0].id);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [bankGymId]);

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
          billingAddress: form.billingAddress,
          businessName: form.businessName,
          businessType: form.businessType,
          supportEmail: form.supportEmail,
          supportPhone: form.supportPhone,
          supportWhatsapp: form.supportWhatsapp,
          logoUrl: form.logoUrl,
          twoFactorEnabled: form.twoFactorEnabled,
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

  const saveBankDetails = async () => {
    if (!bankGymId) {
      toast({ title: "Select a gym", description: "Choose a gym to attach bank details.", variant: "destructive" });
      return;
    }
    if (!bankForm.accountNumber.trim() || !bankForm.ifsc.trim()) {
      toast({ title: "Missing info", description: "Account number and IFSC are required.", variant: "destructive" });
      return;
    }
    setBankSaving(true);
    try {
      const result = await fetchJson<{ ok?: boolean; error?: string; verificationStatus?: string }>(
        "/api/owner/gym/verification/bank",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gymId: bankGymId,
            accountNumber: bankForm.accountNumber.trim(),
            ifsc: bankForm.ifsc.trim().toUpperCase(),
            accountHolderName: bankForm.accountHolderName.trim() || undefined,
          }),
          retries: 1,
        }
      );
      if (!result.ok) {
        toast({ title: "Bank verification failed", description: result.error ?? "Please try again.", variant: "destructive" });
        setBankSaving(false);
        return;
      }
      toast({ title: "Bank details saved", description: "Bank verification submitted." });
    } catch {
      toast({ title: "Bank verification failed", variant: "destructive" });
    }
    setBankSaving(false);
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
              <Label>Business name</Label>
              <Input value={form.businessName} onChange={(e) => setForm((p) => ({ ...p, businessName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Business type</Label>
              <Input value={form.businessType} onChange={(e) => setForm((p) => ({ ...p, businessType: e.target.value }))} placeholder="Gym / Studio / Box" />
            </div>
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
              <Label>Billing address</Label>
              <Input value={form.billingAddress} onChange={(e) => setForm((p) => ({ ...p, billingAddress: e.target.value }))} placeholder="Street, City, State" />
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
            <div className="space-y-2">
              <Label>Brand logo URL (public)</Label>
              <Input value={form.logoUrl} onChange={(e) => setForm((p) => ({ ...p, logoUrl: e.target.value }))} placeholder="https://" />
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
          <CardTitle>Support & contact (public)</CardTitle>
          <CardDescription>These details are visible on your gym profile.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Support email</Label>
            <Input value={form.supportEmail} onChange={(e) => setForm((p) => ({ ...p, supportEmail: e.target.value }))} placeholder="support@" />
          </div>
          <div className="space-y-2">
            <Label>Support phone</Label>
            <Input value={form.supportPhone} onChange={(e) => setForm((p) => ({ ...p, supportPhone: e.target.value }))} placeholder="+91" />
          </div>
          <div className="space-y-2">
            <Label>WhatsApp number</Label>
            <Input value={form.supportWhatsapp} onChange={(e) => setForm((p) => ({ ...p, supportWhatsapp: e.target.value }))} placeholder="+91" />
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>Protect your owner account.</CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.twoFactorEnabled}
              onChange={(e) => setForm((p) => ({ ...p, twoFactorEnabled: e.target.checked }))}
              className="h-4 w-4 accent-primary"
            />
            Enable 2FA (coming soon)
          </label>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Bank account details</CardTitle>
          <CardDescription>Required for payouts and verification.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Gym</Label>
            <select
              className="w-full rounded-md border border-white/10 bg-background px-3 py-2 text-sm"
              value={bankGymId}
              onChange={(e) => setBankGymId(e.target.value)}
            >
              {gyms.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Account number</Label>
              <Input
                value={bankForm.accountNumber}
                onChange={(e) => setBankForm((p) => ({ ...p, accountNumber: e.target.value }))}
                placeholder="XXXXXXXXXXXX"
              />
            </div>
            <div className="space-y-2">
              <Label>IFSC</Label>
              <Input
                value={bankForm.ifsc}
                onChange={(e) => setBankForm((p) => ({ ...p, ifsc: e.target.value }))}
                placeholder="HDFC0XXXXXX"
              />
            </div>
            <div className="space-y-2">
              <Label>Account holder name (optional)</Label>
              <Input
                value={bankForm.accountHolderName}
                onChange={(e) => setBankForm((p) => ({ ...p, accountHolderName: e.target.value }))}
              />
            </div>
          </div>
          <Button onClick={saveBankDetails} disabled={bankSaving}>
            {bankSaving ? "Saving…" : "Save bank details"}
          </Button>
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
