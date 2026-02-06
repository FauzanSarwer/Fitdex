"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { MapPin, CreditCard, Users, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapView } from "@/components/maps/MapView";
import { formatPrice } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface Membership {
  id: string;
  active: boolean;
  planType: string;
  basePrice: number;
  finalPrice: number;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const joinGymId = searchParams.get("join");
    if (joinGymId) {
      router.replace(`/dashboard/user/join/${joinGymId}`);
      return;
    }

    Promise.all([
      fetch("/api/memberships").then((r) => r.json()),
      fetch("/api/duos").then((r) => r.json()),
      fetch("/api/location").then((r) => r.json()),
    ]).then(([mem, d, loc]) => {
      setMemberships(mem.memberships ?? []);
      setDuos(d.duos ?? []);
      if (loc.location?.latitude != null && loc.location?.longitude != null) {
        setLocation({
          latitude: loc.location.latitude,
          longitude: loc.location.longitude,
        });
      }
      setLoading(false);
    });
  }, [searchParams, router]);

  const activeMembership = memberships.find((m) => m.active);
  const activeDuo = duos.find((d) => d.active);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
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
        {!activeMembership && (
          <Button asChild>
            <Link href="/explore">Find a gym</Link>
          </Button>
        )}
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
            gyms={activeMembership ? [{ id: activeMembership.gym.id, name: activeMembership.gym.name, latitude: activeMembership.gym.latitude, longitude: activeMembership.gym.longitude }] : []}
            className="w-full h-full"
          />
        </motion.div>
      )}

      {activeMembership ? (
        <>
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
          <Button asChild>
            <Link href="/explore">Explore gyms</Link>
          </Button>
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
