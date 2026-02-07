"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { MapPin, CreditCard, Users, Loader2, Sparkles, Trophy, Bookmark } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapView } from "@/components/maps/MapView";
import { buildGymSlug, formatPrice } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJson } from "@/lib/client-fetch";

interface Membership {
  id: string;
  active: boolean;
  planType: string;
  basePrice: number;
  finalPrice: number;
  startedAt: string;
  expiresAt: string;
  gym: { id: string; name: string; address: string; latitude: number; longitude: number };
}

interface Duo {
  id: string;
  active: boolean;
  gym: { name: string };
  userOne: { name: string | null };
  userTwo: { name: string | null };
}

function UserDashboardContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [duos, setDuos] = useState<Duo[]>([]);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [savedGyms, setSavedGyms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const joinGymId = searchParams.get("join");
    if (joinGymId) {
      router.replace(`/dashboard/user/join/${joinGymId}`);
      return;
    }

    const load = async () => {
      try {
        const results = await Promise.allSettled([
          fetchJson<{ memberships?: Membership[] }>("/api/memberships", { retries: 1 }),
          fetchJson<{ duos?: Duo[] }>("/api/duos", { retries: 1 }),
          fetchJson<{ location?: { latitude?: number; longitude?: number } }>("/api/location", { retries: 1 }),
          fetchJson<{ saved?: any[] }>("/api/saved-gyms", { retries: 1 }),
        ]);

        if (!active) return;

        const mem = results[0].status === "fulfilled" ? results[0].value : null;
        const d = results[1].status === "fulfilled" ? results[1].value : null;
        const loc = results[2].status === "fulfilled" ? results[2].value : null;
        const saved = results[3].status === "fulfilled" ? results[3].value : null;

        if (!mem?.ok || !d?.ok) {
          setError("Failed to load your dashboard");
        }

        setMemberships(mem?.data?.memberships ?? []);
        setDuos(d?.data?.duos ?? []);
        if (loc?.ok && loc?.data?.location?.latitude != null && loc.data.location?.longitude != null) {
          setLocation({
            latitude: loc.data.location.latitude,
            longitude: loc.data.location.longitude,
          });
        }
        if (saved?.ok) {
          setSavedGyms(saved?.data?.saved ?? []);
        }
      } catch {
        if (active) setError("Failed to load your dashboard");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [searchParams, router]);

  const activeMembership = memberships.find((m) => m.active);
  const activeDuo = duos.find((d) => d.active);
  const streakDays = activeMembership
    ? Math.max(
        1,
        Math.floor(
          (Date.now() - new Date(activeMembership.startedAt).getTime()) /
            (1000 * 60 * 60 * 24)
        ) + 1
      )
    : 0;
  const badges = [
    activeMembership ? "Active member" : null,
    activeMembership?.planType === "YEARLY" ? "Yearly commitment" : null,
    activeDuo ? "Duo partner" : null,
  ].filter(Boolean) as string[];

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
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

  return (
    <div className="p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold">
            Hi, {session?.user?.name ?? "Member"}
          </h1>
          <p className="text-muted-foreground text-sm flex items-center gap-1 mt-1">
            {location && <MapPin className="h-4 w-4" />}
            {session?.user?.email}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant={activeMembership ? "outline" : "default"}>
            <Link href="/explore">Find a gym</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/dashboard/user/duo">Invite partner</Link>
          </Button>
        </div>
      </motion.div>

      {location && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="h-48 rounded-2xl overflow-hidden"
        >
          <MapView
            latitude={location.latitude}
            longitude={location.longitude}
            gyms={
              activeMembership
                ? [
                    {
                      id: activeMembership.gym.id,
                      name: activeMembership.gym.name,
                      latitude: activeMembership.gym.latitude,
                      longitude: activeMembership.gym.longitude,
                      url: `/explore/${buildGymSlug(activeMembership.gym.name, activeMembership.gym.id)}`,
                    },
                  ]
                : []
            }
            className="w-full h-full"
          />
        </motion.div>
      )}

      {activeMembership ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Current plan
                </CardTitle>
                <CardDescription>{activeMembership.planType}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {formatPrice(activeMembership.finalPrice)} per {activeMembership.planType === "YEARLY" ? "year" : "month"}
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Streak
                </CardTitle>
                <CardDescription>Keep your momentum</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">{streakDays} days</p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Duo status
                </CardTitle>
                <CardDescription>{activeDuo ? "Active" : "No partner"}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {activeDuo
                  ? "You’re paired up for extra discount."
                  : "Invite a partner to unlock duo savings."}
              </CardContent>
            </Card>
          </div>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Membership
              </CardTitle>
              <CardDescription>{activeMembership.gym.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">
                Plan: <span className="font-medium">{activeMembership.planType}</span>
              </p>
              <p className="text-sm">
                Base: {formatPrice(activeMembership.basePrice)} → Final:{" "}
                <span className="text-primary font-semibold">
                  {formatPrice(activeMembership.finalPrice)}
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                Expires: {new Date(activeMembership.expiresAt).toLocaleDateString()}
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/user/membership">View details</Link>
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Badges
                </CardTitle>
                <CardDescription>Achievements you’ve unlocked.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {badges.length > 0 ? (
                  badges.map((b) => (
                    <span key={b} className="text-xs bg-white/10 px-2 py-1 rounded-full">
                      {b}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No badges yet</span>
                )}
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bookmark className="h-5 w-5" />
                  Saved gyms
                </CardTitle>
                <CardDescription>Jump back into gyms you liked.</CardDescription>
              </CardHeader>
              <CardContent>
                {savedGyms.length > 0 ? (
                  <div className="space-y-2">
                    {savedGyms.slice(0, 3).map((s) => (
                      <div key={s.id} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{s.gym?.name}</p>
                          <p className="text-sm text-muted-foreground">{s.gym?.address}</p>
                        </div>
                        <Button size="sm" variant="outline" asChild>
                          <Link href={s.gym?.id ? `/explore/${buildGymSlug(s.gym?.name ?? "gym", s.gym.id)}` : "/explore"}>
                            View
                          </Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Button asChild size="sm" variant="outline">
                    <Link href="/explore">Browse gyms</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Duo
              </CardTitle>
              <CardDescription>
                {activeDuo
                  ? "You have an active duo partner."
                  : "Invite a partner for extra discount."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeDuo ? (
                <p className="text-sm">
                  Partner:{" "}
                  {activeDuo.userOne?.name || activeDuo.userTwo?.name || "Partner"}
                </p>
              ) : (
                <Button size="sm" asChild>
                  <Link href="/dashboard/user/duo">Invite partner</Link>
                </Button>
              )}
            </CardContent>
          </Card>

        </>
      ) : (
        <Card className="glass-card p-12 text-center">
          <p className="text-muted-foreground mb-4">No active membership</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild>
              <Link href="/explore">Explore gyms</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/user/duo">Find a duo</Link>
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function UserDashboardPage() {
  return (
    <Suspense fallback={
      <div className="p-6 space-y-6">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    }>
      <UserDashboardContent />
    </Suspense>
  );
}
