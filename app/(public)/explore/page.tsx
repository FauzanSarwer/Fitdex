"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { MapPin, List, LayoutGrid, Search, ArrowRight, Heart, SlidersHorizontal, ArrowDownUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MapView } from "@/components/maps/MapView";
import { formatPrice } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { getGymOpenStatus } from "@/lib/gym-hours";
import { fetchJson } from "@/lib/client-fetch";

type ViewMode = "map" | "list";

interface Gym {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  openTime?: string | null;
  closeTime?: string | null;
  openDays?: string | null;
  monthlyPrice: number;
  yearlyPrice: number;
  partnerDiscountPercent: number;
  distance?: number;
  createdAt?: string | Date;
  featuredUntil?: string | Date | null;
  verifiedUntil?: string | Date | null;
}

type SortOption = "price_asc" | "price_desc" | "distance" | "newest";
type SearchScope = "all" | "name" | "address";

export default function ExplorePage() {
  const [view, setView] = useState<ViewMode>("list");
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [maxDistance, setMaxDistance] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortOption>("distance");
  const [searchScope, setSearchScope] = useState<SearchScope>("all");
  const [onlyFeatured, setOnlyFeatured] = useState(false);
  const [onlyVerified, setOnlyVerified] = useState(false);
  const { status } = useSession();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setLoading(true);
    const loadGyms = async (url: string) => {
      try {
        const result = await fetchJson<{ gyms?: Gym[]; error?: string }>(url, { retries: 2 });
        if (!result.ok) {
          if (!cancelled) setError(result.error ?? "Could not load gyms. Please try again.");
          return;
        }
        if (!cancelled) setGyms(result.data?.gyms ?? []);
      } catch {
        if (!cancelled) setError("Could not load gyms. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (!navigator.geolocation) {
      loadGyms("/api/gyms");
      return () => {
        cancelled = true;
      };
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserLat(lat);
        setUserLng(lng);
        loadGyms(`/api/gyms?lat=${lat}&lng=${lng}`);
      },
      () => {
        if (cancelled) return;
        loadGyms("/api/gyms");
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetchJson<{ saved?: Array<{ gymId: string }> }>("/api/saved-gyms", { retries: 1 })
      .then((result) => {
        if (!result.ok) return;
        const ids = new Set<string>((result.data?.saved ?? []).map((s) => s.gymId));
        setSavedIds(ids);
      })
      .catch(() => {});
  }, [status]);

  useEffect(() => {
    if (status === "unauthenticated") {
      setSavedIds(new Set());
    }
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
    const result = isSaved
      ? await fetchJson(`/api/saved-gyms?gymId=${gymId}`, { method: "DELETE", retries: 1 })
      : await fetchJson("/api/saved-gyms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gymId }),
          retries: 1,
        });
    if (!result.ok) {
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (isSaved) next.add(gymId);
        else next.delete(gymId);
        return next;
      });
    }
  }

  const filteredGyms = useMemo(() => {
    let list = [...gyms];
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (g) => {
          const inName = g.name.toLowerCase().includes(q);
          const inAddress = g.address.toLowerCase().includes(q);
          if (searchScope === "name") return inName;
          if (searchScope === "address") return inAddress;
          return inName || inAddress;
        }
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
    if (onlyFeatured) {
      list = list.filter(
        (g) => g.featuredUntil && new Date(g.featuredUntil).getTime() > Date.now()
      );
    }
    if (onlyVerified) {
      list = list.filter(
        (g) => g.verifiedUntil && new Date(g.verifiedUntil).getTime() > Date.now()
      );
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
  }, [gyms, maxDistance, maxPrice, query, sortBy, searchScope, onlyFeatured, onlyVerified]);

  const activeFilters = useMemo(() => {
    const filters: { label: string; onClear: () => void }[] = [];
    if (query.trim()) {
      filters.push({ label: `Search: ${query.trim()}`, onClear: () => setQuery("") });
    }
    if (Number(maxPrice) > 0) {
      filters.push({ label: `Max ₹${maxPrice}/mo`, onClear: () => setMaxPrice("") });
    }
    if (Number(maxDistance) > 0) {
      filters.push({ label: `Within ${maxDistance} km`, onClear: () => setMaxDistance("") });
    }
    if (sortBy !== "distance") {
      const labels: Record<SortOption, string> = {
        price_asc: "Price: low → high",
        price_desc: "Price: high → low",
        distance: "Nearby first",
        newest: "Newest",
      };
      filters.push({ label: labels[sortBy], onClear: () => setSortBy("distance") });
    }
    if (searchScope !== "all") {
      filters.push({
        label: `Search: ${searchScope === "name" ? "Name" : "Address"}`,
        onClear: () => setSearchScope("all"),
      });
    }
    if (onlyFeatured) {
      filters.push({ label: "Featured only", onClear: () => setOnlyFeatured(false) });
    }
    if (onlyVerified) {
      filters.push({ label: "Verified only", onClear: () => setOnlyVerified(false) });
    }
    return filters;
  }, [maxDistance, maxPrice, query, sortBy, searchScope, onlyFeatured, onlyVerified]);

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="glass-card p-10 text-center">
          <CardHeader>
            <CardTitle>Could not load gyms</CardTitle>
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading gyms..." : `${filteredGyms.length} gyms available`}
          </p>
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {activeFilters.map((filter) => (
                <button
                  key={filter.label}
                  type="button"
                  onClick={filter.onClear}
                  className="text-xs rounded-full border border-white/10 bg-white/5 px-3 py-1 text-muted-foreground hover:text-foreground"
                >
                  {filter.label} ×
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setMaxPrice("");
                  setMaxDistance("");
                  setSortBy("distance");
                  setSearchScope("all");
                  setOnlyFeatured(false);
                  setOnlyVerified(false);
                }}
                className="text-xs rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-primary hover:bg-primary/20"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search gyms, neighborhoods, or landmarks"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <ArrowDownUp className="h-4 w-4" />
                  Sort by
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Sort results</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                  <DropdownMenuRadioItem value="distance">Nearby to farthest</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="price_asc">Price: low to high</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="price_desc">Price: high to low</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="newest">Newly added</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 p-3">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Price & distance</p>
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
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Search options</p>
                    <DropdownMenuRadioGroup
                      value={searchScope}
                      onValueChange={(v) => setSearchScope(v as SearchScope)}
                      className="space-y-1"
                    >
                      <DropdownMenuRadioItem value="all">Search name + address</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="name">Search by name only</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="address">Search by address only</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Badges</p>
                    <button
                      type="button"
                      onClick={() => setOnlyFeatured((prev) => !prev)}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                        onlyFeatured ? "border-primary/50 bg-primary/10 text-primary" : "border-white/10"
                      }`}
                    >
                      Featured gyms
                    </button>
                    <button
                      type="button"
                      onClick={() => setOnlyVerified((prev) => !prev)}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                        onlyVerified ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300" : "border-white/10"
                      }`}
                    >
                      Verified gyms
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setMaxPrice("");
                        setMaxDistance("");
                        setSearchScope("all");
                        setOnlyFeatured(false);
                        setOnlyVerified(false);
                      }}
                    >
                      Clear filters
                    </Button>
                    <span className="text-xs text-muted-foreground">Updates instantly</span>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
      ) : error ? (
        <Card className="glass-card p-12 text-center">
          <p className="text-muted-foreground">{error}</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </Card>
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
                  <p className={`text-xs mt-1 ${getGymOpenStatus(gym).isOpen ? "text-emerald-400" : "text-muted-foreground"}`}>
                    {getGymOpenStatus(gym).label}
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
