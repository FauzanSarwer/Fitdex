"use client";

import { useMemo, useState, useEffect, useDeferredValue, useRef, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { MapPin, List, LayoutGrid, ArrowRight, Heart, SlidersHorizontal, ArrowDownUp } from "lucide-react";
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
import Image from "next/image";
import { buildGymSlug, cn, formatPrice } from "@/lib/utils";
import { getGymTierRank, isGymFeatured } from "@/lib/gym-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { getGymOpenStatus } from "@/lib/gym-hours";
import { fetchJson } from "@/lib/client-fetch";
import { getAmenityEmoji } from "@/lib/amenities";
import { cityLabel, normalizeCityName } from "@/lib/seo/cities";
import { accentByIndex, accentRgb, accents } from "@/lib/theme/accents";

const MapView = dynamic(() => import("@/components/maps/MapView").then((mod) => mod.MapView), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-2xl" />,
});

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

type PreparedGym = Gym & {
  normalizedName: string;
  tierRank: number;
  featured: boolean;
  distanceValue: number;
  createdAtValue: number;
  slug: string;
  amenityPreview: string[];
  imageList: string[];
  hasDuo: boolean;
  isPremium: boolean;
};

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

const fuzzyMatch = (normalizedName: string, normalizedQuery: string) => {
  const n = normalizedName;
  const query = normalizedQuery;
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
        className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]"
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
  const searchParams = useSearchParams();
  const [view, setView] = useState<ViewMode>("list");
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [query, setQuery] = useState("");
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
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const cityQueryParam = searchParams.get("city") ?? "";
  const queryFromNav = searchParams.get("q") ?? "";
  const exploreCity = useMemo(() => {
    const normalized = normalizeCityName(cityQueryParam);
    return normalized ? cityLabel(normalized) : "";
  }, [cityQueryParam]);

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

  const preparedGyms = useMemo<PreparedGym[]>(
    () =>
      gyms.map((gym) => ({
        ...gym,
        amenityPreview: (gym.amenities ?? []).filter(Boolean).slice(0, 3),
        imageList:
          (gym.imageUrls ?? []).length > 0
            ? (gym.imageUrls ?? [])
            : gym.coverImageUrl
              ? [gym.coverImageUrl]
              : [],
        hasDuo: gym.partnerDiscountPercent > 0,
        normalizedName: normalize(gym.name),
        tierRank: getGymTierRank(gym.gymTier),
        isPremium: getGymTierRank(gym.gymTier) <= 1,
        featured: isGymFeatured(gym),
        distanceValue: gym.distance ?? Number.POSITIVE_INFINITY,
        createdAtValue: new Date(gym.createdAt ?? 0).getTime(),
        slug: buildGymSlug(gym.name, gym.id),
      })),
    [gyms]
  );

  const mapGyms = useMemo(
    () =>
      preparedGyms.map((gym) => ({
        id: gym.id,
        name: gym.name,
        latitude: gym.latitude,
        longitude: gym.longitude,
        url: `/explore/${gym.slug}`,
      })),
    [preparedGyms]
  );

  const loadGyms = async (url: string) => {
    setError(null);
    setLoadFailed(false);
    setLoading(true);
    try {
      const result = await fetchJson<{ gyms?: Gym[]; error?: string }>(url, {
        retries: 2,
        useCache: true,
        cacheKey: url,
        cacheTtlMs: 20000,
      });
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
        setLocationLoading(false);
        loadGyms(`/api/gyms?lat=${lat}&lng=${lng}`);
        try {
          localStorage.setItem(
            "fitdex_location",
            JSON.stringify({ latitude: lat, longitude: lng, serviceable: true })
          );
        } catch {}
      },
      () => {
        setLocationLoading(false);
        loadGyms("/api/gyms");
      }
    );
  };

  useEffect(() => {
    if (exploreCity) {
      setUserLat(null);
      setUserLng(null);
      loadGyms(`/api/gyms?city=${encodeURIComponent(exploreCity)}`);
      try {
        localStorage.setItem("fitdex_selected_city", exploreCity);
        const cached = localStorage.getItem("fitdex_location");
        const parsed = cached ? JSON.parse(cached) : {};
        localStorage.setItem(
          "fitdex_location",
          JSON.stringify({
            ...parsed,
            city: exploreCity,
            serviceable: true,
          })
        );
      } catch {}
    } else {
      try {
        const cached = localStorage.getItem("fitdex_location");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.latitude && parsed?.longitude) {
            setUserLat(parsed.latitude);
            setUserLng(parsed.longitude);
            loadGyms(`/api/gyms?lat=${parsed.latitude}&lng=${parsed.longitude}`);
            return;
          }
        }
      } catch {}
      requestLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exploreCity]);

  useEffect(() => {
    setQuery((current) => (current === queryFromNav ? current : queryFromNav));
  }, [queryFromNav]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetchJson<{ saved?: Array<{ gymId: string }> }>("/api/saved-gyms", {
      retries: 1,
      useCache: true,
      cacheKey: "saved-gyms",
      cacheTtlMs: 10000,
    })
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
    if (typeof window === "undefined" || loading) return;
    const cards = cardRefs.current.filter((card): card is HTMLDivElement => !!card);
    if (cards.length === 0) return;
    const timeoutIds: number[] = [];

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      cards.forEach((card) => {
        card.style.opacity = "1";
        card.style.transform = "translate3d(0, 0, 0)";
      });
      return;
    }

    cards.forEach((card, index) => {
      card.style.opacity = "0";
      card.style.transform = "translate3d(0, 60px, 0)";
      card.style.filter = "blur(8px)";
      card.style.willChange = "opacity, transform, filter";
      const timeoutId = window.setTimeout(() => {
        card.style.transition = "opacity 760ms cubic-bezier(0.22,1,0.36,1), transform 760ms cubic-bezier(0.22,1,0.36,1), filter 760ms cubic-bezier(0.22,1,0.36,1)";
        card.style.opacity = "1";
        card.style.transform = "translate3d(0, 0, 0)";
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
    let list = preparedGyms;
    const q = normalize(deferredQuery.trim());
    if (q) {
      list = list.filter((g) => fuzzyMatch(g.normalizedName, q));
    }
    const priceCap = Number(deferredMaxPrice);
    if (Number.isFinite(priceCap) && priceCap > 0) {
      list = list.filter((g) => g.monthlyPrice <= priceCap);
    }
    const distCap = Number(deferredMaxDistance);
    if (Number.isFinite(distCap) && distCap > 0) {
      list = list.filter((g) => g.distanceValue <= distCap * 1000);
    }
    if (onlyFeatured) {
      list = list.filter((g) => g.featured);
    }
    if (onlyVerified) {
      list = list.filter((g) => g.verificationStatus === "VERIFIED");
    }

    const tierSort = (a: PreparedGym, b: PreparedGym) => a.tierRank - b.tierRank;
    const featuredSort = (a: PreparedGym, b: PreparedGym) => Number(b.featured) - Number(a.featured);

    list = [...list];

    switch (sortBy) {
      case "price_asc":
        list.sort((a, b) => tierSort(a, b) || a.monthlyPrice - b.monthlyPrice || a.distanceValue - b.distanceValue || featuredSort(a, b));
        break;
      case "price_desc":
        list.sort((a, b) => tierSort(a, b) || b.monthlyPrice - a.monthlyPrice || a.distanceValue - b.distanceValue || featuredSort(a, b));
        break;
      case "newest":
        list.sort((a, b) => tierSort(a, b) || b.createdAtValue - a.createdAtValue || featuredSort(a, b));
        break;
      case "distance":
      default:
        list.sort((a, b) => tierSort(a, b) || a.distanceValue - b.distanceValue || featuredSort(a, b) || a.monthlyPrice - b.monthlyPrice);
    }
    return list;
  }, [preparedGyms, deferredMaxDistance, deferredMaxPrice, deferredQuery, sortBy, onlyFeatured, onlyVerified]);

  const filterCount =
    (query.trim() ? 1 : 0) +
    (Number(maxPrice) > 0 ? 1 : 0) +
    (Number(maxDistance) > 0 ? 1 : 0) +
    (onlyFeatured ? 1 : 0) +
    (onlyVerified ? 1 : 0);

  const clearFilters = () => {
    setQuery("");
    setMaxPrice("");
    setMaxDistance("");
    setSortBy("distance");
    setOnlyFeatured(false);
    setOnlyVerified(false);
  };

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
      <div>
        <section className="mb-5 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 backdrop-blur-md">
          <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button onClick={requestLocation} className="transition-colors whitespace-nowrap" variant="secondary">
                {locationLoading ? "Locating..." : "Find gyms near me"}
              </Button>
              <div className="flex overflow-hidden rounded-xl border border-white/10">
                <Button
                  variant={view === "list" ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded-none"
                  onClick={() => setView("list")}
                >
                  <List className="mr-1 h-4 w-4" />
                  List
                </Button>
                <Button
                  variant={view === "map" ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded-none"
                  onClick={() => setView("map")}
                >
                  <LayoutGrid className="mr-1 h-4 w-4" />
                  Map
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-2 rounded-lg px-3 text-xs">
                  <ArrowDownUp className="h-3.5 w-3.5" />
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
                <Button variant={filterCount > 0 ? "secondary" : "outline"} size="sm" className="h-8 gap-2 rounded-lg px-3 text-xs">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filters
                  {filterCount > 0 && (
                    <span className="ml-1 rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary">
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
                      onClick={clearFilters}
                    >
                      Clear all
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
            gyms={mapGyms}
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
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
            {!exploreCity && (
              <Button variant="outline" asChild>
                <Link href="/owners">List your gym (owners)</Link>
              </Button>
            )}
          </div>
        </Card>
        ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredGyms.map((gym, index) => {
            const isFeatured = gym.featured;
            const accentName = accentByIndex(index);
            const accent = accents[accentName];
            const amenities = gym.amenityPreview;
            const hasDuo = gym.hasDuo;
            const isPremium = gym.isPremium;
            const images = gym.imageList;
            const openStatus = getGymOpenStatus({
              openTime: gym.openTime,
              closeTime: gym.closeTime,
              openDays: gym.openDays,
              useIst: true,
            });
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
                    "motion-gym-card group glass-card relative flex h-full min-h-[380px] flex-col overflow-hidden transition-[transform,filter,opacity] duration-400 hover:-translate-y-[4px] [filter:drop-shadow(0_10px_18px_rgba(0,0,0,0.16))] hover:[filter:drop-shadow(0_16px_26px_rgba(0,0,0,0.22))]",
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
                    className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 opacity-0 transition-opacity duration-400 group-hover:opacity-70"
                    style={{ backgroundImage: accent.softGlow, filter: "blur(36px)" }}
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
                      <Link href={`/explore/${gym.slug}`} className="text-xs text-primary hover:underline">
                        View
                      </Link>
                    </div>
                  </div>
                  <p className="flex items-start gap-2 text-xs text-muted-foreground sm:text-sm">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/80" />
                    <span className="line-clamp-2">{gym.address}</span>
                  </p>
                  <p className={`text-xs mt-1 ${openStatus.isOpen ? "text-emerald-400" : "text-muted-foreground"}`}>
                    {openStatus.label}
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
                    <Link href={`/explore/${gym.slug}`}>
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
