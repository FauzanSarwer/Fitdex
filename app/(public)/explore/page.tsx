"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { MapPin, List, LayoutGrid, Search, ArrowRight, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  createdAt?: string | Date;
  featuredUntil?: string | Date | null;
  verifiedUntil?: string | Date | null;
}

type SortOption = "price_asc" | "price_desc" | "distance" | "newest";

export default function ExplorePage() {
  const [view, setView] = useState<ViewMode>("list");
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [maxDistance, setMaxDistance] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortOption>("distance");
  const { status } = useSession();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

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

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/saved-gyms")
      .then((r) => r.json())
      .then((d) => {
        const ids = new Set<string>(
          (d.saved ?? []).map((s: { gymId: string }) => s.gymId)
        );
        setSavedIds(ids);
      })
      .catch(() => {});
  }, [status]);

  async function toggleSave(gymId: string) {
    if (status !== "authenticated") return;
    const isSaved = savedIds.has(gymId);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (isSaved) next.delete(gymId);
      else next.add(gymId);
      return next;
    });
    if (isSaved) {
      await fetch(`/api/saved-gyms?gymId=${gymId}`, { method: "DELETE" });
    } else {
      await fetch("/api/saved-gyms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gymId }),
      });
    }
  }

  const filteredGyms = useMemo(() => {
    let list = [...gyms];
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.address.toLowerCase().includes(q)
      );
    }
    const priceCap = Number(maxPrice);
    if (Number.isFinite(priceCap) && priceCap > 0) {
      list = list.filter((g) => g.monthlyPrice <= priceCap);
    }
    const distCap = Number(maxDistance);
    if (Number.isFinite(distCap) && distCap > 0) {
      list = list.filter((g) => (g.distance ?? Infinity) <= distCap * 1000);
    }

    switch (sortBy) {
      case "price_asc":
        list.sort((a, b) => a.monthlyPrice - b.monthlyPrice);
        break;
      case "price_desc":
        list.sort((a, b) => b.monthlyPrice - a.monthlyPrice);
        break;
      case "newest":
        list.sort((a, b) =>
          new Date(b.createdAt ?? 0).getTime() -
          new Date(a.createdAt ?? 0).getTime()
        );
        break;
      case "distance":
      default:
        list.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    }
    return list;
  }, [gyms, maxDistance, maxPrice, query, sortBy]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search gyms or locations"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Input
            type="number"
            placeholder="Max price / month"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />
          <Input
            type="number"
            placeholder="Max distance (km)"
            value={maxDistance}
            onChange={(e) => setMaxDistance(e.target.value)}
          />
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger>
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="price_asc">Price: low to high</SelectItem>
              <SelectItem value="price_desc">Price: high to low</SelectItem>
              <SelectItem value="distance">Nearby to farthest</SelectItem>
              <SelectItem value="newest">Newly added</SelectItem>
            </SelectContent>
          </Select>
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
      ) : filteredGyms.length === 0 ? (
        <Card className="glass-card p-12 text-center">
          <p className="text-muted-foreground">No gyms found. Try adjusting filters.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredGyms.map((gym, i) => (
            <motion.div
              key={gym.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="glass-card overflow-hidden hover:border-primary/30 transition-all duration-300 hover:-translate-y-1">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">{gym.name}</h3>
                    <div className="flex items-center gap-2">
                      {gym.featuredUntil && new Date(gym.featuredUntil).getTime() > Date.now() && (
                        <span className="text-[10px] uppercase tracking-wide bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                          Featured
                        </span>
                      )}
                      {gym.verifiedUntil && new Date(gym.verifiedUntil).getTime() > Date.now() && (
                        <span className="text-[10px] uppercase tracking-wide bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                          Verified
                        </span>
                      )}
                      {status === "authenticated" && (
                        <button
                          type="button"
                          onClick={() => toggleSave(gym.id)}
                          className="text-primary/80 hover:text-primary"
                          aria-label="Save gym"
                        >
                          <Heart className={`h-4 w-4 ${savedIds.has(gym.id) ? "fill-primary" : ""}`} />
                        </button>
                      )}
                      <Link href={`/explore/${gym.id}`} className="text-xs text-primary hover:underline">
                        View
                      </Link>
                    </div>
                  </div>
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
                    <Link href={`/explore/${gym.id}`}>
                      Explore
                      <ArrowRight className="ml-2 h-3 w-3" />
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
