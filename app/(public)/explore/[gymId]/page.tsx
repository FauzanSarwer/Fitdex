"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Facebook,
  Instagram,
  MapPin,
  Sparkles,
  ShieldCheck,
  Users,
  Youtube,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { buildGymSlug, formatPrice, parseGymIdFromSlug } from "@/lib/utils";
import { getGymOpenStatus } from "@/lib/gym-hours";
import { fetchJson } from "@/lib/client-fetch";

interface GymData {
  id: string;
  name: string;
  address: string;
  longitude: number;
  verificationStatus: string;
  coverImageUrl: string | null;
  openTime?: string | null;
  closeTime?: string | null;
  openDays?: string | null;
  owner: {
    id: string;
    name: string | null;
    logoUrl?: string | null;
    supportEmail?: string | null;
    supportPhone?: string | null;
    supportWhatsapp?: string | null;
  };
  dayPassPrice?: number | null;
  monthlyPrice: number;
  quarterlyPrice: number;
  yearlyPrice: number;
  partnerDiscountPercent: number;
  quarterlyDiscountType: "PERCENT" | "FLAT";
  quarterlyDiscountValue: number;
  yearlyDiscountType: "PERCENT" | "FLAT";
  yearlyDiscountValue: number;
  welcomeDiscountType: "PERCENT" | "FLAT";
  welcomeDiscountValue: number;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  youtubeUrl?: string | null;
  yearlySavePercent: number;
  quarterlySavePercent: number;
  featuredUntil?: string | Date | null;
  verifiedUntil?: string | Date | null;
}

export default function GymProfilePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.gymId as string;
  const gymId = parseGymIdFromSlug(slug);
  const { status, data: session } = useSession();
  const emailVerified = !!(session?.user as { emailVerified?: boolean })?.emailVerified;
  const [gym, setGym] = useState<GymData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!gymId) return () => { active = false; };
    fetchJson<{ gym?: GymData; error?: string }>(`/api/gyms/${gymId}`, { retries: 1 })
      .then((result) => {
        if (!active) return;
        if (!result.ok) {
          setError(result.error ?? "Gym not found");
          setLoading(false);
          return;
        }
        if (result.data?.gym) setGym(result.data.gym);
        if (!result.data?.gym) setError("Gym not found");
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError("Failed to load gym details");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [gymId]);

  useEffect(() => {
    if (!gym) return;
    const expected = buildGymSlug(gym.name, gym.id);
    if (slug !== expected) {
      router.replace(`/explore/${expected}`);
    }
  }, [gym, slug, router]);


  useEffect(() => {
    if (!gymId) return;
    fetch(`/api/gyms/${gymId}/views`, { method: "POST" }).catch(() => undefined);
  }, [gymId]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetchJson<{ saved?: Array<{ gymId: string }> }>("/api/saved-gyms", { retries: 1 })
      .then((result) => {
        if (!result.ok) return;
        const ids = new Set((result.data?.saved ?? []).map((s) => s.gymId));
        setSaved(ids.has(gymId));
      })
      .catch(() => {});
  }, [gymId, status]);

  useEffect(() => {
    if (status === "unauthenticated") {
      setSaved(false);
    }
  }, [status]);

  async function toggleSave() {
    if (status !== "authenticated") return;
    const next = !saved;
    setSaved(next);
    const result = next
      ? await fetchJson("/api/saved-gyms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gymId }),
          retries: 1,
        })
      : await fetchJson(`/api/saved-gyms?gymId=${gymId}`, { method: "DELETE", retries: 1 });
    if (!result.ok) {
      setSaved(!next);
    }
  }

  const pricing = useMemo(() => {
    if (!gym) return [];
    return [
      ...(gym.dayPassPrice && gym.dayPassPrice > 0
        ? [
            {
              label: "Day pass",
              price: gym.dayPassPrice,
              note: "One-day access",
            },
          ]
        : []),
      {
        label: "Monthly",
        price: gym.monthlyPrice,
        note: "Pay as you go",
      },
      {
        label: "Quarterly",
        price: gym.quarterlyPrice,
        note: gym.quarterlySavePercent ? `Save ${gym.quarterlySavePercent}%` : "Best for 3 months",
      },
      {
        label: "Yearly",
        price: gym.yearlyPrice,
        note: gym.yearlySavePercent ? `Save ${gym.yearlySavePercent}%` : "Best value",
      },
    ];
  }, [gym]);

  const formatDiscount = (type: "PERCENT" | "FLAT", value: number) => {
    if (!value || value <= 0) return "0";
    return type === "PERCENT" ? `${value}%` : formatPrice(value);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-10">
        <Skeleton className="h-72 rounded-3xl mb-6" />
        <Skeleton className="h-40 rounded-3xl" />
      </div>
    );
  }

  if (error || !gym) {
    return (
      <div className="container mx-auto px-4 py-10">
        <Card className="glass-card p-10 text-center">
          <CardHeader>
            <CardTitle>Unable to load gym</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{error ?? "Please try again."}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isVerified = gym.verificationStatus === "VERIFIED";

  return (
    <div className="container mx-auto px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        <Card className="glass-card overflow-hidden border-primary/20">
          <div className="relative h-60 bg-gradient-to-br from-primary/30 via-primary/10 to-accent/20 flex items-center justify-center">
            {gym.coverImageUrl ? (
              <img
                src={gym.coverImageUrl}
                alt={gym.name}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="text-center text-primary/80">
                <Sparkles className="mx-auto h-14 w-14" />
                <p className="text-sm">Gym photo coming soon</p>
              </div>
            )}
            <div className="absolute top-4 right-4 flex items-center gap-2">
              {gym.featuredUntil && new Date(gym.featuredUntil).getTime() > Date.now() && (
                <span className="rounded-full bg-primary/20 text-primary px-3 py-1 text-xs animate-pulse">Featured</span>
              )}
              {isVerified ? (
                <span className="rounded-full bg-emerald-500/20 text-emerald-400 px-3 py-1 text-xs">Verified</span>
              ) : (
                <span className="rounded-full bg-amber-500/20 text-amber-400 px-3 py-1 text-xs">Unverified</span>
              )}
            </div>
          </div>
          <CardHeader className="space-y-2">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold">{gym.name}</h1>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {gym.address}
                </p>
                <p className={`text-xs mt-2 ${getGymOpenStatus({ ...gym, useIst: true }).isOpen ? "text-emerald-400" : "text-muted-foreground"}`}>
                  {getGymOpenStatus({ ...gym, useIst: true }).label}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                {status === "authenticated" && (
                  <Button variant="outline" size="lg" onClick={toggleSave}>
                    {saved ? "Saved" : "Save"}
                  </Button>
                )}
                {status === "authenticated" && !emailVerified ? (
                  <Button size="lg" variant="secondary" disabled>
                    Verify email to invite
                  </Button>
                ) : (
                  <Button asChild size="lg" variant="secondary">
                    <Link
                      href={
                        status === "authenticated"
                          ? "/dashboard/user/duo"
                          : `/auth/login?callbackUrl=${encodeURIComponent("/dashboard/user/duo")}`
                      }
                    >
                      Invite partner
                    </Link>
                  </Button>
                )}
                {isVerified ? (
                  status === "authenticated" && !emailVerified ? (
                    <Button size="lg" disabled>
                      Verify email to join
                    </Button>
                  ) : (
                    <Button asChild size="lg">
                      <Link href={`/dashboard/user/join/${gym.id}`}>
                        Join this gym
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  )
                ) : (
                  <Button size="lg" variant="outline" disabled>
                    Verification pending
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3">
              <ShieldCheck className={`h-6 w-6 ${isVerified ? "text-primary" : "text-muted-foreground"}`} />
              <div>
                <div className="text-sm font-medium">{isVerified ? "Verified partner" : "Unverified gym"}</div>
                <div className="text-xs text-muted-foreground">
                  {isVerified ? "Secure payments & support" : "Verification pending. Joining is disabled."}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-primary" />
              <div>
                <div className="text-sm font-medium">Duo discount</div>
                <div className="text-xs text-muted-foreground">Up to {gym.partnerDiscountPercent}% off</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-6 w-6 text-primary" />
              <div>
                <div className="text-sm font-medium">Instant access</div>
                <div className="text-xs text-muted-foreground">Activate membership in minutes</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {!isVerified && (
          <Card className="glass-card border-amber-500/30 bg-amber-500/10">
            <CardHeader>
              <CardTitle className="text-lg">Verification pending</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              This gym is visible but can’t accept new members until the owner’s verification is complete.
            </CardContent>
          </Card>
        )}

        <Card className="glass-card border-primary/30 bg-primary/10">
          <CardHeader>
            <CardTitle className="text-lg">Duo discount highlight</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-muted-foreground">
              Save up to <span className="font-semibold text-foreground">{gym.partnerDiscountPercent}%</span> when you invite a
              partner. Duo discounts are one of the most popular ways to join.
            </div>
            {status === "authenticated" && !emailVerified ? (
              <Button variant="secondary" disabled>
                Verify email to invite
              </Button>
            ) : (
              <Button asChild variant="secondary">
                <Link
                  href={
                    status === "authenticated"
                      ? "/dashboard/user/duo"
                      : `/auth/login?callbackUrl=${encodeURIComponent("/dashboard/user/duo")}`
                  }
                >
                  Invite partner
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          {pricing.map((p) => (
            <Card key={p.label} className="glass-card hover:border-primary/30 transition-all duration-300 hover:-translate-y-1">
              <CardHeader>
                <CardTitle>{p.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-bold text-primary">
                  {formatPrice(p.price)}
                </div>
                <div className="text-sm text-muted-foreground">{p.note}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Discounts & perks</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 text-sm text-muted-foreground">
            <div>Welcome discount: up to {formatDiscount(gym.welcomeDiscountType, gym.welcomeDiscountValue)}</div>
            <div>Yearly discount: up to {formatDiscount(gym.yearlyDiscountType, gym.yearlyDiscountValue)}</div>
            <div>Quarterly discount: up to {formatDiscount(gym.quarterlyDiscountType, gym.quarterlyDiscountValue)}</div>
          </CardContent>
        </Card>

        {(gym.owner?.supportEmail || gym.owner?.supportPhone || gym.owner?.supportWhatsapp || gym.owner?.logoUrl) && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Support & contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              {gym.owner?.logoUrl && (
                <div className="flex items-center gap-3">
                  <img
                    src={gym.owner.logoUrl}
                    alt={gym.owner?.name ?? "Gym"}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  <span className="text-sm">{gym.owner?.name ?? "Gym"}</span>
                </div>
              )}
              {gym.owner?.supportEmail && (
                <p>
                  Email: <a className="text-primary hover:underline" href={`mailto:${gym.owner.supportEmail}`}>{gym.owner.supportEmail}</a>
                </p>
              )}
              {gym.owner?.supportPhone && (
                <p>
                  Phone: <a className="text-primary hover:underline" href={`tel:${gym.owner.supportPhone}`}>{gym.owner.supportPhone}</a>
                </p>
              )}
              {gym.owner?.supportWhatsapp && (
                <p>
                  WhatsApp:{" "}
                  <a
                    className="text-primary hover:underline"
                    href={`https://wa.me/${gym.owner.supportWhatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {gym.owner.supportWhatsapp}
                  </a>
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {(gym.instagramUrl || gym.facebookUrl || gym.youtubeUrl) && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Social profiles</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3 text-sm">
              {gym.instagramUrl && (
                <a
                  href={gym.instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-muted-foreground hover:text-foreground"
                >
                  <Instagram className="h-4 w-4" />
                  Instagram
                </a>
              )}
              {gym.facebookUrl && (
                <a
                  href={gym.facebookUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-muted-foreground hover:text-foreground"
                >
                  <Facebook className="h-4 w-4" />
                  Facebook
                </a>
              )}
              {gym.youtubeUrl && (
                <a
                  href={gym.youtubeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-muted-foreground hover:text-foreground"
                >
                  <Youtube className="h-4 w-4" />
                  YouTube
                </a>
              )}
            </CardContent>
          </Card>
        )}

        <div className="text-center">
          {isVerified ? (
            status === "authenticated" && !emailVerified ? (
              <Button size="lg" className="text-base" disabled>
                Verify email to continue
              </Button>
            ) : (
              <Button asChild size="lg" className="text-base">
                <Link href={`/dashboard/user/join/${gym.id}`}>
                  Continue to join
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )
          ) : (
            <Button size="lg" className="text-base" variant="outline" disabled>
              Verification pending
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
