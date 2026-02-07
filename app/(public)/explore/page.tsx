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
import { buildGymSlug, cn, formatPrice } from "@/lib/utils";
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
  verificationStatus: string;
  openTime?: string | null;
  closeTime?: string | null;
  openDays?: string | null;
  monthlyPrice: number;
  yearlyPrice: number;
  partnerDiscountPercent: number;
  distance?: number;
  createdAt?: string | Date;
  coverImageUrl?: string | null;
  featuredUntil?: string | Date | null;
  verifiedUntil?: string | Date | null;
}

type SortOption = "price_asc" | "price_desc" | "distance" | "newest";

const SERVICEABLE_CITIES = [
  "Delhi",
  "New Delhi",
  "Gurugram",
  "Noida",
  "Ghaziabad",
  "Faridabad",
];

function GymImageCarousel({ images, name }: { images: string[]; name: string }) {
  const [index, setIndex] = useState(0);
  if (images.length === 0) return null;
  const active = images[index] ?? images[0];
  return (
    <div className="relative h-full w-full">
      <img src={active} alt={name} className="h-full w-full object-cover" />
      {images.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-white" : "bg-white/50"}`}
              aria-label={`Show image ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ExplorePage() {
  const [view, setView] = useState<ViewMode>("list");
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [locationGate, setLocationGate] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [maxDistance, setMaxDistance] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortOption>("distance");
  const [onlyFeatured, setOnlyFeatured] = useState(false);
  const [onlyVerified, setOnlyVerified] = useState(false);
  const { status } = useSession();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const loadGyms = async (url: string) => {
    setError(null);
    setLoading(true);
    try {
      const result = await fetchJson<{ gyms?: Gym[]; error?: string }>(url, { retries: 2 });
      if (!result.ok) {
        setError(result.error ?? "Could not load gyms. Please try again.");
        return;
      }
      setGyms(result.data?.gyms ?? []);
    } catch {
      setError("Could not load gyms. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Location is not supported on this device.");
      setLocationGate(false);
      try {
        localStorage.setItem("fitdex_explore_skip", "true");
      } catch {}
      loadGyms("/api/gyms");
      return;
    }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserLat(lat);
        setUserLng(lng);
        setLocationGate(false);
        setLocationLoading(false);
        loadGyms(`/api/gyms?lat=${lat}&lng=${lng}`);
        try {
          localStorage.setItem(
            "fitdex_location",
            JSON.stringify({ latitude: lat, longitude: lng, serviceable: true })
          );
          localStorage.removeItem("fitdex_explore_skip");
        } catch {}
      },
      () => {
        setLocationError("Location access denied. Showing gyms without distance sorting.");
        setLocationGate(false);
        setLocationLoading(false);
        try {
          localStorage.setItem("fitdex_explore_skip", "true");
        } catch {}
        loadGyms("/api/gyms");
      }
    );
  };

  useEffect(() => {
    try {
      const skip = localStorage.getItem("fitdex_explore_skip");
      if (skip === "true") {
        setLocationGate(false);
        loadGyms("/api/gyms");
        return;
      }
      const cached = localStorage.getItem("fitdex_location");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.latitude && parsed?.longitude) {
          setUserLat(parsed.latitude);
          setUserLng(parsed.longitude);
          setLocationGate(false);
          loadGyms(`/api/gyms?lat=${parsed.latitude}&lng=${parsed.longitude}`);
          return;
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!locationGate && gyms.length === 0 && !loading) {
      loadGyms("/api/gyms");
    }
  }, [locationGate]);

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

  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const levenshtein = (a: string, b: string) => {
    const m = a.length;
    const n = b.length;
    if (!m) return n;
    if (!n) return m;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i += 1) dp[i][0] = i;
    for (let j = 0; j <= n; j += 1) dp[0][j] = j;
    for (let i = 1; i <= m; i += 1) {
      for (let j = 1; j <= n; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    return dp[m][n];
  };
  const fuzzyMatch = (name: string, q: string) => {
    const n = normalize(name);
    const query = normalize(q);
    if (!query) return true;
    if (n.includes(query)) return true;
    if (query.length < 3) return false;
    const distance = levenshtein(n, query);
    const threshold = Math.max(2, Math.floor(query.length * 0.3));
    return distance <= threshold;
  };

  const filteredGyms = useMemo(() => {
    let list = [...gyms];
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((g) => fuzzyMatch(g.name, q));
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
        (g) => g.verificationStatus === "VERIFIED"
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
  }, [gyms, maxDistance, maxPrice, query, sortBy, onlyFeatured, onlyVerified]);

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
    if (onlyFeatured) {
      filters.push({ label: "Featured only", onClear: () => setOnlyFeatured(false) });
    }
    if (onlyVerified) {
      filters.push({ label: "Verified only", onClear: () => setOnlyVerified(false) });
    }
    return filters;
  }, [maxDistance, maxPrice, query, sortBy, onlyFeatured, onlyVerified]);

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
      {locationGate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-card border border-white/10 p-6 rounded-2xl max-w-md w-full text-center space-y-4">
            <h2 className="text-xl font-semibold">Allow location access?</h2>
            <p className="text-sm text-muted-foreground">
              We use your location to sort gyms by distance. You can continue without it.
            </p>
            {locationError && <p className="text-xs text-amber-400">{locationError}</p>}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={requestLocation} disabled={locationLoading}>
                {locationLoading ? "Requesting…" : "Use my location"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setLocationGate(false);
                  try {
                    localStorage.setItem("fitdex_explore_skip", "true");
                  } catch {}
                  loadGyms("/api/gyms");
                }}
              >
                Continue without location
              </Button>
            </div>
          </div>
        </div>
      )}
      <div className={locationGate ? "pointer-events-none blur-sm" : ""}>
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8 shadow-glow-sm"
        >
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl space-y-3">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Fitdex Explore</p>
              <h1 className="text-2xl md:text-4xl font-semibold text-foreground">
                Discover premium gyms near you, with transparent pricing and verified listings.
              </h1>
              <p className="text-sm text-muted-foreground">
                Compare facilities, check timings, and reach out instantly. Sorted by distance when location is available.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {SERVICEABLE_CITIES.map((city) => (
                <span
                  key={city}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground"
                >
                  {city}
                </span>
              ))}
            </div>
          </div>
        </motion.section>
        <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-foreground">
            <MapPin className="h-6 w-6 text-primary" />
            Browse gyms
          </h2>
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
              placeholder="Search gyms by name"
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
                        // name-only search
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
              url: `/explore/${buildGymSlug(g.name, g.id)}`,
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
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredGyms.map((gym, i) => {
            const isFeatured = gym.featuredUntil && new Date(gym.featuredUntil).getTime() > Date.now();
            const images = gym.coverImageUrl ? [gym.coverImageUrl] : [];
            return (
            <motion.div
              key={gym.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card
                className={cn(
                    "glass-card overflow-hidden hover:border-primary/30 transition-all duration-300 hover:-translate-y-1 min-h-[320px]",
                  isFeatured && "border-primary/40 shadow-[0_0_24px_rgba(99,102,241,0.25)]"
                )}
              >
                  <div className="relative h-44 w-full">
                    {images.length > 0 ? (
                      <GymImageCarousel images={images} name={gym.name} />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-primary/20 via-primary/5 to-accent/20" />
                    )}
                  </div>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">{gym.name}</h3>
                    <div className="flex items-center gap-2">
                      {isFeatured && (
                        <span className="text-[10px] uppercase tracking-wide bg-primary/20 text-primary px-2 py-0.5 rounded-full animate-pulse">
                          Featured
                        </span>
                      )}
                      {gym.verificationStatus === "VERIFIED" ? (
                        <span className="text-[10px] uppercase tracking-wide bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                          Verified
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase tracking-wide bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                          Unverified
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
                      <Link href={`/explore/${buildGymSlug(gym.name, gym.id)}`} className="text-xs text-primary hover:underline">
                        View
                      </Link>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {gym.address}
                  </p>
                  <p className={`text-xs mt-1 ${getGymOpenStatus({ ...gym, useIst: true }).isOpen ? "text-emerald-400" : "text-muted-foreground"}`}>
                    {getGymOpenStatus({ ...gym, useIst: true }).label}
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
                    <Link href={`/explore/${buildGymSlug(gym.name, gym.id)}`}>
                      Explore
                      <ArrowRight className="ml-2 h-3 w-3" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
