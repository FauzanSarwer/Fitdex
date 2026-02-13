"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Users } from "lucide-react";
import { fetchJson } from "@/lib/client-fetch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Link from "next/link";

export default function OwnerMembersPage() {
  const [gyms, setGyms] = useState<any[]>([]);
  const [selectedGymId, setSelectedGymId] = useState<string>("");
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<any | null>(null);
  const [invoiceModal, setInvoiceModal] = useState<{ memberId: string; name: string } | null>(null);
  const [invoiceType, setInvoiceType] = useState<"GST" | "NON_GST">("NON_GST");
  const [invoiceLayout, setInvoiceLayout] = useState<"A4" | "THERMAL">("A4");
  const [invoiceLoading, setInvoiceLoading] = useState<string | null>(null);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchJson<{ gyms?: any[]; error?: string }>("/api/owner/gym?compact=1", {
      retries: 1,
      useCache: true,
      cacheKey: "owner-gyms-compact",
      cacheTtlMs: 30000,
    })
      .then((result) => {
        if (!active) return;
        if (!result.ok) {
          setError(result.error ?? "Failed to load gyms");
          setGyms([]);
          setLoading(false);
          return;
        }
        const list = result.data?.gyms ?? [];
        setGyms(list);
        if (list.length > 0 && !selectedGymId) setSelectedGymId(list[0].id);
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
    let active = true;
    fetchJson<{ subscription?: any }>("/api/owner/subscription", {
      retries: 1,
      useCache: true,
      cacheKey: "owner-subscription",
      cacheTtlMs: 20000,
    })
      .then((result) => {
        if (!active) return;
        if (result.ok) setSubscription(result.data?.subscription ?? null);
      })
      .catch(() => {
        if (!active) return;
        setSubscription(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const invoiceEligible =
    subscription?.status === "ACTIVE" &&
    ["STARTER", "PRO"].includes(subscription.plan) &&
    new Date(subscription.expiresAt).getTime() > Date.now();

  useEffect(() => {
    if (!selectedGymId) return;
    let active = true;
    fetchJson<{ members?: any[]; error?: string }>(`/api/owner/members?gymId=${selectedGymId}`, {
      retries: 1,
      useCache: true,
      cacheKey: `owner-members:${selectedGymId}`,
      cacheTtlMs: 15000,
    })
      .then((result) => {
        if (!active) return;
        if (!result.ok) {
          setError(result.error ?? "Failed to load members");
          setMembers([]);
          return;
        }
        setMembers(result.data?.members ?? []);
      })
      .catch(() => {
        if (!active) return;
        setError("Failed to load members");
        setMembers([]);
      });
    return () => {
      active = false;
    };
  }, [selectedGymId]);

  if (loading) {
    return (
      <div className="p-6">
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="glass-card p-10 text-center">
          <CardHeader>
            <CardTitle>Could not load members</CardTitle>
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
          <Users className="h-6 w-6" />
          Members
        </h1>
        <p className="text-muted-foreground text-sm">Active members by gym.</p>
      </motion.div>

      {gyms.length > 0 && (
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
      )}

      {!invoiceEligible && (
        <Card className="glass-card border-amber-500/30 bg-amber-500/10">
          <CardHeader>
            <CardTitle>Invoices locked</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
            <p>Upgrade to Starter or Pro to generate GST or non-GST invoices for members.</p>
            <Button asChild size="sm" className="self-start">
              <Link href="/owners">Upgrade plan</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Active members</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-muted-foreground text-sm">No active members.</p>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between py-2 border-b border-white/10 last:border-0"
                >
                  <div>
                    <p className="font-medium">{m.user?.name ?? "—"}</p>
                    <p className="text-sm text-muted-foreground">{m.user?.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-muted-foreground">{m.planType}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!invoiceEligible || invoiceLoading === m.id}
                      onClick={() => {
                        setInvoiceModal({ memberId: m.id, name: m.user?.name ?? "Member" });
                        setInvoiceType("NON_GST");
                        setInvoiceLayout("A4");
                        setInvoiceError(null);
                      }}
                    >
                      {invoiceLoading === m.id ? "Loading..." : "Invoice"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!invoiceModal} onOpenChange={(open) => !open && setInvoiceModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Choose invoice type and layout for {invoiceModal?.name}.</p>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Invoice type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setInvoiceType("GST")}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    invoiceType === "GST" ? "border-primary/50 bg-primary/10 text-primary" : "border-white/10"
                  }`}
                >
                  GST invoice
                </button>
                <button
                  type="button"
                  onClick={() => setInvoiceType("NON_GST")}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    invoiceType === "NON_GST" ? "border-primary/50 bg-primary/10 text-primary" : "border-white/10"
                  }`}
                >
                  Non-GST invoice
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Layout</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setInvoiceLayout("A4")}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    invoiceLayout === "A4" ? "border-primary/50 bg-primary/10 text-primary" : "border-white/10"
                  }`}
                >
                  A4
                </button>
                <button
                  type="button"
                  onClick={() => setInvoiceLayout("THERMAL")}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    invoiceLayout === "THERMAL" ? "border-primary/50 bg-primary/10 text-primary" : "border-white/10"
                  }`}
                >
                  80mm thermal
                </button>
              </div>
            </div>
            {invoiceError && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {invoiceError}
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setInvoiceModal(null)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!invoiceModal) return;
                setInvoiceLoading(invoiceModal.memberId);
                const result = await fetchJson<{ invoice?: { id: string }; error?: string }>(
                  "/api/owner/invoices/membership",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      membershipId: invoiceModal.memberId,
                      invoiceType,
                    }),
                    retries: 1,
                  }
                );
                if (result.ok && result.data?.invoice?.id) {
                  const url = `/api/owner/invoices/${result.data.invoice.id}?layout=${invoiceLayout}`;
                  window.open(url, "_blank");
                  setInvoiceError(null);
                } else {
                  setInvoiceError(result.error ?? "Unable to generate invoice.");
                  setInvoiceLoading(null);
                  return;
                }
                setInvoiceLoading(null);
                setInvoiceModal(null);
              }}
            >
              Download PDF
            </Button>
            <Button
              className="bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-glow"
              onClick={async () => {
                if (!invoiceModal) return;
                setInvoiceLoading(invoiceModal.memberId);
                const result = await fetchJson<{ invoice?: { id: string }; error?: string }>(
                  "/api/owner/invoices/membership",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      membershipId: invoiceModal.memberId,
                      invoiceType,
                    }),
                    retries: 1,
                  }
                );
                if (result.ok && result.data?.invoice?.id) {
                  const url = `/api/owner/invoices/${result.data.invoice.id}?layout=${invoiceLayout}&disposition=inline`;
                  const win = window.open(url, "_blank", "noopener,noreferrer");
                  if (win) {
                    win.addEventListener("load", () => {
                      win.print();
                    });
                  }
                  setInvoiceError(null);
                } else {
                  setInvoiceError(result.error ?? "Unable to generate invoice.");
                  setInvoiceLoading(null);
                  return;
                }
                setInvoiceLoading(null);
                setInvoiceModal(null);
              }}
            >
              Print
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
