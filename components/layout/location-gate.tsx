"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { fetchJson } from "@/lib/client-fetch";

const SKIP_PATH_PREFIXES = ["/auth/login", "/auth/register", "/auth/complete"];

type StoredLocation = {
  latitude: number;
  longitude: number;
  city?: string;
  serviceable: boolean;
};

const isValidLocation = (value: unknown): value is StoredLocation => {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<StoredLocation>;
  return typeof payload.latitude === "number" && typeof payload.longitude === "number";
};

export function LocationGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { status: authStatus } = useSession();
  const requestedRef = useRef(false);
  const skipGate = SKIP_PATH_PREFIXES.some((prefix) => pathname?.startsWith(prefix));

  useEffect(() => {
    if (skipGate || requestedRef.current || typeof window === "undefined") return;
    requestedRef.current = true;

    const persist = (location: StoredLocation) => {
      try {
        localStorage.setItem("fitdex_location", JSON.stringify(location));
      } catch {}
    };

    const hydrateFromServer = async () => {
      if (authStatus !== "authenticated") return false;
      try {
        const result = await fetchJson<{ location?: { latitude?: number; longitude?: number; city?: string } }>(
          "/api/location",
          {
            retries: 1,
            useCache: true,
            cacheKey: "user-location",
            cacheTtlMs: 15000,
          }
        );
        const serverLocation = result.data?.location;
        if (
          typeof serverLocation?.latitude === "number" &&
          typeof serverLocation?.longitude === "number"
        ) {
          persist({
            latitude: serverLocation.latitude,
            longitude: serverLocation.longitude,
            city: serverLocation.city,
            serviceable: true,
          });
          return true;
        }
      } catch {}
      return false;
    };

    const requestBrowserLocation = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const latitude = pos.coords.latitude;
          const longitude = pos.coords.longitude;
          try {
            const result = await fetchJson<{ city?: string; serviceable?: boolean }>("/api/location", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ latitude, longitude }),
              retries: 1,
            });
            const serviceable =
              result.ok && typeof result.data?.serviceable === "boolean" ? result.data.serviceable : true;
            persist({
              latitude,
              longitude,
              city: result.data?.city,
              serviceable,
            });
          } catch {
            persist({ latitude, longitude, serviceable: true });
          }
        },
        () => {
          // Ignore denial/errors to avoid blocking the app.
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    };

    const run = async () => {
      try {
        const raw = localStorage.getItem("fitdex_location");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (isValidLocation(parsed)) return;
        }
      } catch {}

      const hydrated = await hydrateFromServer();
      if (!hydrated) {
        requestBrowserLocation();
      }
    };

    run().catch(() => undefined);
  }, [authStatus, skipGate]);

  return <>{children}</>;
}
