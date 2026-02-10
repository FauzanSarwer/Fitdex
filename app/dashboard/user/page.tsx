"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { MapPin, CreditCard, Users, Loader2, Sparkles, Trophy, Bookmark } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function UserDashboardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [memberships, setMemberships] = useState<any[]>([]);
  const [duos, setDuos] = useState<any[]>([]);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [savedGyms, setSavedGyms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Add other state and logic as needed

  useEffect(() => {
    let active = true;
    const joinGymId = searchParams.get("join");
    if (joinGymId) {
      router.replace(`/dashboard/user/join/${joinGymId}`);
      return;
    }
    // Fetch memberships, duos, location, savedGyms, etc. here
    // setLoading(false) when done
  }, [searchParams, router]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  // TODO: Insert the full dashboard JSX here, using the state above
  return (
    <div className="p-6 space-y-6">
      {/* ...existing dashboard JSX, ensure all elements are properly closed and wrapped... */}
    </div>
  );
}
export default function UserDashboardPage() {
  // All hooks, state, and handlers at the top
  // ...existing logic, handlers, and effects...
  // Only one function body, only one return
  return (
    <div className="p-6 space-y-6">
      {/* ...dashboard JSX, properly closed... */}
    </div>
  );
}
      </Card>

      <div className="h-px bg-white/10" />

      {location && activeMembership?.gym && (
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
