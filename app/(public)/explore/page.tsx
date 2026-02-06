"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { MapPin, List, LayoutGrid, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MapView } from "@/components/maps/MapView";
import { formatPrice } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type ViewMode = "map" | "list";

interface Gym {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  monthlyPrice: number;
  yearlyPrice: number;
  partnerDiscountPercent: number;
  distance?: number;
}

export default function ExplorePage() {
  const { status } = useSession();
  const [view, setView] = useState<ViewMode>("list");
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!navigator.geolocation) {
      fetch("/api/gyms")
        .then((r) => r.json())
        .then((d) => !cancelled && setGyms(d.gyms ?? []))
        .finally(() => !cancelled && setLoading(false));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserLat(lat);
        setUserLng(lng);
        fetch(`/api/gyms?lat=${lat}&lng=${lng}`)
          .then((r) => r.json())
          .then((d) => !cancelled && setGyms(d.gyms ?? []))
          .finally(() => !cancelled && setLoading(false));
      },
      () => {
        fetch("/api/gyms")
          .then((r) => r.json())
          .then((d) => !cancelled && setGyms(d.gyms ?? []))
          .finally(() => !cancelled && setLoading(false));
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MapPin className="h-6 w-6 text-primary" />
          Explore gyms
        </h1>
        <div className="flex rounded-xl border border-white/10 overflow-hidden">
          <Button
            variant={view === "list" ? "secondary" : "ghost"}
            size="sm"
            className="rounded-none"
            onClick={() => setView("list")}
          >
            <List className="h-4 w-4 mr-1" />
            List
          </Button>
          <Button
            variant={view === "map" ? "secondary" : "ghost"}
            size="sm"
            className="rounded-none"
            onClick={() => setView("map")}
          >
            <LayoutGrid className="h-4 w-4 mr-1" />
            Map
          </Button>
        </div>
      </div>

      {view === "map" && userLat != null && userLng != null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-6 h-[360px]"
        >
          <MapView
            latitude={userLat}
            longitude={userLng}
            gyms={gyms.map((g) => ({
              id: g.id,
              name: g.name,
              latitude: g.latitude,
              longitude: g.longitude,
            }))}
            className="w-full h-full"
          />
        </motion.div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : gyms.length === 0 ? (
        <Card className="glass-card p-12 text-center">
          <p className="text-muted-foreground">No gyms found. Check back later.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {gyms.map((gym, i) => (
            <motion.div
              key={gym.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="glass-card overflow-hidden hover:border-primary/30 transition-colors">
                <CardHeader className="pb-2">
                  <h3 className="font-semibold text-lg">{gym.name}</h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {gym.address}
                  </p>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      From {formatPrice(gym.monthlyPrice)}/mo
                    </p>
                    {gym.distance != null && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {(gym.distance / 1000).toFixed(1)} km away
                      </p>
                    )}
                  </div>
                  <Button asChild size="sm">
                    <Link href={status === "authenticated" ? `/dashboard/user/join/${gym.id}` : `/auth/register?redirect=/explore`}>
                      Join
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
