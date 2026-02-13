"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Circle,
  Clock,
  Edit3,
  ExternalLink,
  Eye,
  Loader2,
  MapPin,
  Share2,
  Sparkles,
  Users,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJson } from "@/lib/client-fetch";
import { buildGymSlug, formatPrice } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { isPaymentsEnabled, openRazorpayCheckout } from "@/lib/razorpay-checkout";
import { Progress } from "@/components/ui/progress";
import { runWhenIdle } from "@/lib/browser-idle";

type Transaction = {
  id: string;
  gymId: string;
  totalAmount: number;
  platformCommissionAmount: number;
  gymPayoutAmount: number;
  paymentStatus: string;
  settlementStatus: string;
  createdAt?: string;
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
  const [exploreGyms, setExploreGyms] = useState<any[]>([]);
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
  const [boostGym, setBoostGym] = useState<any | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceLookup, setInvoiceLookup] = useState<any | null>(null);
  const [invoiceLookupError, setInvoiceLookupError] = useState<string | null>(null);
  const [invoiceLookupLoading, setInvoiceLookupLoading] = useState(false);
  const [nextActionOverrides, setNextActionOverrides] = useState<Record<string, boolean>>({});
  const [nextActionGymId, setNextActionGymId] = useState<string | null>(null);
  const paymentsEnabled = isPaymentsEnabled() || isAdmin;

  useEffect(() => {
    let active = true;
    let cancelIdle: () => void = () => {};

    fetchJson<{ gyms?: any[]; error?: string }>("/api/owner/gym", {
      retries: 1,
      useCache: true,
      cacheKey: "owner-gyms-full",
      cacheTtlMs: 30000,
    })
      .then((gymResult) => {
        if (!active) return;
        if (!gymResult.ok) {
          setError(gymResult.error ?? "Failed to load gyms");
          setGyms([]);
          return;
        }
        setGyms(gymResult.data?.gyms ?? []);
      })
      .catch(() => {
        if (!active) return;
        setGyms([]);
        setError("Failed to load dashboard");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const loadExtras = () => {
      Promise.all([
        fetchJson<{ transactions?: Transaction[]; error?: string }>("/api/owner/transactions", {
          retries: 1,
          useCache: true,
          cacheKey: "owner-transactions",
          cacheTtlMs: 15000,
        }),
        fetchJson<{ leads?: Array<{ gymId: string; gymName: string; totalLeads: number; leadsLast30Days: number }>; error?: string }>(
          "/api/owner/leads",
          {
            retries: 1,
            useCache: true,
            cacheKey: "owner-leads",
            cacheTtlMs: 15000,
          }
        ),
        fetchJson<{ gyms?: any[]; error?: string }>("/api/owner/explore", {
          retries: 1,
          useCache: true,
          cacheKey: "owner-explore-gyms",
          cacheTtlMs: 20000,
        }),
      ])
        .then(([txResult, leadsResult, exploreResult]) => {
          if (!active) return;
          setTransactions(txResult.ok ? txResult.data?.transactions ?? [] : []);
          setLeads(leadsResult.ok ? leadsResult.data?.leads ?? [] : []);
          setExploreGyms(exploreResult.ok ? exploreResult.data?.gyms ?? [] : []);
        })
        .catch(() => {
          if (!active) return;
          setTransactions([]);
          setLeads([]);
          setExploreGyms([]);
        });
    };

    cancelIdle = runWhenIdle(loadExtras);

    return () => {
      active = false;
      cancelIdle();
    };
  }, []);

  const totalMembers = gyms.reduce(
    (sum, gym) => sum + (gym._count?.memberships ?? 0),
    0
  );

  const formatStatus = (status?: string | null) => (status ?? "unknown").replace(/_/g, " ");

  const startBoost = async (gymId: string) => {
    if (!paymentsEnabled) {
      toast({ title: "Payments not available yet", description: "Please try again later." });
      return;
    }
    setFeaturing(gymId);
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
        body: JSON.stringify({ gymId }),
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
        setGyms((prev) => prev.map((g) => (g.id === gymId ? { ...g, featuredUntil: result.data?.featuredUntil } : g)));
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
              gymId,
              orderId: res.razorpay_order_id,
              paymentId: res.razorpay_payment_id,
              signature: res.razorpay_signature,
            }),
            retries: 1,
          });
          if (verifyResult.ok) {
            toast({ title: "Boost activated", description: "Your gym is featured for 3 days." });
            setGyms((prev) =>
              prev.map((g) => (g.id === gymId ? { ...g, featuredUntil: verifyResult.data?.featuredUntil } : g))
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
  };

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
  const primaryGym = gyms[0] ?? null;
  const exploreStats = primaryGym
    ? exploreGyms.find((g) => g.id === primaryGym.id)
    : null;
  const profileViews = exploreStats?.stats?.pageViews ?? null;
  const leadsLast30Total = leads.reduce((sum, l) => sum + (l.leadsLast30Days ?? 0), 0);
  const estimatedLeadsThisWeek = leadsLast30Total ? Math.round(leadsLast30Total / 4) : 0;
  const hasLeads = leadsLast30Total > 0;

  const verificationProgress = (status: string | null | undefined) => {
    switch (status) {
      case "VERIFIED":
        return 100;
      case "PENDING":
        return 70;
      case "REJECTED":
        return 40;
      default:
        return 25;
    }
  };

  const profileCompleteness = (gym: any | null) => {
    if (!gym) return 0;
    const hasPhotos = Array.isArray(gym.imageUrls) ? gym.imageUrls.length > 0 : !!gym.coverImageUrl;
    const hasTimings = !!gym.openTime && !!gym.closeTime && !!gym.openDays;
    const hasPricing = !!gym.monthlyPrice && !!gym.yearlyPrice;
    const hasLocation = !!gym.address && !!gym.city;
    const hasSocials = !!(gym.instagramUrl || gym.facebookUrl || gym.youtubeUrl);
    const hasKyc = gym.verificationStatus && gym.verificationStatus !== "UNVERIFIED";
    const checks = [hasPhotos, hasTimings, hasPricing, hasLocation, hasSocials, hasKyc];
    const done = checks.filter(Boolean).length;
    return Math.round((done / checks.length) * 100);
  };

  const getVisibilityMeta = (gym: any | null) => {
    const score = profileCompleteness(gym);
    const label = score >= 80 ? "High" : score >= 50 ? "Medium" : "Low";
    const tone =
      score >= 80
        ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/30"
        : score >= 50
          ? "bg-amber-500/15 text-amber-200 border-amber-500/30"
          : "bg-rose-500/15 text-rose-200 border-rose-500/30";
    return { score, label, tone };
  };
  const { score: visibilityScore, label: visibilityLabel } = getVisibilityMeta(primaryGym);

  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const paidTransactions = transactions.filter((t) => t.paymentStatus === "PAID" && t.createdAt);
  const membersThisWeek = paidTransactions.filter((t) => new Date(t.createdAt as string).getTime() >= now - weekMs).length;
  const membersPrevWeek = paidTransactions.filter((t) => {
    const ts = new Date(t.createdAt as string).getTime();
    return ts < now - weekMs && ts >= now - weekMs * 2;
  }).length;
  const membersDelta = membersThisWeek - membersPrevWeek;

  const formatTime = (value?: string | Date | null) => {
    if (!value) return "";
    const date = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString();
  };

  const activityItems = (() => {
    if (!primaryGym) return [] as Array<{ title: string; time?: string; meta?: string; simulated?: boolean; ts?: number }>;
    const list: Array<{ title: string; time?: string; meta?: string; simulated?: boolean; ts?: number }> = [];
    const createdAt = primaryGym.createdAt ? new Date(primaryGym.createdAt).getTime() : undefined;
    const updatedAt = primaryGym.updatedAt ? new Date(primaryGym.updatedAt).getTime() : undefined;
    list.push({
      title: "Gym profile created",
      time: formatTime(primaryGym.createdAt),
      simulated: !primaryGym.createdAt,
      ts: createdAt,
    });
    if (primaryGym.verificationStatus === "PENDING") {
      list.push({
        title: "Verification pending",
        time: formatTime(primaryGym.updatedAt),
        simulated: !primaryGym.updatedAt,
        ts: updatedAt,
      });
    }
    if (primaryGym.verificationStatus === "VERIFIED") {
      list.push({
        title: "Verification completed",
        time: formatTime(primaryGym.updatedAt),
        simulated: !primaryGym.updatedAt,
        ts: updatedAt,
      });
    }
    if (paidTransactions.length > 0) {
      const latestTx = paidTransactions[0];
      const latestTxTime = latestTx?.createdAt ? new Date(latestTx.createdAt).getTime() : undefined;
      list.push({
        title: "Invoice generated",
        time: formatTime(latestTx?.createdAt),
        meta: "Latest membership payment",
        ts: latestTxTime,
      });
    }
    if (profileViews && profileViews > 0) {
      list.push({
        title: "Gym viewed by a user",
        time: "Recent",
        meta: `${profileViews} profile views`,
        simulated: true,
      });
    }
    if ((primaryGym.partnerDiscountPercent ?? 0) > 0) {
      list.push({
        title: "Discount enabled",
        time: "Active",
        meta: `${primaryGym.partnerDiscountPercent}% partner discount`,
        simulated: true,
      });
    }
    return list
      .sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0))
      .slice(0, 6);
  })();

  useEffect(() => {
    if (!primaryGym?.id) {
      setNextActionOverrides({});
      setNextActionGymId(null);
      return;
    }
    if (nextActionGymId === primaryGym.id) return;
    const hasPhotos = Array.isArray(primaryGym.imageUrls)
      ? primaryGym.imageUrls.length > 0
      : !!primaryGym.coverImageUrl;
    const hasTimings = !!primaryGym.openTime && !!primaryGym.closeTime && !!primaryGym.openDays;
    const hasPricing = !!primaryGym.monthlyPrice && !!primaryGym.yearlyPrice;
    const hasKyc = primaryGym.verificationStatus && primaryGym.verificationStatus !== "UNVERIFIED";
    const hasShare = (profileViews ?? 0) > 0 || leadsLast30Total > 0;
    setNextActionOverrides({
      gst: !!hasKyc,
      photos: !!(hasPhotos && hasTimings),
      pricing: !!hasPricing,
      share: !!hasShare,
    });
    setNextActionGymId(primaryGym.id);
  }, [primaryGym, profileViews, leadsLast30Total, nextActionGymId]);

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

  const checklistItems = [
    {
      id: "gst",
      label: "Submit GST / KYC",
      href: "/dashboard/owner/verification",
    },
    {
      id: "photos",
      label: "Add gym photos & timings",
      href: "/dashboard/owner/gym",
    },
    {
      id: "pricing",
      label: "Set pricing & discounts",
      href: "/dashboard/owner/discounts",
    },
    {
      id: "share",
      label: "Share gym link",
      href: primaryGym ? `/explore/${buildGymSlug(primaryGym.name, primaryGym.id)}` : "/dashboard/owner",
    },
  ];
  const checklistProgress = Math.round(
    (checklistItems.filter((item) => nextActionOverrides[item.id]).length / checklistItems.length) * 100
  );
  const lastUpdatedLabel = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Hi, {displayName}</h1>
          <p className="text-muted-foreground text-sm">Owner dashboard overview.</p>
        </div>
      </div>

      <Card className="glass-card border-primary/30">
        <CardHeader>
          <CardTitle className="text-2xl">Get your gym live in under 10 minutes</CardTitle>
          <CardDescription>Finish these steps to start getting leads and memberships.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Next action progress</div>
              <div className="text-xl font-semibold">{checklistProgress}% complete</div>
              <div className="text-xs text-muted-foreground">Last updated {lastUpdatedLabel}</div>
            </div>
            <div className="w-full lg:w-64 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{checklistProgress}%</span>
              </div>
              <Progress value={checklistProgress} />
              {!primaryGym && (
                <div className="text-xs text-muted-foreground">
                  Add your first gym to unlock the setup checklist.
                </div>
              )}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {checklistItems.map((item) => {
              const done = !!nextActionOverrides[item.id];
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setNextActionOverrides((prev) => ({
                      ...prev,
                      [item.id]: !prev[item.id],
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setNextActionOverrides((prev) => ({
                        ...prev,
                        [item.id]: !prev[item.id],
                      }));
                    }
                  }}
                  className="flex items-center justify-between rounded-lg border border-white/10 px-4 py-3 text-sm transition-colors hover:bg-white/5"
                >
                  <div className="flex items-center gap-3">
                    {done ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className={done ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={item.href} onClick={(e) => e.stopPropagation()}>
                      Open
                    </Link>
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="glass-card">
          <CardHeader>
            <CardDescription>Members</CardDescription>
            <CardTitle className="text-3xl">{totalMembers > 0 ? totalMembers : "—"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {totalMembers > 0 ? (
              <div className="flex items-center gap-2 text-emerald-300">
                {membersDelta >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                <span>{membersDelta >= 0 ? `+${membersDelta}` : membersDelta} this week</span>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-muted-foreground">No members yet. Share your gym link to get your first booking.</p>
                {primaryGym && (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/explore/${buildGymSlug(primaryGym.name, primaryGym.id)}`}>Share gym link</Link>
                  </Button>
                )}
              </div>
            )}
            <div className="text-xs text-muted-foreground">Last updated {lastUpdatedLabel}</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader>
            <CardDescription>Leads this week</CardDescription>
            <CardTitle className="text-3xl">{hasLeads ? estimatedLeadsThisWeek : "—"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {hasLeads ? (
              <div className="flex items-center gap-2 text-emerald-300">
                <ArrowUpRight className="h-4 w-4" />
                <span>Estimated from last 30 days</span>
              </div>
            ) : (
              <p className="text-muted-foreground">Leads will appear once your profile goes live.</p>
            )}
            <div className="text-xs text-muted-foreground">Last updated {lastUpdatedLabel}</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader>
            <CardDescription>Profile views</CardDescription>
            <CardTitle className="text-3xl">{profileViews != null ? profileViews : "—"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {profileViews != null ? (
              <div className="flex items-center gap-2 text-emerald-300">
                <Eye className="h-4 w-4" />
                <span>{profileViews > 0 ? "Trending up" : "No views yet"}</span>
              </div>
            ) : (
              <p className="text-muted-foreground">Unlock view tracking after your first boost.</p>
            )}
            <div className="text-xs text-muted-foreground">Last updated {lastUpdatedLabel}</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader>
            <CardDescription>Gym visibility</CardDescription>
            <CardTitle className="text-3xl">{primaryGym ? `${visibilityScore}%` : "—"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {primaryGym ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <ArrowUpRight className="h-4 w-4 text-emerald-300" />
                <span>{visibilityLabel} visibility · Complete your profile to improve rank</span>
              </div>
            ) : (
              <p className="text-muted-foreground">Create a gym profile to start building visibility.</p>
            )}
            <div className="text-xs text-muted-foreground">Last updated {lastUpdatedLabel}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Updates from your gyms in chronological order.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {activityItems.length === 0 ? (
            <div className="rounded-lg border border-white/10 p-4 text-sm text-muted-foreground">
              No activity yet. Publish your gym and share the link to start seeing updates.
            </div>
          ) : (
            <div className="space-y-3">
              {activityItems.map((item, index) => (
                <div key={`${item.title}-${index}`} className="flex items-start justify-between gap-4 border-b border-white/10 pb-3 last:border-0 last:pb-0">
                  <div>
                    <div className="font-medium">{item.title}</div>
                    {item.meta && <div className="text-xs text-muted-foreground">{item.meta}</div>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {item.simulated && (
                      <span className="rounded-full border border-white/10 px-2 py-0.5">Simulated</span>
                    )}
                    <Clock className="h-3 w-3" />
                    <span>{item.time || "Just now"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {gyms.length === 0 ? (
        <Card className="glass-card p-12 text-center">
          <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">No gyms yet. Create one to start your setup checklist.</p>
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
          {gyms.map((gym) => {
            const visibility = getVisibilityMeta(gym);
            return (
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
                  <span className={`rounded-full border px-3 py-1 text-xs ${visibility.tone}`}>
                    Visibility: {visibility.label}
                  </span>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {gym._count?.memberships ?? 0} members
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Verification progress</span>
                    <span>{verificationProgress(gym.verificationStatus)}%</span>
                  </div>
                  <Progress value={verificationProgress(gym.verificationStatus)} />
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

                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {gym.featuredUntil && new Date(gym.featuredUntil).getTime() > Date.now() && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-3 py-1 text-xs text-primary">
                      <Sparkles className="h-3 w-3" />
                      Featured until {new Date(gym.featuredUntil).toLocaleDateString()}
                    </span>
                  )}
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/explore/${buildGymSlug(gym.name, gym.id)}`}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View public profile
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/dashboard/owner/gym">
                      <Edit3 className="h-4 w-4 mr-2" />
                      Edit gym details
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/dashboard/user/join/${gym.id}`}>
                      <Share2 className="h-4 w-4 mr-2" />
                      Share invite link
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-glow"
                    disabled={!paymentsEnabled || featuring === gym.id}
                    onClick={() => setBoostGym(gym)}
                  >
                    {featuring === gym.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : paymentsEnabled ? (
                      "Boost for ₹99"
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
            );
          })}
        </div>
      )}

      {gyms.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Leads</CardTitle>
              <CardDescription>Breakdown across gyms</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {leads.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">No leads yet. Complete your profile to improve discovery.</p>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/dashboard/owner/gym">Update gym profile</Link>
                  </Button>
                </div>
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
              <div className="text-xs text-muted-foreground">Last updated {lastUpdatedLabel}</div>
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

      <Dialog open={!!boostGym} onOpenChange={(open) => !open && setBoostGym(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Boost visibility for ₹99</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Get top placement in Explore for 3 days. Best for launch weeks, events, and new offers.
            </p>
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs">
              {boostGym?.name}
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setBoostGym(null)}>
              Not now
            </Button>
            <Button
              className="bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-glow"
              disabled={!boostGym || featuring === boostGym?.id}
              onClick={async () => {
                if (!boostGym) return;
                await startBoost(boostGym.id);
                setBoostGym(null);
              }}
            >
              {featuring === boostGym?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Boost now"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
