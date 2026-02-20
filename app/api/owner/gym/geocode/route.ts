import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { jsonError, safeJson } from "@/lib/api";
import { resolveAddressToCoordinates, reverseGeocode } from "@/lib/location";
import { requireOwner } from "@/lib/permissions";
import { ratelimit } from "@/lib/rate-limit";

type GeocodeRequest = {
  address?: string;
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) return jsonError("Unauthorized", 401);

  const uid = (session!.user as { id: string }).id;
  const { success } = await ratelimit.limit(`owner-gym-geocode:${uid}`);
  if (!success) return jsonError("Too many requests", 429);

  const parsed = await safeJson<GeocodeRequest>(req);
  if (!parsed.ok) return jsonError("Invalid JSON body", 400);

  const address = parsed.data.address?.trim();
  if (!address) return jsonError("Address is required", 400);

  const resolved = await resolveAddressToCoordinates(address);
  if (!resolved) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unable to resolve coordinates from address",
        hint: "Try adding landmark/city/state/pincode in the address.",
      },
      { status: 422 }
    );
  }

  const location = await reverseGeocode(resolved.latitude, resolved.longitude);
  return NextResponse.json({
    ok: true,
    address,
    latitude: resolved.latitude,
    longitude: resolved.longitude,
    provider: resolved.provider,
    formattedAddress: resolved.formattedAddress ?? null,
    city: location?.city ?? null,
    state: location?.state ?? null,
  });
}
