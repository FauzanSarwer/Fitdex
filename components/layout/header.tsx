"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { isOwner } from "@/lib/permissions";
import Image from "next/image";
import { MapPin, User, LayoutDashboard, LogOut, ShieldCheck, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { accentRgb, accents } from "@/lib/theme/accents";
import { cityLabel, normalizeCityName } from "@/lib/seo/cities";
import { useScrollEngine } from "@/components/motion/useScrollEngine";
import { EmailVerificationBanner } from "@/components/layout/email-verification-banner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CITY_OPTIONS = [
  "Delhi",
  "Gurugram",
  "Noida",
  "Mumbai",
  "Pune",
  "Bangalore",
  "Hyderabad",
  "Jaipur",
  "Kolkata",
  "Lucknow",
];

type LocationPayload = {
  latitude?: number;
  longitude?: number;
  city?: string;
};

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const headerRef = useRef<HTMLElement | null>(null);
  const bannerSlotRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);
  const blurLayerRef = useRef<HTMLDivElement | null>(null);
  const { scrollVelocity } = useScrollEngine();
  const role = (session?.user as { role?: string })?.role;
  const owner = status === "authenticated" && isOwner(session);
  const [selectedCity, setSelectedCity] = useState("Select city");
  const [locatingCity, setLocatingCity] = useState(false);
  const [exploreQuery, setExploreQuery] = useState("");
  const isExplorePage = pathname === "/explore";
  const cityFromQueryParam = searchParams.get("city") ?? "";

  const displayName = session?.user?.name ?? "Account";
  const primaryNav =
    status === "authenticated"
      ? role === "ADMIN"
        ? { href: "/dashboard/admin", label: "Admin panel", icon: ShieldCheck }
        : owner
          ? { href: "/dashboard/owner", label: "Owner panel", icon: LayoutDashboard }
          : { href: "/dashboard/user", label: "Dashboard", icon: LayoutDashboard }
      : null;

  const persistCity = (city: string, latitude?: number, longitude?: number) => {
    setSelectedCity(city);
    try {
      localStorage.setItem("fitdex_selected_city", city);
      const cached = localStorage.getItem("fitdex_location");
      const parsed = cached ? JSON.parse(cached) : {};
      localStorage.setItem(
        "fitdex_location",
        JSON.stringify({
          ...parsed,
          city,
          latitude: latitude ?? parsed.latitude,
          longitude: longitude ?? parsed.longitude,
          serviceable: true,
        })
      );
    } catch {}
  };

  const saveCity = async ({ city, latitude, longitude }: LocationPayload) => {
    try {
      await fetch("/api/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, latitude, longitude }),
      });
    } catch {}
  };

  const detectCurrentCity = () => {
    if (typeof window === "undefined" || !navigator.geolocation) return;
    setLocatingCity(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const latitude = coords.latitude;
        const longitude = coords.longitude;
        try {
          const response = await fetch("/api/location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ latitude, longitude }),
          });
          const data = (await response.json().catch(() => null)) as { city?: string } | null;
          const resolvedCity = typeof data?.city === "string" && data.city.trim() ? data.city.trim() : null;
          if (resolvedCity) {
            persistCity(resolvedCity, latitude, longitude);
          }
        } catch {
          // no-op: selector keeps manual fallback available
        } finally {
          setLocatingCity(false);
        }
      },
      () => {
        setLocatingCity(false);
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 300000 }
    );
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    try {
      const chosenCity = localStorage.getItem("fitdex_selected_city");
      if (chosenCity) {
        setSelectedCity(chosenCity);
        return;
      }
      const cached = localStorage.getItem("fitdex_location");
      if (cached) {
        const parsed = JSON.parse(cached) as { city?: string };
        if (typeof parsed.city === "string" && parsed.city.trim()) {
          setSelectedCity(parsed.city.trim());
          return;
        }
      }
    } catch {}
    detectCurrentCity();
  }, []);

  useEffect(() => {
    if (!isExplorePage) {
      setExploreQuery("");
      return;
    }
    setExploreQuery(searchParams.get("q") ?? "");
  }, [isExplorePage, searchParams]);

  useEffect(() => {
    if (!isExplorePage) return;
    const normalized = normalizeCityName(cityFromQueryParam);
    if (!normalized) return;
    const city = cityLabel(normalized);
    if (selectedCity.trim().toLowerCase() === city.toLowerCase()) return;
    persistCity(city);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityFromQueryParam, isExplorePage, selectedCity]);

  useEffect(() => {
    if (!isExplorePage || typeof window === "undefined") return;
    const currentQuery = searchParams.get("q") ?? "";
    if (exploreQuery === currentQuery) return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const nextQuery = exploreQuery.trim();
      if (nextQuery) {
        params.set("q", nextQuery);
      } else {
        params.delete("q");
      }
      const queryString = params.toString();
      router.replace(queryString ? `/explore?${queryString}` : "/explore", { scroll: false });
    }, 220);
    return () => window.clearTimeout(timeoutId);
  }, [exploreQuery, isExplorePage, router, searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const header = headerRef.current;
    const bar = barRef.current;
    const glow = glowRef.current;
    const blurLayer = blurLayerRef.current;
    if (!header || !bar || !glow || !blurLayer) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      header.style.opacity = "1";
      header.style.transform = "translate3d(0, 0, 0)";
      bar.style.height = "64px";
      glow.style.opacity = "0.28";
      blurLayer.style.opacity = "0.2";
      blurLayer.style.filter = "blur(0px)";
      return;
    }

    header.style.opacity = "0";
    header.style.transform = "translate3d(0, -20px, 0)";
    header.style.willChange = "opacity, transform";
    window.requestAnimationFrame(() => {
      header.style.transition = "opacity 640ms cubic-bezier(0.22,1,0.36,1), transform 640ms cubic-bezier(0.22,1,0.36,1)";
      header.style.opacity = "1";
      header.style.transform = "translate3d(0, 0, 0)";
      window.setTimeout(() => {
        if (header) {
          header.style.willChange = "auto";
        }
      }, 700);
    });

    let rafId = 0;
    const tick = (time: number) => {
      const depth = Math.min(window.scrollY / 160, 1);
      const speed = Math.min(Math.abs(scrollVelocity.current) / 1800, 1);
      const height = 64 - depth * 8;

      bar.style.height = `${height.toFixed(2)}px`;
      glow.style.opacity = (0.24 + depth * 0.56).toFixed(3);
      glow.style.backgroundPosition = `${((time * 0.018) % 200).toFixed(2)}% 0%`;
      blurLayer.style.opacity = (0.18 + depth * 0.26).toFixed(3);
      blurLayer.style.filter = `blur(${(depth * 5 + speed * 2).toFixed(2)}px)`;

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [scrollVelocity]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    const baseOffset = 64;
    const applyOffset = () => {
      const bannerHeight = bannerSlotRef.current?.offsetHeight ?? 0;
      root.style.setProperty("--fitdex-header-offset", `${baseOffset + bannerHeight}px`);
    };

    applyOffset();
    if (typeof ResizeObserver === "undefined" || !bannerSlotRef.current) {
      return () => {
        root.style.setProperty("--fitdex-header-offset", `${baseOffset}px`);
      };
    }

    const observer = new ResizeObserver(applyOffset);
    observer.observe(bannerSlotRef.current);
    window.addEventListener("orientationchange", applyOffset);
    window.addEventListener("resize", applyOffset);

    return () => {
      observer.disconnect();
      window.removeEventListener("orientationchange", applyOffset);
      window.removeEventListener("resize", applyOffset);
      root.style.setProperty("--fitdex-header-offset", `${baseOffset}px`);
    };
  }, []);

  const handleCitySelect = async (city: string) => {
    persistCity(city);
    await saveCity({ city });
  };

  return (
    <header
      ref={headerRef}
      data-accent-color={accentRgb.indigo}
      className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/60 overflow-hidden"
    >
      <div ref={blurLayerRef} className="pointer-events-none absolute inset-0 bg-background/65 opacity-20" />
      <div
        ref={glowRef}
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-30"
        style={{
          backgroundImage: accents.cyan.borderGlow,
          backgroundSize: "200% 100%",
        }}
      />
      <div ref={bannerSlotRef}>
        <EmailVerificationBanner />
      </div>
      <div ref={barRef} className="container relative mx-auto flex h-16 items-center px-4">
        <Link href="/" className="group flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-card/80 shadow-glow-sm transition-all duration-300 group-hover:bg-card group-hover:shadow-[0_10px_22px_rgba(0,0,0,0.24)]">
            <Image
              src="/fitdex-logo.png"
              alt="Fitdex"
              width={24}
              height={24}
              className="h-6 w-6 object-contain rotate-0 skew-x-0 skew-y-0 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3"
              priority
            />
          </div>
        </Link>
        <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden -translate-x-1/2 md:flex items-center">
          {isExplorePage ? (
            <div className="pointer-events-auto w-[min(46vw,520px)]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/80" />
                <Input
                  value={exploreQuery}
                  onChange={(event) => setExploreQuery(event.target.value)}
                  placeholder="Search gyms..."
                  aria-label="Search gyms"
                  className="h-9 rounded-full border border-white/15 bg-white/[0.08] pl-9 text-sm backdrop-blur-md"
                />
              </div>
            </div>
          ) : primaryNav ? (
            <nav className="pointer-events-auto">
              <Link
                href={primaryNav.href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <primaryNav.icon className="h-4 w-4" />
                {primaryNav.label}
              </Link>
            </nav>
          ) : null}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="max-w-[140px] md:max-w-[170px] gap-1.5 px-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="truncate text-sm">{locatingCity ? "Locating..." : selectedCity}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 glass border-border/60">
              <DropdownMenuLabel>Select your city</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {CITY_OPTIONS.map((city) => (
                <DropdownMenuItem
                  key={city}
                  onClick={() => {
                    void handleCitySelect(city);
                  }}
                  className={city === selectedCity ? "text-primary" : ""}
                >
                  {city}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={detectCurrentCity}
                disabled={locatingCity}
                className="text-muted-foreground"
              >
                {locatingCity ? "Detecting..." : "Use current location"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {status === "loading" ? (
            <div className="h-9 w-12 rounded-lg bg-muted animate-pulse" />
          ) : session ? (
            <>
              <span className="hidden md:inline text-sm font-medium text-muted-foreground">
                {displayName}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center"
                      style={{ backgroundImage: accents.indigo.gradient }}
                    >
                      <User className="h-4 w-4" />
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 glass border-border/60">
                  <DropdownMenuItem asChild>
                    <Link href={role === "ADMIN" ? "/dashboard/admin" : owner ? "/dashboard/owner" : "/dashboard/user"}>
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      {role === "ADMIN" ? "Admin dashboard" : "Dashboard"}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      void signOut();
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button variant="ghost" asChild>
              <Link href="/auth/login">Login</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
