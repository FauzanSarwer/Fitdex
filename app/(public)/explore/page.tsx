"use client";

import { useMemo, useState, useEffect, useDeferredValue, useRef, type CSSProperties } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
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
import Image from "next/image";
import { buildGymSlug, cn, formatPrice } from "@/lib/utils";
import { getGymTierRank, isGymFeatured } from "@/lib/gym-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { getGymOpenStatus } from "@/lib/gym-hours";
import { fetchJson } from "@/lib/client-fetch";
import { getAmenityEmoji } from "@/lib/amenities";
import { accentByIndex, accentRgb, accents } from "@/lib/theme/accents";

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
  imageUrls?: string[] | null;
  featuredUntil?: string | Date | null;
  verifiedUntil?: string | Date | null;
  isFeatured?: boolean | null;
  featuredStartAt?: string | Date | null;
  featuredEndAt?: string | Date | null;
  gymTier?: string | null;
  hasAC?: boolean;
  amenities?: string[];
}

type SortOption = "price_asc" | "price_desc" | "distance" | "newest";

const SORT_LABELS: Record<SortOption, string> = {
  price_asc: "Price: low → high",
  price_desc: "Price: high → low",
  distance: "Nearby first",
  newest: "Newest",
};

const SERVICEABLE_CITIES = [
  "Delhi",
  "New Delhi",
  "Gurugram",
  "Noida",
  "Ghaziabad",
  "Faridabad",
];

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

function GymImageCarousel({ images, name }: { images: string[]; name: string }) {
  const [index, setIndex] = useState(0);
  if (images.length === 0) return null;
  const active = images[index] ?? images[0];
  return (
    <div className="relative h-full w-full overflow-hidden">
      <Image
        src={active}
        alt={name}
        fill
        sizes="(max-width: 768px) 100vw, 50vw"
        className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.12]"
      />
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
  const [loadFailed, setLoadFailed] = useState(false);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [locationGate, setLocationGate] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [maxDistance, setMaxDistance] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortOption>("distance");
  const [onlyFeatured, setOnlyFeatured] = useState(false);
  const [onlyVerified, setOnlyVerified] = useState(false);
  const { status } = useSession();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const deferredQuery = useDeferredValue(query);
  const deferredMaxPrice = useDeferredValue(maxPrice);
  const deferredMaxDistance = useDeferredValue(maxDistance);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);

  const mapCenter = useMemo(() => {
    if (userLat != null && userLng != null) {
      return { latitude: userLat, longitude: userLng, showUserMarker: true };
    }
    const fallback = gyms.find((g) => Number.isFinite(g.latitude) && Number.isFinite(g.longitude));
    if (fallback) {
      return { latitude: fallback.latitude, longitude: fallback.longitude, showUserMarker: false };
    }
    return { latitude: 28.6139, longitude: 77.209, showUserMarker: false };
  }, [userLat, userLng, gyms]);

  const loadGyms = async (url: string) => {
    setError(null);
    setLoadFailed(false);
    setLoading(true);
    try {
      const result = await fetchJson<{ gyms?: Gym[]; error?: string }>(url, { retries: 2 });
      if (!result.ok) {
        setGyms([]);
        setLoadFailed(true);
        return;
      }
      setGyms(result.data?.gyms ?? []);
    } catch {
      setGyms([]);
      setLoadFailed(true);
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
    if (typeof window !== "undefined" && window.innerWidth > 768 && inputRef.current) {
      inputRef.current.focus();
    }
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const heading = headingRef.current;
    if (!heading) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      heading.style.transform = "translate3d(0, 0, 0) scale(1)";
      return;
    }

    let rafId = 0;
    const update = () => {
      if (!headingRef.current) return;
      const rect = headingRef.current.getBoundingClientRect();
      const center = rect.top + rect.height * 0.5;
      const distance = Math.abs(center - window.innerHeight * 0.4);
      const influence = 1 - Math.min(distance / (window.innerHeight * 0.9), 1);
      const scale = 0.96 + influence * 0.04;
      headingRef.current.style.transform = `translate3d(0, 0, 0) scale(${scale.toFixed(3)})`;
      rafId = window.requestAnimationFrame(update);
    };

    rafId = window.requestAnimationFrame(update);
    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || loading) return;
    const cards = cardRefs.current.filter((card): card is HTMLDivElement => !!card);
    if (cards.length === 0) return;
    const timeoutIds: number[] = [];

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      cards.forEach((card) => {
        card.style.opacity = "1";
        card.style.transform = "translate3d(0, 0, 0) scale(1)";
      });
      return;
    }

    cards.forEach((card, index) => {
      card.style.opacity = "0";
      card.style.transform = "translate3d(0, 60px, 0) scale(0.92)";
      card.style.filter = "blur(8px)";
      card.style.willChange = "opacity, transform, filter";
      const timeoutId = window.setTimeout(() => {
        card.style.transition = "opacity 760ms cubic-bezier(0.22,1,0.36,1), transform 760ms cubic-bezier(0.22,1,0.36,1), filter 760ms cubic-bezier(0.22,1,0.36,1)";
        card.style.opacity = "1";
        card.style.transform = "translate3d(0, 0, 0) scale(1)";
        card.style.filter = "blur(0px)";
        window.setTimeout(() => {
          card.style.willChange = "auto";
        }, 860);
      }, index * 120);
      timeoutIds.push(timeoutId);
    });

    return () => {
      timeoutIds.forEach((id) => window.clearTimeout(id));
    };
  }, [loading, gyms.length, query, maxPrice, maxDistance, sortBy, onlyFeatured, onlyVerified]);

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
    const q = deferredQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((g) => fuzzyMatch(g.name, q));
    }
    const priceCap = Number(deferredMaxPrice);
    if (Number.isFinite(priceCap) && priceCap > 0) {
      list = list.filter((g) => g.monthlyPrice <= priceCap);
    }
    const distCap = Number(deferredMaxDistance);
    if (Number.isFinite(distCap) && distCap > 0) {
      list = list.filter((g) => (g.distance ?? Infinity) <= distCap * 1000);
    }
    if (onlyFeatured) {
      list = list.filter((g) => isGymFeatured(g));
    }
    if (onlyVerified) {
      list = list.filter(
        (g) => g.verificationStatus === "VERIFIED"
      );
    }

    const tierSort = (a: Gym, b: Gym) => getGymTierRank(a.gymTier) - getGymTierRank(b.gymTier);
    const featuredSort = (a: Gym, b: Gym) => {
      const aFeatured = isGymFeatured(a);
      const bFeatured = isGymFeatured(b);
      if (aFeatured !== bFeatured) return aFeatured ? -1 : 1;
      return 0;
    };

    switch (sortBy) {
      case "price_asc":
        list.sort((a, b) => tierSort(a, b) || a.monthlyPrice - b.monthlyPrice || (a.distance ?? Infinity) - (b.distance ?? Infinity) || featuredSort(a, b));
        break;
      case "price_desc":
        list.sort((a, b) => tierSort(a, b) || b.monthlyPrice - a.monthlyPrice || (a.distance ?? Infinity) - (b.distance ?? Infinity) || featuredSort(a, b));
        break;
      case "newest":
        list.sort((a, b) => tierSort(a, b) || new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime() || featuredSort(a, b));
        break;
      case "distance":
      default:
        list.sort((a, b) => tierSort(a, b) || (a.distance ?? Infinity) - (b.distance ?? Infinity) || featuredSort(a, b) || a.monthlyPrice - b.monthlyPrice);
    }
    return list;
  }, [gyms, deferredMaxDistance, deferredMaxPrice, deferredQuery, sortBy, onlyFeatured, onlyVerified]);

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
      filters.push({ label: SORT_LABELS[sortBy], onClear: () => setSortBy("distance") });
    }
    if (onlyFeatured) {
      filters.push({ label: "Featured only", onClear: () => setOnlyFeatured(false) });
    }
    if (onlyVerified) {
      filters.push({ label: "Verified only", onClear: () => setOnlyVerified(false) });
    }
    return filters;
  }, [maxDistance, maxPrice, query, sortBy, onlyFeatured, onlyVerified]);

  const filterCount =
    (query.trim() ? 1 : 0) +
    (Number(maxPrice) > 0 ? 1 : 0) +
    (Number(maxDistance) > 0 ? 1 : 0) +
    (onlyFeatured ? 1 : 0) +
    (onlyVerified ? 1 : 0);

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
    <div className="mx-auto w-full max-w-[1560px] px-4 py-10 sm:px-6 lg:px-10">
      {locationGate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-card border border-white/10 p-6 rounded-2xl max-w-md w-full text-center space-y-4">
            <h2 className="text-xl font-semibold">Find gyms near you</h2>
            <p className="text-sm text-muted-foreground">
              Show nearby verified gyms first, with transparent pricing and duo-friendly deals. You can explore without
              sharing your location.
            </p>
            {locationError && <p className="text-xs text-amber-400">{locationError}</p>}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={requestLocation} disabled={locationLoading}>
                {locationLoading ? "Locating…" : "Show gyms near me"}
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
        <section
          className="relative mb-10 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-glow-sm md:p-8"
          data-accent-color={accentRgb.indigo}
        >
          <div
            className="pointer-events-none absolute -right-12 top-[-22%] h-48 w-48 opacity-[0.11]"
            style={{ backgroundImage: accents.indigo.softGlow, filter: "blur(64px)" }}
          />
          <div className="flex flex-col gap-6">
            <div className="space-y-3">
              <h1
                ref={headingRef}
                className="motion-heading-highlight text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl"
              >
                Explore gyms in your city
              </h1>
              <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">
                Search by gym name, compare pricing, and shortlist trusted options with cleaner discovery controls.
              </p>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-2xl">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  placeholder="Search gyms in your city..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-11 pl-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={requestLocation} className="transition-colors whitespace-nowrap" variant="secondary">
                  Find gyms near me
                </Button>
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
            </div>
            <div className="flex flex-wrap gap-2">
              {SERVICEABLE_CITIES.map((city) => (
                <Link
                  key={city}
                  href={`/gyms-in-${city.toLowerCase().replace(/\s+/g, "-")}`}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-primary hover:bg-primary/10 hover:text-primary-foreground transition-colors"
                >
                  {city}
                </Link>
              ))}
            </div>
          </div>
        </section>
        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:p-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {loading ? "Loading gyms..." : `${filteredGyms.length} gyms available`}
              </p>
              <p className="text-xs text-muted-foreground">
                Sorted by <span className="text-foreground">{SORT_LABELS[sortBy]}</span>
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
            <div className="flex flex-wrap items-center justify-end gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <ArrowDownUp className="h-4 w-4" />
                    Sort: {SORT_LABELS[sortBy]}
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
                  <Button variant={filterCount > 0 ? "secondary" : "outline"} className="gap-2">
                    <SlidersHorizontal className="h-4 w-4" />
                    Filters
                    {filterCount > 0 && (
                      <span className="ml-1 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] text-primary">
                        {filterCount}
                      </span>
                    )}
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
        </section>

        {view === "map" && (
        <div className="mb-6 h-[360px]">
          <MapView
            latitude={mapCenter.latitude}
            longitude={mapCenter.longitude}
            gyms={gyms.map((g) => ({
              id: g.id,
              name: g.name,
              latitude: g.latitude,
              longitude: g.longitude,
              url: `/explore/${buildGymSlug(g.name, g.id)}`,
            }))}
            className="w-full h-full"
            showUserMarker={mapCenter.showUserMarker}
          />
        </div>
        )}

        {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
        ) : filteredGyms.length === 0 ? (
        <Card className="glass-card p-12 text-center space-y-3">
          <p className="text-muted-foreground">
            {loadFailed
              ? "We’re still onboarding gyms here. More verified listings are on the way."
              : query || maxPrice || maxDistance || onlyFeatured || onlyVerified
                ? "No matches yet. Try expanding distance or removing a filter."
                : "No gyms yet. Check back soon or explore a nearby area."}
          </p>
          <p className="text-xs text-muted-foreground">
            Want to list your gym? Add your details and go live in minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
            <Button variant="secondary" onClick={() => {
              setQuery("");
              setMaxPrice("");
              setMaxDistance("");
              setSortBy("distance");
              setOnlyFeatured(false);
              setOnlyVerified(false);
            }}>
              Clear filters
            </Button>
            <Button variant="outline" asChild>
              <Link href="/owners">List your gym (owners)</Link>
            </Button>
          </div>
        </Card>
        ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredGyms.map((gym, index) => {
            const isFeatured = isGymFeatured(gym);
            const accentName = accentByIndex(index);
            const accent = accents[accentName];
            const amenities = (gym.amenities ?? []).filter(Boolean).slice(0, 3);
            const hasDuo = gym.partnerDiscountPercent > 0;
            const isPremium = getGymTierRank(gym.gymTier) <= 1;
            const images = (gym.imageUrls ?? []).length > 0
              ? (gym.imageUrls ?? [])
              : gym.coverImageUrl
                ? [gym.coverImageUrl]
                : [];
            return (
            <div
              key={gym.id}
              ref={(node) => {
                cardRefs.current[index] = node;
              }}
              data-accent-color={accentRgb[accentName]}
            >
              <Card
                className={cn(
                    "motion-gym-card group glass-card relative flex h-full min-h-[380px] flex-col overflow-hidden transition-[transform,filter,opacity] duration-500 hover:-translate-y-[14px] hover:scale-[1.03] [filter:drop-shadow(0_16px_28px_rgba(0,0,0,0.18))] hover:[filter:drop-shadow(0_32px_48px_rgba(0,0,0,0.28))]",
                  isFeatured && "border-primary/40",
                  isPremium && "motion-gym-card-premium"
                )}
                style={
                  {
                    "--card-accent-gradient": accent.borderGlow,
                    "--card-accent-soft": accent.softGlow,
                  } as CSSProperties
                }
              >
                  <div
                    className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                    style={{ backgroundImage: accent.softGlow, filter: "blur(44px)" }}
                  />
                  {isPremium && (
                    <div
                      className="pointer-events-none absolute inset-0 opacity-[0.2]"
                      style={{ backgroundImage: accents.amber.softGlow, filter: "blur(60px)" }}
                    />
                  )}
                  <div className="relative aspect-[16/10] w-full">
                    {images.length > 0 ? (
                      <GymImageCarousel images={images} name={gym.name} />
                    ) : (
                      <div className="h-full w-full" style={{ backgroundImage: accent.gradient }} />
                    )}
                  </div>
                <CardHeader className="space-y-3 px-5 pb-4 pt-5 sm:px-6">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="line-clamp-1 text-lg font-bold sm:text-xl">{gym.name}</h3>
                    <div className="flex shrink-0 items-center gap-2">
                      {isFeatured && (
                        <span className="text-[10px] uppercase tracking-wide bg-primary/20 text-primary px-2 py-0.5 rounded-full animate-pulse">
                          Featured
                        </span>
                      )}
                      {gym.verificationStatus === "VERIFIED" ? (
                        <span className="text-[10px] uppercase tracking-wide bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                          Fitdex verified
                        </span>
                      ) : gym.verificationStatus === "PENDING" ? (
                        <span className="text-[10px] uppercase tracking-wide bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">
                          Verification in review
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase tracking-wide bg-slate-500/20 text-slate-300 px-2 py-0.5 rounded-full">
                          Listed
                        </span>
                      )}
                      {hasDuo && (
                        <span className="text-xs uppercase tracking-wide bg-indigo-500/20 text-indigo-200 px-3 py-1 rounded-full">
                          Duo save {gym.partnerDiscountPercent}%
                        </span>
                      )}
                      {gym.hasAC && (
                        <span className="text-[10px] uppercase tracking-wide bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-full">
                          AC
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
                  <p className="flex items-start gap-2 text-xs text-muted-foreground sm:text-sm">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/80" />
                    <span className="line-clamp-2">{gym.address}</span>
                  </p>
                  <p className={`text-xs mt-1 ${getGymOpenStatus({ ...gym, useIst: true }).isOpen ? "text-emerald-400" : "text-muted-foreground"}`}>
                    {getGymOpenStatus({ ...gym, useIst: true }).label}
                  </p>
                  {amenities.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {amenities.map((item) => (
                        <span
                          key={item}
                          className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
                        >
                          <span className="mr-1">{getAmenityEmoji(item)}</span>
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </CardHeader>
                <CardContent className="mt-auto flex items-end justify-between gap-3 border-t border-white/10 px-5 py-4 sm:px-6">
                  <div>
                    <p className="text-sm text-muted-foreground">Starting at</p>
                    <p
                      className="text-lg font-bold text-transparent bg-clip-text"
                      style={{ backgroundImage: accents.lime.gradient }}
                    >
                      <span data-accent-color={accentRgb.lime}>{formatPrice(gym.monthlyPrice)}</span>
                      <span className="ml-1 text-sm font-medium text-muted-foreground">/mo</span>
                    </p>
                    {gym.distance != null && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {(gym.distance / 1000).toFixed(1)} km away
                      </p>
                    )}
                    {hasDuo && (
                      <p className="mt-0.5 text-xs text-indigo-200">
                        Duo discount {gym.partnerDiscountPercent}% available
                      </p>
                    )}
                  </div>
                  <Button asChild size="sm" className="shrink-0">
                    <Link href={`/explore/${buildGymSlug(gym.name, gym.id)}`}>
                      View details
                      <ArrowRight className="ml-2 h-3 w-3" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
            );
          })}
        </div>
        )}
      </div>
    </div>
  );
}
