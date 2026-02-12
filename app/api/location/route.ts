import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isWithinDelhiNCR,
  isCityServiceable,
  reverseGeocode,
} from "@/lib/location";
import { jsonError, safeJson } from "@/lib/api";
import { logServerError } from "@/lib/logger";

// Always force route to be dynamic
export const dynamic = 'force-dynamic';

// Helper: checks if input "city" includes "delhi" (case-insensitive)
function isDelhiCity(city: string | null | undefined): boolean {
  if (!city || typeof city !== "string") return false;
  return /delhi/i.test(city);
}

/**
 * Helper: validates latitude/longitude for obvious issues
 */
function isBadLatLng(lat: any, lng: any): boolean {
  if (
    lat === null || lat === undefined || lat === "" ||
    lng === null || lng === undefined || lng === ""
  ) return true;
  // Coerce values
  if (typeof lat === "string") lat = parseFloat(lat);
  if (typeof lng === "string") lng = parseFloat(lng);
  if (typeof lat !== "number" || !Number.isFinite(lat)) return true;
  if (typeof lng !== "number" || !Number.isFinite(lng)) return true;
  if (lat === 0 && lng === 0) return true;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return true;
  if (String(lat).length > 15 || String(lng).length > 15) return true;
  return false;
}

/**
 * Async try/catch helper
 */
async function safeAsync<T = any>(fn: (...args: any[]) => Promise<T>, ...args: any[]): Promise<{ ok: boolean, result?: T, error?: any }> {
  try {
    const result = await fn(...args);
    return { ok: true, result };
  } catch (error) {
    return { ok: false, error };
  }
}

/**
 * Make isWithinDelhiNCR always return a Promise to solve the .then/await safeAsync signature
 */
async function isWithinDelhiNCRAsync(lat: number, lng: number): Promise<boolean> {
  return await Promise.resolve(isWithinDelhiNCR(lat, lng));
}

/**
 * POST endpoint: Accepts geo or city fallback. Normalizes all session and parsing types.
 */
export async function POST(req: Request) {
  try {
    // SESSION fetch, correct typing and defensiveness
    let session: { user?: { id?: string } } | null = null;
    const getSess = await safeAsync<typeof getServerSession>(getServerSession as any, authOptions);
    // Some issue: getSess.result can actually be undefined (if unauthenticated)
    if (!getSess.ok) {
      return NextResponse.json(
        {
          error: "Error retrieving authentication/session.",
          details: getSess.error?.message ?? String(getSess.error),
          canRetry: true,
        },
        { status: 500 }
      );
    }
    // Only assign if getSess.result is a Session object (not undefined)
    if (getSess.result && typeof getSess.result === "object") {
      session = getSess.result as { user?: { id?: string } };
    }

    // BODY parse
    const parsed = await safeJson<{
      latitude?: number | string | null;
      longitude?: number | string | null;
      city?: string | null;
    }>(req);
    if (!parsed.ok) {
      return jsonError("Invalid or malformed request body for location.", 400);
    }
    const body = parsed.data ?? {};

    // Defensive merge
    let latitude = body.latitude;
    let longitude = body.longitude;
    let cityFromUser = typeof body.city === "string" ? body.city.trim() : undefined;
    latitude = typeof latitude === "string" ? parseFloat(latitude) : latitude;
    longitude = typeof longitude === "string" ? parseFloat(longitude) : longitude;

    // --- GEOLOCATION FLOW ---
    if (!isBadLatLng(latitude, longitude)) {
      // Correct: both isWithinDelhiNCR and reverseGeocode are async (and safeAsync expects Promise returning)
      const delhiResPromise = safeAsync(isWithinDelhiNCRAsync, latitude, longitude);
      const geoResPromise = safeAsync(reverseGeocode, latitude, longitude);
      const [delhiResult, geoResult] = await Promise.all([delhiResPromise, geoResPromise]);

      if (!delhiResult.ok) {
        return NextResponse.json(
          {
            error: "Failed to check if your location is within Delhi NCR.",
            details: delhiResult.error?.message ?? String(delhiResult.error),
            canRetry: true,
          },
          { status: 502 }
        );
      }

      // Defensive checking
      const inDelhi: boolean = Boolean(delhiResult.result);
      let city: string | null = null;
      let state: string | null = null;

      if (geoResult.ok && geoResult.result) {
        city = typeof geoResult.result?.city === "string" ? geoResult.result.city : null;
        state = typeof geoResult.result?.state === "string" ? geoResult.result.state : null;
      } else if (inDelhi) {
        city = "Delhi";
        state = "Delhi";
      } else {
        return NextResponse.json(
          {
            error: "Could not retrieve city/state from your location.",
            details: geoResult.error?.message ?? String(geoResult.error),
            canRetry: true,
          },
          { status: 502 }
        );
      }

      // Normalize Delhi
      if (isDelhiCity(city)) city = "Delhi";

      // Serviceability check
      let serviceable = false;
      try {
        serviceable = inDelhi || (city ? isCityServiceable(city.toLowerCase().trim()) : false);
      } catch {
        serviceable = inDelhi;
      }

      // --- SAVE TO DB ---
      if (session && session.user && session.user.id) {
        const uid = String(session.user.id);
        try {
          await prisma.user.update({
            where: { id: uid },
            data: {
              latitude: Number.isFinite(latitude) ? (latitude as number) : null,
              longitude: Number.isFinite(longitude) ? (longitude as number) : null,
              city,
              state,
            }
          });
        } catch (dbError: any) {
          logServerError(dbError as Error, { route: "/api/location", userId: uid });
          return jsonError("Failed to save location to your profile.", 503);
        }
      }

      return NextResponse.json({
        latitude: Number.isFinite(latitude) ? latitude : null,
        longitude: Number.isFinite(longitude) ? longitude : null,
        city,
        state,
        serviceable,
        inDelhiNCR: inDelhi,
        canRetry: false,
      });
    }

    // --- MANUAL CITY FLOW ---
    if (cityFromUser && cityFromUser !== "") {
      const inDelhi = isDelhiCity(cityFromUser);
      const normalizedCity = inDelhi ? "Delhi" : cityFromUser.trim();
      let state: string | null = inDelhi ? "Delhi" : null;
      let serviceable = inDelhi || isCityServiceable(normalizedCity.toLowerCase());

      // Save to DB if logged in
      if (session && session.user && session.user.id) {
        const uid = String(session.user.id);
        try {
          await prisma.user.update({
            where: { id: uid },
            data: {
              latitude: null,
              longitude: null,
              city: normalizedCity,
              state,
            }
          });
        } catch (dbError: any) {
          logServerError(dbError as Error, { route: "/api/location", userId: uid });
          return jsonError("Failed to save location to your profile.", 503);
        }
      }

      return NextResponse.json({
        latitude: null,
        longitude: null,
        city: normalizedCity,
        state,
        serviceable,
        inDelhiNCR: inDelhi,
        canRetry: false,
        usedCityFallback: true,
      });
    }

    // --- NO LOCATION NOR CITY: Prompt for manual entry ---
    return NextResponse.json(
      {
        error: "Could not fetch your location automatically. Please enter your city manually below.",
        details: { received: { latitude, longitude, city: cityFromUser } },
        canRetry: true,
        allowManualCityEntry: true,
      },
      { status: 400 }
    );
  } catch (e: any) {
    // Robust error log
    if (typeof console !== "undefined" && typeof console.error === "function") {
      console.error("ERR/location-POST", e && e.stack ? e.stack : e);
    }
    logServerError(e as Error, { route: "/api/location" });
    return jsonError("An unexpected error occurred while updating your location.", 500);
  }
}

/**
 * GET: For client-side UI location fallback and recovery.
 */
export async function GET() {
  try {
    // --- SESSION ---
    let session: { user?: { id?: string } } | null = null;
    try {
      const result = await getServerSession(authOptions);
      if (result && typeof result === 'object') {
        session = result as { user?: { id?: string } };
      }
    } catch (sessErr: any) {
      logServerError(sessErr as Error, { route: "/api/location" });
      return jsonError("Error retrieving user authentication.", 500);
    }
    if (!session?.user || !session.user.id) {
      // Not logged in: Acceptable, prompt for manual
      return NextResponse.json({ location: null, canRetry: false, allowManualCityEntry: true });
    }
    const uid = String(session.user.id);

    // --- DB ---
    let user: { latitude?: any, longitude?: any, city?: any, state?: any } | null = null;
    try {
      user = await prisma.user.findUnique({
        where: { id: uid },
        select: {
          latitude: true,
          longitude: true,
          city: true,
          state: true,
        }
      });
    } catch (getUserError: any) {
      logServerError(getUserError as Error, { route: "/api/location", userId: uid });
      return jsonError("Failed to retrieve user location from the database. Please try again.", 500);
    }

    // --- Decide if valid lat/lng is present ---
    const hasValidLatLng = !!user
      && user.latitude !== null && user.latitude !== undefined && user.latitude !== "" && Number.isFinite(Number(user.latitude))
      && user.longitude !== null && user.longitude !== undefined && user.longitude !== "" && Number.isFinite(Number(user.longitude))
      && !(Number(user.latitude) === 0 && Number(user.longitude) === 0)
      && Number(user.latitude) >= -90 && Number(user.latitude) <= 90
      && Number(user.longitude) >= -180 && Number(user.longitude) <= 180;

    if (!user || !hasValidLatLng) {
      // fallback for city if present
      if (user && user.city && typeof user.city === "string" && user.city.trim().length > 0) {
        const cityFromUser = user.city.trim();
        const inDelhi = isDelhiCity(cityFromUser);
        const normalizedCity = inDelhi ? "Delhi" : cityFromUser;
        let state: string | null = typeof user.state === "string" ? user.state : null;
        if (inDelhi && !state) state = "Delhi";
        return NextResponse.json({
          location: {
            latitude: null,
            longitude: null,
            city: normalizedCity,
            state,
          },
          serviceable: inDelhi || isCityServiceable(normalizedCity.toLowerCase()),
          inDelhiNCR: inDelhi,
          canRetry: false,
          usedCityFallback: true,
          allowManualCityEntry: true,
        });
      }
      // No valid coordinates or city: show location entry
      return NextResponse.json({ location: null, canRetry: false, allowManualCityEntry: true });
    }

    // If here, user has valid lat/lng
    let city: string | null = typeof user.city === "string" ? user.city : null;
    if (city && isDelhiCity(city)) city = "Delhi";
    const lat = Number(user.latitude);
    const lng = Number(user.longitude);

    return NextResponse.json({
      location: {
        latitude: Number.isFinite(lat) ? lat : null,
        longitude: Number.isFinite(lng) ? lng : null,
        city,
        state: typeof user.state === "string" ? user.state : null,
      },
      canRetry: false,
      allowManualCityEntry: false,
    });
  } catch (e: any) {
    if (typeof console !== "undefined" && typeof console.error === "function") {
      console.error("ERR/location-GET", e && e.stack ? e.stack : e);
    }
    logServerError(e as Error, { route: "/api/location" });
    return jsonError("Failed to get location. Please check your network and try again.", 500);
  }
}
