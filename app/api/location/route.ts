import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isWithinDelhiNCR,
  isCityServiceable,
  reverseGeocode,
} from "@/lib/location";

export const dynamic = 'force-dynamic';

/**
 * Helper to check for missing or invalid latitude/longitude data,
 * including null, undefined, non-number, or placeholder values that Safari might send.
 */
function isBadLatLng(lat: any, lng: any): boolean {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return true;
  if (typeof lat !== "number" || typeof lng !== "number") return true;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return true;
  // Sometimes on some broken clients or browsers, these are 0/0 (rare, but just in case)
  if (lat === 0 && lng === 0) return true;
  return false;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();

    // Accept strings as numbers (if needed, Safari sometimes represents numbers as string)
    let { latitude, longitude } = body as { latitude: any; longitude: any };
    if (typeof latitude === "string") latitude = parseFloat(latitude);
    if (typeof longitude === "string") longitude = parseFloat(longitude);

    // Validate coordinates robustly, return Safari-specific error if needed
    if (isBadLatLng(latitude, longitude)) {
      // Add extra hint about Safari
      return NextResponse.json(
        { 
          error: "Invalid latitude or longitude received. Please check your browser's location permissions. On Safari, you may need to allow precise location in Settings > Privacy > Location Services > Safari Websites.",
          details: {
            received: { latitude, longitude },
          }
        },
        { status: 400 }
      );
    }

    const inDelhi = isWithinDelhiNCR(latitude, longitude);
    const geo = await reverseGeocode(latitude, longitude);
    const city = geo?.city ?? null;
    const state = geo?.state ?? null;
    const serviceable = inDelhi || (city ? isCityServiceable(city) : false);

    if (session?.user) {
      await prisma.user.update({
        where: { id: (session.user as { id: string }).id },
        data: { latitude, longitude, city, state },
      });
    }

    return NextResponse.json({
      latitude,
      longitude,
      city,
      state,
      serviceable,
      inDelhiNCR: inDelhi,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to update location. On Safari, make sure location access is enabled for this website, and that you have given permission.",
        details: e instanceof Error ? e.message : String(e)
      },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ location: null });
    }
    const uid = (session.user as { id: string }).id;
    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: {
        latitude: true,
        longitude: true,
        city: true,
        state: true,
      },
    });
    if (
      user?.latitude === null ||
      user?.latitude === undefined ||
      user?.longitude === null ||
      user?.longitude === undefined ||
      !Number.isFinite(Number(user?.latitude)) ||
      !Number.isFinite(Number(user?.longitude))
    ) {
      return NextResponse.json({ location: null });
    }
    return NextResponse.json({
      location: {
        latitude: user.latitude,
        longitude: user.longitude,
        city: user.city,
        state: user.state,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to get location. On Safari, make sure location access is enabled for this website.", details: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
