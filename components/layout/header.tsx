"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { isOwner } from "@/lib/permissions";
import Image from "next/image";
import { MapPin, User, LayoutDashboard, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { accentRgb, accents } from "@/lib/theme/accents";
import { useScrollEngine } from "@/components/motion/useScrollEngine";
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
  const { data: session, status } = useSession();
  const headerRef = useRef<HTMLElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);
  const blurLayerRef = useRef<HTMLDivElement | null>(null);
  const { scrollVelocity } = useScrollEngine();
  const role = (session?.user as { role?: string })?.role;
  const owner = status === "authenticated" && isOwner(session);
  const emailVerified = !!(session?.user as { emailVerified?: boolean })?.emailVerified;
  const [sendingVerification, setSendingVerification] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [selectedCity, setSelectedCity] = useState("Select city");
  const [locatingCity, setLocatingCity] = useState(false);

  const displayName = session?.user?.name ?? "Account";

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
      {!emailVerified && session && (
        <div className="bg-amber-500/20 border-b border-amber-500/30">
          <div className="container mx-auto px-4 py-2 text-xs text-amber-100 flex flex-wrap items-center gap-2 justify-between">
            <span>
              Verify your email address. A link has been sent to {session.user.email ?? "your email"}.
            </span>
            <button
              type="button"
              disabled={sendingVerification}
              className="text-amber-50 underline hover:text-white disabled:opacity-60"
              onClick={async () => {
                setSendingVerification(true);
                try {
                  const res = await fetch("/api/auth/verify", { method: "POST" });
                  if (res.ok) setVerificationSent(true);
                } finally {
                  setSendingVerification(false);
                }
              }}
            >
              {sendingVerification ? "Sending…" : verificationSent ? "Link sent" : "Resend link"}
            </button>
          </div>
        </div>
      )}
      <div ref={barRef} className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-card/80 shadow-glow-sm">
            <Image
              src="/fitdex-logo.png"
              alt="Fitdex"
              width={24}
              height={24}
              className="h-6 w-6"
              priority
            />
          </div>
        </Link>
        <nav className="hidden md:flex items-center gap-4">
          <Link
            href="/explore"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <MapPin className="h-4 w-4" />
            Explore
          </Link>
          {status === "authenticated" && (
            <Link
              href="/dashboard"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Dashboard
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-3">
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
