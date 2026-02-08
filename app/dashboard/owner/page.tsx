"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, Sparkles, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJson } from "@/lib/client-fetch";
import { formatPrice } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { isPaymentsEnabled, openRazorpayCheckout } from "@/lib/razorpay-checkout";

type Transaction = {
  id: string;
  gymId: string;
  totalAmount: number;
  platformCommissionAmount: number;
  gymPayoutAmount: number;
  paymentStatus: string;
  settlementStatus: string;
};

export default function OwnerDashboardPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role;
  const isAdmin = role === "ADMIN";
  const { toast } = useToast();
  const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
  const [gyms, setGyms] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [leads, setLeads] = useState<Array<{ gymId: string; gymName: string; totalLeads: number; leadsLast30Days: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gstGym, setGstGym] = useState<any | null>(null);
  const [gstForm, setGstForm] = useState({
    gstNumber: "",
    gstLegalName: "",
    gstCity: "",
    gstCertificateUrl: "",
  });
  const [uploading, setUploading] = useState(false);
  const [submittingGst, setSubmittingGst] = useState(false);
  const [featuring, setFeaturing] = useState<string | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceLookup, setInvoiceLookup] = useState<any | null>(null);
  const [invoiceLookupError, setInvoiceLookupError] = useState<string | null>(null);
  const [invoiceLookupLoading, setInvoiceLookupLoading] = useState(false);
  const paymentsEnabled = isPaymentsEnabled() || isAdmin;

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchJson<{ gyms?: any[]; error?: string }>("/api/owner/gym", { retries: 1 }),
      fetchJson<{ transactions?: Transaction[]; error?: string }>("/api/owner/transactions", { retries: 1 }),
      fetchJson<{ leads?: Array<{ gymId: string; gymName: string; totalLeads: number; leadsLast30Days: number }>; error?: string }>(
        "/api/owner/leads",
        { retries: 1 }
      ),
    ])
      .then(([gymResult, txResult, leadsResult]) => {
        if (!active) return;
        if (!gymResult.ok) {
          setError(gymResult.error ?? "Failed to load gyms");
          setGyms([]);
          return;
        }
        setGyms(gymResult.data?.gyms ?? []);
        if (txResult.ok) {
          setTransactions(txResult.data?.transactions ?? []);
        } else {
          setTransactions([]);
        }
        if (leadsResult.ok) {
          setLeads(leadsResult.data?.leads ?? []);
        } else {
          setLeads([]);
        }
      })
      .catch(() => {
        if (!active) return;
        setGyms([]);
        setTransactions([]);
        setError("Failed to load dashboard");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="glass-card p-10 text-center">
          <CardHeader>
            <CardTitle>Could not load dashboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalMembers = gyms.reduce(
    (sum, gym) => sum + (gym._count?.memberships ?? 0),
    0
  );

  const formatStatus = (status: string) => status.replace(/_/g, " ");

  const openGstDialog = (gym: any) => {
    setGstGym(gym);
    setGstForm({
      gstNumber: gym.gstNumber ?? "",
      gstLegalName: "",
      gstCity: "",
      gstCertificateUrl: gym.gstCertificateUrl ?? "",
    });
  };

  const submitGst = async () => {
    if (!gstGym?.id) return;
    if (!gstForm.gstNumber.trim() || !gstForm.gstCertificateUrl) {
      toast({ title: "Missing info", description: "GST number and certificate are required.", variant: "destructive" });
      return;
    }
    setSubmittingGst(true);
    try {
      const result = await fetchJson<{ ok?: boolean; error?: string; verificationNotes?: string }>(
        "/api/owner/gym/verification/gst",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gymId: gstGym.id,
            gstNumber: gstForm.gstNumber.trim(),
            gstCertificateUrl: gstForm.gstCertificateUrl,
            gstLegalName: gstForm.gstLegalName.trim() || undefined,
            gstCity: gstForm.gstCity.trim() || undefined,
          }),
          retries: 1,
        }
      );
      if (!result.ok) {
        toast({ title: "Submission failed", description: result.error ?? "Please try again.", variant: "destructive" });
        setSubmittingGst(false);
        return;
      }
      toast({ title: "GST submitted", description: result.data?.verificationNotes ?? "Verification is pending." });
      setGstGym(null);
    } catch {
      toast({ title: "Submission failed", variant: "destructive" });
    }
    setSubmittingGst(false);
  };

  const displayName = session?.user?.name ?? "there";

  return (
    <div className="p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold">Hi, {displayName}</h1>
          <p className="text-muted-foreground text-sm">Owner dashboard overview.</p>
        </div>
      </motion.div>

      {gyms.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="glass-card">
            <CardHeader>
              <CardDescription>Total gyms</CardDescription>
              <CardTitle className="text-3xl">{gyms.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="glass-card">
            <CardHeader>
              <CardDescription>Total members</CardDescription>
              <CardTitle className="text-3xl">{totalMembers}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {gyms.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Leads</CardTitle>
              <CardDescription>Total and last 30 days</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {leads.length === 0 ? (
                <p className="text-sm text-muted-foreground">No leads yet.</p>
              ) : (
                <div className="space-y-2">
                  {leads.map((l) => (
                    <div key={l.gymId} className="flex items-center justify-between text-sm">
                      <div className="text-muted-foreground">{l.gymName}</div>
                      <div className="text-foreground">{l.totalLeads} · last 30 days {l.leadsLast30Days}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Invoice lookup</CardTitle>
              <CardDescription>Search by invoice number</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="INV-202602-1234"
                />
                <Button
                  size="sm"
                  disabled={!invoiceNumber.trim() || invoiceLookupLoading}
                  onClick={async () => {
                    setInvoiceLookupLoading(true);
                    setInvoiceLookupError(null);
                    setInvoiceLookup(null);
                    const res = await fetchJson<{ invoice?: any; error?: string }>(
                      `/api/owner/invoices/lookup?invoiceNumber=${encodeURIComponent(invoiceNumber.trim())}`,
                      { retries: 1 }
                    );
                    if (res.ok && res.data?.invoice) {
                      setInvoiceLookup(res.data.invoice);
                    } else {
                      setInvoiceLookupError(res.error ?? "Invoice not found");
                    }
                    setInvoiceLookupLoading(false);
                  }}
                >
                  {invoiceLookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lookup"}
                </Button>
              </div>
              {invoiceLookupError && <p className="text-sm text-muted-foreground">{invoiceLookupError}</p>}
              {invoiceLookup && (
                <div className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium">{invoiceLookup.invoiceNumber}</div>
                    <div className="text-xs text-muted-foreground">Issued {new Date(invoiceLookup.issuedAt).toLocaleDateString()}</div>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <a href={`/api/owner/invoices/${invoiceLookup.id}`}>Download PDF</a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {gyms.length === 0 ? (
        <Card className="glass-card p-12 text-center">
          <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">No gyms yet</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild>
              <Link href="/dashboard/owner/gym">Add your first gym</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/owners">See plans</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {gyms.map((gym) => (
            <Card key={gym.id} className="glass-card">
              <CardHeader>
                <CardTitle>{gym.name}</CardTitle>
                <CardDescription>{gym.address}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs">
                    Status: <span className="font-semibold">{formatStatus(gym.verificationStatus)}</span>
                  </span>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {gym._count?.memberships ?? 0} members
                  </div>
                </div>

                {gym.verificationStatus !== "VERIFIED" && (
                  <div className="space-y-2 text-sm">
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-200">
                      Membership acceptance is disabled until verification is complete.
                    </div>
                    <div className="text-muted-foreground">
                      Notes: {gym.verificationNotes ?? "No admin notes yet."}
                    </div>
                    <Dialog open={gstGym?.id === gym.id} onOpenChange={(open) => !open && setGstGym(null)}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="secondary" onClick={() => openGstDialog(gym)}>
                          Submit GST certificate
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-xl">
                        <DialogHeader>
                          <DialogTitle>GST verification</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4">
                          <div className="space-y-2">
                            <Label>GST number</Label>
                            <Input
                              value={gstForm.gstNumber}
                              onChange={(e) => setGstForm((p) => ({ ...p, gstNumber: e.target.value }))}
                              placeholder="22AAAAA0000A1Z5"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Legal name (optional)</Label>
                            <Input
                              value={gstForm.gstLegalName}
                              onChange={(e) => setGstForm((p) => ({ ...p, gstLegalName: e.target.value }))}
                              placeholder="Legal entity name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>GST city (optional)</Label>
                            <Input
                              value={gstForm.gstCity}
                              onChange={(e) => setGstForm((p) => ({ ...p, gstCity: e.target.value }))}
                              placeholder="City"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>GST certificate (image only, ≤ 2MB)</Label>
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
                                  toast({ title: "File too large", description: "Image must be 2MB or less.", variant: "destructive" });
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
                                  setGstForm((p) => ({ ...p, gstCertificateUrl: uploadJson.secure_url }));
                                } catch {
                                  toast({ title: "Upload failed", variant: "destructive" });
                                }
                                setUploading(false);
                              }}
                            />
                            {gstForm.gstCertificateUrl && (
                              <img src={gstForm.gstCertificateUrl} alt="GST certificate" className="h-32 w-full rounded-lg object-cover" />
                            )}
                            {uploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
                          </div>
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setGstGym(null)}>Cancel</Button>
                          <Button onClick={submitGst} disabled={uploading || submittingGst}>
                            {uploading || submittingGst ? "Submitting…" : "Submit"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 text-sm">
                  {gym.featuredUntil && new Date(gym.featuredUntil).getTime() > Date.now() && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-3 py-1 text-xs text-primary">
                      <Sparkles className="h-3 w-3" />
                      Featured until {new Date(gym.featuredUntil).toLocaleDateString()}
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!paymentsEnabled || featuring === gym.id}
                    onClick={async () => {
                      if (!paymentsEnabled) {
                        toast({ title: "Payments not available yet", description: "Please try again later." });
                        return;
                      }
                      setFeaturing(gym.id);
                      try {
                        const result = await fetchJson<{
                          amount: number;
                          currency?: string;
                          orderId: string;
                          featuredUntil?: string;
                          error?: string;
                        }>("/api/owner/gym/feature", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ gymId: gym.id }),
                          retries: 1,
                        });
                        if (!result.ok) {
                          toast({
                            title: "Error",
                            description: result.error ?? "Failed to start payment",
                            variant: "destructive",
                          });
                          setFeaturing(null);
                          return;
                        }
                        if (isAdmin && result.data?.featuredUntil) {
                          toast({ title: "Boost activated", description: "Admin access applied." });
                          setGyms((prev) =>
                            prev.map((g) =>
                              g.id === gym.id ? { ...g, featuredUntil: result.data?.featuredUntil } : g
                            )
                          );
                          setFeaturing(null);
                          return;
                        }
                        const checkout = await openRazorpayCheckout({
                          orderId: result.data?.orderId ?? "",
                          amount: result.data?.amount ?? 0,
                          currency: result.data?.currency ?? "INR",
                          name: "FITDEX",
                          onSuccess: async (res) => {
                            const verifyResult = await fetchJson<{
                              featuredUntil?: string;
                              error?: string;
                            }>("/api/owner/gym/feature/verify", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                gymId: gym.id,
                                orderId: res.razorpay_order_id,
                                paymentId: res.razorpay_payment_id,
                                signature: res.razorpay_signature,
                              }),
                              retries: 1,
                            });
                            if (verifyResult.ok) {
                              toast({ title: "Boost activated", description: "Your gym is featured for 3 days." });
                              setGyms((prev) =>
                                prev.map((g) =>
                                  g.id === gym.id ? { ...g, featuredUntil: verifyResult.data?.featuredUntil } : g
                                )
                              );
                            } else {
                              toast({
                                title: "Verification failed",
                                description: verifyResult.error ?? "Payment failed",
                                variant: "destructive",
                              });
                            }
                          },
                        });
                        if (!checkout.ok && checkout.error && checkout.error !== "DISMISSED") {
                          const message = checkout.error === "PAYMENTS_DISABLED" ? "Payments not available yet" : checkout.error;
                          toast({ title: "Payments unavailable", description: message, variant: "destructive" });
                        }
                      } catch {
                        toast({ title: "Error", variant: "destructive" });
                      }
                      setFeaturing(null);
                    }}
                  >
                    {featuring === gym.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : paymentsEnabled ? (
                      "Boost ₹99 / 3 days"
                    ) : (
                      "Payments not available"
                    )}
                  </Button>
                </div>

                {gym.verificationStatus === "VERIFIED" && (
                  <div className="grid gap-3 text-sm">
                    {(() => {
                      const gymTransactions = transactions.filter((t) => t.gymId === gym.id);
                      const paidTransactions = gymTransactions.filter((t) => t.paymentStatus === "PAID");
                      const membershipsSold = paidTransactions.length;
                      const gross = paidTransactions.reduce((sum, t) => sum + (t.totalAmount ?? 0), 0);
                      const commission = paidTransactions.reduce(
                        (sum, t) => sum + (t.platformCommissionAmount ?? 0),
                        0
                      );
                      const net = paidTransactions.reduce(
                        (sum, t) => sum + (t.gymPayoutAmount ?? 0),
                        0
                      );
                      const settlementCounts = paidTransactions.reduce(
                        (acc, t) => {
                          const key = t.settlementStatus ?? "UNKNOWN";
                          acc[key] = (acc[key] ?? 0) + 1;
                          return acc;
                        },
                        {} as Record<string, number>
                      );
                      const settlementSummary = Object.entries(settlementCounts)
                        .map(([status, count]) => `${formatStatus(status)}: ${count}`)
                        .join(" · ");

                      return (
                        <div className="space-y-2">
                          <div className="grid gap-2 md:grid-cols-2">
                            <div>Memberships sold: <span className="font-semibold">{membershipsSold}</span></div>
                            <div>Gross amount: <span className="font-semibold">{formatPrice(gross)}</span></div>
                            <div>Platform commission: <span className="font-semibold">{formatPrice(commission)}</span></div>
                            <div>Net payout: <span className="font-semibold">{formatPrice(net)}</span></div>
                          </div>
                          <div className="text-muted-foreground">
                            Settlement status: {settlementSummary || "No settlements yet"}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
