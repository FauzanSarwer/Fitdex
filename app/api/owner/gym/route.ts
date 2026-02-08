import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forwardGeocode, reverseGeocode } from "@/lib/location";
import { requireOwner } from "@/lib/permissions";
import { jsonError, safeJson } from "@/lib/api";
import { logServerError } from "@/lib/logger";
import { normalizeAmenities } from "@/lib/gym-utils";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  try {
    const gyms = await prisma.gym.findMany({
      where: { ownerId: uid },
      include: {
        _count: {
          select: { memberships: true, duos: true },
        },
      },
    });
    return NextResponse.json({ gyms });
  } catch (error) {
    logServerError(error as Error, { route: "/api/owner/gym", userId: uid });
    return jsonError("Failed to load gyms", 500);
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const parsed = await safeJson<{
    name?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    hasAC?: boolean;
    amenities?: string[] | string;
    ownerConsent?: boolean;
    openTime?: string | null;
    closeTime?: string | null;
    openDays?: string | null;
    dayPassPrice?: number | null;
    monthlyPrice?: number;
    quarterlyPrice?: number | null;
    yearlyPrice?: number;
    partnerDiscountPercent?: number;
    quarterlyDiscountType?: "PERCENT" | "FLAT";
    quarterlyDiscountValue?: number;
    yearlyDiscountType?: "PERCENT" | "FLAT";
    yearlyDiscountValue?: number;
    welcomeDiscountType?: "PERCENT" | "FLAT";
    welcomeDiscountValue?: number;
    coverImageUrl?: string | null;
    instagramUrl?: string | null;
    facebookUrl?: string | null;
    youtubeUrl?: string | null;
  }>(req);
  if (!parsed.ok) {
    return jsonError("Invalid JSON body", 400);
  }
  const {
    name,
    address,
    latitude,
    longitude,
    hasAC,
    amenities,
    ownerConsent,
    openTime,
    closeTime,
    openDays,
    dayPassPrice,
    monthlyPrice,
    quarterlyPrice,
    yearlyPrice,
    partnerDiscountPercent,
    quarterlyDiscountType,
    quarterlyDiscountValue,
    yearlyDiscountType,
    yearlyDiscountValue,
    welcomeDiscountType,
    welcomeDiscountValue,
    coverImageUrl,
    instagramUrl,
    facebookUrl,
    youtubeUrl,
  } = parsed.data;
  if (!name || !address || monthlyPrice == null || yearlyPrice == null || !coverImageUrl) {
    return jsonError(
      "name, address, coverImageUrl, monthlyPrice, yearlyPrice required",
      400
    );
  }
  if (!ownerConsent) {
    return jsonError("Owner consent is required to list a gym", 400);
  }
  try {
    let lat = latitude;
    let lng = longitude;
    let city: string | null = null;
    let state: string | null = null;
    if (lat == null || lng == null) {
      const geo = await forwardGeocode(address.trim());
      if (!geo) {
        return jsonError("Unable to resolve location from address", 400);
      }
      lat = geo.latitude;
      lng = geo.longitude;
    }
    if (lat != null && lng != null) {
      const location = await reverseGeocode(Number(lat), Number(lng));
      city = location?.city ?? null;
      state = location?.state ?? null;
    }
    const gym = await prisma.gym.create({
      data: {
        ownerId: uid,
        name: name.trim(),
        address: address.trim(),
        latitude: Number(lat),
        longitude: Number(lng),
        city,
        state,
        hasAC: !!hasAC,
        amenities: normalizeAmenities(amenities),
        ownerConsentAt: ownerConsent ? new Date() : null,
        openTime: openTime ?? null,
        closeTime: closeTime ?? null,
        openDays: openDays ?? null,
        dayPassPrice: dayPassPrice != null ? Number(dayPassPrice) : null,
        monthlyPrice: Number(monthlyPrice),
        quarterlyPrice: quarterlyPrice != null ? Number(quarterlyPrice) : null,
        yearlyPrice: Number(yearlyPrice),
        partnerDiscountPercent: Number(partnerDiscountPercent ?? 10),
        quarterlyDiscountType: quarterlyDiscountType ?? "PERCENT",
        quarterlyDiscountValue: Number(quarterlyDiscountValue ?? 10),
        yearlyDiscountType: yearlyDiscountType ?? "PERCENT",
        yearlyDiscountValue: Number(yearlyDiscountValue ?? 15),
        welcomeDiscountType: welcomeDiscountType ?? "PERCENT",
        welcomeDiscountValue: Number(welcomeDiscountValue ?? 10),
        coverImageUrl: coverImageUrl?.trim() || null,
        instagramUrl: instagramUrl?.trim() || null,
        facebookUrl: facebookUrl?.trim() || null,
        youtubeUrl: youtubeUrl?.trim() || null,
      },
    });
    return NextResponse.json({ gym });
  } catch (error) {
    logServerError(error as Error, { route: "/api/owner/gym", userId: uid });
    return jsonError("Failed to create gym", 500);
  }
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const parsed = await safeJson<{
    gymId?: string;
    name?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    hasAC?: boolean;
    amenities?: string[] | string;
    ownerConsent?: boolean;
    openTime?: string | null;
    closeTime?: string | null;
    openDays?: string | null;
    dayPassPrice?: number | null;
    monthlyPrice?: number;
    quarterlyPrice?: number | null;
    yearlyPrice?: number;
    partnerDiscountPercent?: number;
    quarterlyDiscountType?: "PERCENT" | "FLAT";
    quarterlyDiscountValue?: number;
    yearlyDiscountType?: "PERCENT" | "FLAT";
    yearlyDiscountValue?: number;
    welcomeDiscountType?: "PERCENT" | "FLAT";
    welcomeDiscountValue?: number;
    coverImageUrl?: string | null;
    instagramUrl?: string | null;
    facebookUrl?: string | null;
    youtubeUrl?: string | null;
  }>(req);
  if (!parsed.ok) {
    return jsonError("Invalid JSON body", 400);
  }
  const { gymId, ...data } = parsed.data;
  if (!gymId) {
    return jsonError("gymId required", 400);
  }
  try {
    const existing = await prisma.gym.findFirst({
      where: { id: gymId, ownerId: uid },
    });
    if (!existing) {
      return jsonError("Gym not found", 404);
    }
    const update: Record<string, unknown> = {};
    if (data.name != null) update.name = data.name.trim();
    if (data.address != null) {
      update.address = data.address.trim();
      const geo = await forwardGeocode(data.address.trim());
      if (geo) {
        update.latitude = geo.latitude;
        update.longitude = geo.longitude;
        const location = await reverseGeocode(geo.latitude, geo.longitude);
        if (location?.city) update.city = location.city;
        if (location?.state) update.state = location.state;
      }
    }
    if (data.latitude != null) update.latitude = data.latitude;
    if (data.longitude != null) update.longitude = data.longitude;
    if (data.latitude != null && data.longitude != null) {
      const location = await reverseGeocode(data.latitude, data.longitude);
      if (location?.city) update.city = location.city;
      if (location?.state) update.state = location.state;
    }
    if (data.hasAC !== undefined) update.hasAC = !!data.hasAC;
    if (data.amenities !== undefined) update.amenities = normalizeAmenities(data.amenities);
    if (data.ownerConsent === true && !existing.ownerConsentAt) update.ownerConsentAt = new Date();
    if (data.openTime !== undefined) update.openTime = data.openTime;
    if (data.closeTime !== undefined) update.closeTime = data.closeTime;
    if (data.openDays !== undefined) update.openDays = data.openDays;
    if (data.dayPassPrice !== undefined) update.dayPassPrice = data.dayPassPrice;
    if (data.monthlyPrice != null) update.monthlyPrice = data.monthlyPrice;
    if (data.quarterlyPrice !== undefined) update.quarterlyPrice = data.quarterlyPrice;
    if (data.yearlyPrice != null) update.yearlyPrice = data.yearlyPrice;
    if (data.partnerDiscountPercent != null) update.partnerDiscountPercent = data.partnerDiscountPercent;
    if (data.quarterlyDiscountType != null) update.quarterlyDiscountType = data.quarterlyDiscountType;
    if (data.quarterlyDiscountValue != null) update.quarterlyDiscountValue = data.quarterlyDiscountValue;
    if (data.yearlyDiscountType != null) update.yearlyDiscountType = data.yearlyDiscountType;
    if (data.yearlyDiscountValue != null) update.yearlyDiscountValue = data.yearlyDiscountValue;
    if (data.welcomeDiscountType != null) update.welcomeDiscountType = data.welcomeDiscountType;
    if (data.welcomeDiscountValue != null) update.welcomeDiscountValue = data.welcomeDiscountValue;
    if (data.coverImageUrl !== undefined) update.coverImageUrl = data.coverImageUrl;
    if (data.instagramUrl !== undefined) update.instagramUrl = data.instagramUrl?.trim() || null;
    if (data.facebookUrl !== undefined) update.facebookUrl = data.facebookUrl?.trim() || null;
    if (data.youtubeUrl !== undefined) update.youtubeUrl = data.youtubeUrl?.trim() || null;
    const gym = await prisma.gym.update({
      where: { id: gymId },
      data: update,
    });
    return NextResponse.json({ gym });
  } catch (error) {
    logServerError(error as Error, { route: "/api/owner/gym", userId: uid });
    return jsonError("Failed to update gym", 500);
  }
}
