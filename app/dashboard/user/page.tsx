"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { MapPin, CreditCard, Users, Sparkles, Trophy, Bookmark } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import { buildGymSlug, formatPrice } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJson } from "@/lib/client-fetch";
import { runWhenIdle } from "@/lib/browser-idle";

const MapView = dynamic(() => import("@/components/maps/MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="h-48 rounded-2xl bg-white/5 animate-pulse" />,
});

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
    let cancelIdle: () => void = () => {};
    const joinGymId = searchParams.get("join");
    if (joinGymId) {
      router.replace(`/dashboard/user/join/${joinGymId}`);
      return;
    }

    const load = async () => {
      try {
        const results = await Promise.allSettled([
          fetchJson<{ memberships?: Membership[] }>("/api/memberships", {
            retries: 1,
            useCache: true,
            cacheKey: "user-memberships",
            cacheTtlMs: 15000,
          }),
          fetchJson<{ duos?: Duo[] }>("/api/duos", {
            retries: 1,
            useCache: true,
            cacheKey: "user-duos",
            cacheTtlMs: 15000,
          }),
        ]);

        if (!active) return;

        const mem = results[0].status === "fulfilled" ? results[0].value : null;
        const d = results[1].status === "fulfilled" ? results[1].value : null;
        const loadExtras = async () => {
          const extra = await Promise.allSettled([
            fetchJson<{ location?: { latitude?: number; longitude?: number } }>("/api/location", {
              retries: 1,
              useCache: true,
              cacheKey: "user-location",
              cacheTtlMs: 15000,
            }),
            fetchJson<{ saved?: any[] }>("/api/saved-gyms", {
              retries: 1,
              useCache: true,
              cacheKey: "user-saved-gyms",
              cacheTtlMs: 10000,
            }),
          ]);

          if (!active) return;

          const loc = extra[0].status === "fulfilled" ? extra[0].value : null;
          const saved = extra[1].status === "fulfilled" ? extra[1].value : null;

          if (loc?.ok && loc?.data?.location?.latitude != null && loc.data.location?.longitude != null) {
            setLocation({
              latitude: loc.data.location.latitude,
              longitude: loc.data.location.longitude,
            });
          }
          if (saved?.ok) {
            setSavedGyms(saved?.data?.saved ?? []);
          }
        };

        if (!mem?.ok || !d?.ok) {
          setError("Failed to load your dashboard");
        }

        setMemberships(mem?.data?.memberships ?? []);
        setDuos(d?.data?.duos ?? []);
        cancelIdle = runWhenIdle(loadExtras);
      } catch {
        if (active) setError("Failed to load your dashboard");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
      cancelIdle();
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
  const progressSteps = [
    {
      title: "Explore gyms",
      description: "Find the vibe that fits your goals.",
      href: "/explore",
      complete: Boolean(location || savedGyms.length > 0 || memberships.length > 0),
    },
    {
      title: "Invite a duo partner",
      description: "Unlock partner savings together.",
      href: "/dashboard/user/duo",
      complete: Boolean(activeDuo),
    },
    {
      title: "Join a gym",
      description: "Start your membership momentum.",
      href: "/explore",
      complete: Boolean(activeMembership),
    },
  ];

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

  const displayName = session?.user?.name ?? "there";

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Hi, {displayName}
          </h1>
          <p className="text-muted-foreground text-sm flex items-center gap-1 mt-1">
            {location && <MapPin className="h-4 w-4" />}
            {session?.user?.email}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Let’s keep the streak alive — every small step counts.
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
      </div>

      <Card className="glass-card border border-white/10 p-6 transition-all hover:border-primary/30 hover:shadow-lg">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
              Getting started
            </div>
            <h2 className="text-xl font-semibold">Build your Fitdex momentum</h2>
            <p className="text-sm text-muted-foreground">
              Complete these steps to unlock a confident, consistent routine.
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            {progressSteps.filter((step) => step.complete).length} of {progressSteps.length} completed
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {progressSteps.map((step) => (
            <Link
              key={step.title}
              href={step.href}
              className={`group rounded-xl border border-white/10 p-4 transition-all hover:border-primary/40 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                step.complete ? "bg-emerald-500/10" : "bg-transparent"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="font-medium">
                  {step.title}
                </p>
                <span
                  className={
                    step.complete
                      ? "rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-200"
                      : "rounded-full bg-white/10 px-2 py-0.5 text-xs text-muted-foreground"
                  }
                >
                  {step.complete ? "Done" : "Next"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {step.description}
              </p>
              <span className="mt-3 inline-flex text-xs font-medium text-primary/80 group-hover:text-primary">
                {step.complete ? "Review" : "Start"}
              </span>
            </Link>
          ))}
        </div>
      </Card>

      <div className="h-px bg-white/10" />

      {location && (
        <div className="h-48 rounded-2xl overflow-hidden">
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
        </div>
      )}

      {activeMembership ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="glass-card transition-all hover:border-primary/30 hover:shadow-lg">
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
            <Card className="glass-card transition-all hover:border-primary/30 hover:shadow-lg">
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
            <Card className="glass-card transition-all hover:border-primary/30 hover:shadow-lg">
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

          <Card className="glass-card transition-all hover:border-primary/30 hover:shadow-lg">
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
            <Card className="glass-card transition-all hover:border-primary/30 hover:shadow-lg">
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
                  <span className="text-sm text-muted-foreground">Your first badge is closer than you think.</span>
                )}
              </CardContent>
            </Card>
            <Card className="glass-card transition-all hover:border-primary/30 hover:shadow-lg">
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
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Save a gym to return quickly and compare options.
                    </p>
                    <Button asChild size="sm" variant="outline">
                      <Link href="/explore">Browse gyms</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="glass-card transition-all hover:border-primary/30 hover:shadow-lg">
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
        <Card className="glass-card p-8 md:p-10 text-left transition-all hover:border-primary/30 hover:shadow-lg">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">No membership yet</h2>
              <p className="text-sm text-muted-foreground">
                Start with a gym visit, invite a duo, and build momentum at your pace.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild>
                <Link href="/explore">Explore gyms</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/user/duo">Find a duo</Link>
              </Button>
            </div>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {progressSteps.map((step) => (
              <Link
                key={`${step.title}-empty`}
                href={step.href}
                className="rounded-xl border border-white/10 p-4 text-sm transition-all hover:border-primary/40 hover:bg-white/5"
              >
                <p className="font-medium">{step.title}</p>
                <p className="text-muted-foreground mt-1">{step.description}</p>
              </Link>
            ))}
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
