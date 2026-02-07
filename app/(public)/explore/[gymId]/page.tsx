"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  MapPin,
  Sparkles,
  ShieldCheck,
  Users,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/utils";
import { getGymOpenStatus } from "@/lib/gym-hours";
import { fetchJson } from "@/lib/client-fetch";

interface GymData {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  coverImageUrl: string | null;
  openTime?: string | null;
  closeTime?: string | null;
  openDays?: string | null;
  owner: { id: string; name: string | null };
  dayPassPrice?: number | null;
  monthlyPrice: number;
  quarterlyPrice: number;
  yearlyPrice: number;
  partnerDiscountPercent: number;
  quarterlyDiscountPercent: number;
  yearlyDiscountPercent: number;
  welcomeDiscountPercent: number;
  maxDiscountCapPercent: number;
  yearlySavePercent: number;
  quarterlySavePercent: number;
  featuredUntil?: string | Date | null;
  verifiedUntil?: string | Date | null;
}

export default function GymProfilePage() {
  const params = useParams();
  const gymId = params.gymId as string;
  const { status } = useSession();
  const [gym, setGym] = useState<GymData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gymId) return;
    fetchJson<{ gym?: GymData; error?: string }>(`/api/gyms/${gymId}`, { retries: 1 })
      .then((result) => {
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
        setError("Failed to load gym details");
        setLoading(false);
      });
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
                <p className="text-sm">Premium verified gym</p>
              </div>
            )}
            <div className="absolute top-4 right-4 flex items-center gap-2">
              {gym.featuredUntil && new Date(gym.featuredUntil).getTime() > Date.now() && (
                <span className="rounded-full bg-primary/20 text-primary px-3 py-1 text-xs">Featured</span>
              )}
              {gym.verifiedUntil && new Date(gym.verifiedUntil).getTime() > Date.now() && (
                <span className="rounded-full bg-emerald-500/20 text-emerald-400 px-3 py-1 text-xs">Verified</span>
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
                <p className={`text-xs mt-2 ${getGymOpenStatus(gym).isOpen ? "text-emerald-400" : "text-muted-foreground"}`}>
                  {getGymOpenStatus(gym).label}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                {status === "authenticated" && (
                  <Button variant="outline" size="lg" onClick={toggleSave}>
                    {saved ? "Saved" : "Save"}
                  </Button>
                )}
                <Button asChild size="lg">
                  <Link href={`/dashboard/user/join/${gym.id}`}>
                    Join this gym
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-primary" />
              <div>
                <div className="text-sm font-medium">Verified partner</div>
                <div className="text-xs text-muted-foreground">Secure payments & support</div>
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
            <div>Welcome discount: up to {gym.welcomeDiscountPercent}%</div>
            <div>Yearly discount: up to {gym.yearlyDiscountPercent}%</div>
            <div>Quarterly discount: up to {gym.quarterlyDiscountPercent}%</div>
            <div>Max stack cap: {gym.maxDiscountCapPercent}%</div>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button asChild size="lg" className="text-base">
            <Link href={`/dashboard/user/join/${gym.id}`}>
              Continue to join
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
