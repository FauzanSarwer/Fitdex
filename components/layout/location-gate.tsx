"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchJson } from "@/lib/client-fetch";

interface LocationState {
  status: "idle" | "requesting" | "ready" | "denied" | "not_serviceable";
  latitude?: number;
  longitude?: number;
  city?: string;
  serviceable?: boolean;
}

const SKIP_PATH_PREFIXES = ["/auth/login", "/auth/register", "/auth/complete", "/dashboard"];

export function LocationGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { status: authStatus } = useSession();
  const [location, setLocation] = useState<LocationState>({ status: "idle" });
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const hasRequestedRef = useRef(false);

  const skipGate = SKIP_PATH_PREFIXES.some((p) => pathname?.startsWith(p));

  const requestLocation = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!navigator.geolocation) {
      setLocation({ status: "denied" });
      return;
    }
    setLocation((p) => ({ ...p, status: "requesting" }));
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        try {
          const result = await fetchJson<{ city?: string; serviceable?: boolean }>("/api/location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ latitude: lat, longitude: lng }),
            retries: 1,
          });
          if (!result.ok || !result.data || typeof result.data.serviceable !== "boolean") {
            // If API fails or doesn't return serviceability, allow access and avoid caching.
            setLocation({
              status: "ready",
              latitude: lat,
              longitude: lng,
              serviceable: true,
            });
            return;
          }

          const data = result.data;
          if (data.serviceable) {
            const loc = {
              status: "ready" as const,
              latitude: lat,
              longitude: lng,
              city: data.city,
              serviceable: true,
            };
            setLocation(loc);
            try {
              localStorage.setItem("gymduo_location", JSON.stringify({
                latitude: lat,
                longitude: lng,
                city: data.city,
                serviceable: true,
              }));
            } catch {}
          } else {
            const loc = {
              status: "not_serviceable" as const,
              latitude: lat,
              longitude: lng,
              city: data.city,
              serviceable: false,
            };
            setLocation(loc);
            try {
              localStorage.setItem("gymduo_location", JSON.stringify({
                latitude: lat,
                longitude: lng,
                city: data.city,
                serviceable: false,
              }));
            } catch {}
          }
        } catch {
          // If API fails, allow access but don't cache
          setLocation({
            status: "ready",
            latitude: lat,
            longitude: lng,
            serviceable: true,
          });
        }
      },
      (err) => {
        console.error("Location error:", err);
        setLocation({ status: "denied" });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  // 1) Check cache and server, then trigger browser location request
  useEffect(() => {
    if (skipGate) return;

    // Cached location — use it and skip request
    try {
      const override = localStorage.getItem("gymduo_location_override");
      if (override === "true") {
        setLocation({ status: "ready", serviceable: true });
        hasRequestedRef.current = true;
        return;
      }
      const cached = localStorage.getItem("gymduo_location");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.latitude && parsed.longitude && parsed.serviceable) {
          setLocation({
            status: "ready",
            latitude: parsed.latitude,
            longitude: parsed.longitude,
            city: parsed.city,
            serviceable: true,
          });
          hasRequestedRef.current = true;
          return;
        }
      }
    } catch {}

    // If authenticated, try server first
    if (authStatus === "authenticated") {
      fetchJson<{ location?: { latitude?: number; longitude?: number; city?: string } }>("/api/location", { retries: 1 })
        .then((result) => {
          const data = result.data ?? {};
          if (data.location?.latitude != null && data.location?.longitude != null) {
            const loc = {
              status: "ready" as const,
              latitude: data.location.latitude,
              longitude: data.location.longitude,
              city: data.location.city,
              serviceable: true,
            };
            setLocation(loc);
            try {
              localStorage.setItem("gymduo_location", JSON.stringify({
                latitude: loc.latitude,
                longitude: loc.longitude,
                city: loc.city,
                serviceable: true,
              }));
            } catch {}
            hasRequestedRef.current = true;
          }
          // No server location — stay on idle; user must click "Enable location"
        })
        .catch(() => {});
      return;
    }

    // Not authenticated: do NOT auto-request — browsers often only show the
    // location prompt for user gestures (e.g. click). User must click the button.
  }, [authStatus, skipGate]);

  if (skipGate) {
    return <>{children}</>;
  }

  if (location.status === "ready") {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode="wait">
      {location.status === "denied" && (
        <motion.div
          key="denied"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="min-h-screen flex items-center justify-center p-4 bg-background"
        >
          <Card className="max-w-md w-full glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Location required
              </CardTitle>
              <CardDescription>
                GymDuo needs your location to show gyms near you. Please enable location access and try again.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => {
                hasRequestedRef.current = false;
                requestLocation();
              }} className="w-full">
                Try again
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {location.status === "not_serviceable" && (
        <motion.div
          key="not_serviceable"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="min-h-screen flex items-center justify-center p-4 bg-background"
        >
          <Card className="max-w-md w-full glass-card text-center">
            <CardHeader>
              <CardTitle className="text-2xl">Currently not serviceable</CardTitle>
              <CardDescription>
                GymDuo is available only in Delhi / Delhi NCR. We’re expanding soon.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Join the waitlist and we’ll notify you when we launch in your city.
              </div>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={waitlistEmail}
                  onChange={(e) => setWaitlistEmail(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (waitlistEmail) {
                      try {
                        localStorage.setItem("gymduo_waitlist", waitlistEmail);
                      } catch {}
                    }
                  }}
                >
                  Notify me
                </Button>
              </div>
              <Button
                onClick={() => {
                  try {
                    localStorage.setItem("gymduo_location_override", "true");
                  } catch {}
                  setLocation({ status: "ready", serviceable: true });
                }}
                className="w-full"
              >
                Continue to site
              </Button>
              <Button variant="outline" onClick={() => {
                hasRequestedRef.current = false;
                requestLocation();
              }} className="w-full">
                Re-check location
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {(location.status === "idle" || location.status === "requesting") && (
        <motion.div
          key="request"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="min-h-screen flex items-center justify-center p-4 bg-background"
        >
          <Card className="max-w-md w-full glass-card text-center">
            <CardHeader>
              <CardTitle className="flex items-center justify-center gap-2">
                {location.status === "requesting" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <MapPin className="h-5 w-5" />
                )}
                {location.status === "requesting" ? "Getting location…" : "Share your location"}
              </CardTitle>
              <CardDescription>
                Click the button below — your browser will ask for location access. We use it to show gyms near you in Delhi NCR.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {location.status === "idle" && (
                <Button
                  onClick={() => {
                    hasRequestedRef.current = false;
                    requestLocation();
                  }}
                  className="w-full"
                  size="lg"
                >
                  Share my location
                </Button>
              )}
              {location.status === "requesting" && (
                <p className="text-sm text-muted-foreground">
                  Check your browser for a location permission prompt.
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
