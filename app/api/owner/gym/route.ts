import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { resolveAddressToCoordinates, reverseGeocode } from "@/lib/location";
import { requireOwner } from "@/lib/permissions";
import { jsonError, safeJson } from "@/lib/api";
import { logObservabilityEvent, logServerError } from "@/lib/logger";
import { normalizeAmenities } from "@/lib/gym-utils";
import { randomUUID } from "crypto";

function inferCityStateFromAddress(rawAddress: string): { city: string | null; state: string | null } {
  const parts = rawAddress
    .split(",")
    .map((part) => part.trim().replace(/\b\d{4,6}\b/g, "").trim())
    .filter(Boolean);
  if (parts.length === 0) return { city: null, state: null };
  if (parts.length === 1) return { city: parts[0], state: null };
  return {
    city: parts[parts.length - 2] ?? null,
    state: parts[parts.length - 1] ?? null,
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error ?? "");
}

function isUnknownCoordinateArgError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("unknown argument `latitude`") ||
    message.includes("unknown argument `longitude`") ||
    message.includes("unknown arg `latitude`") ||
    message.includes("unknown arg `longitude`")
  );
}

function isCoordinateConstraintError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  const mentionsCoordinates = message.includes("latitude") || message.includes("longitude");
  const isRequiredConstraint =
    message.includes("not-null") ||
    message.includes("null value") ||
    message.includes("cannot be null") ||
    message.includes("required");
  return mentionsCoordinates && isRequiredConstraint;
}

type LegacyGymInsertArgs = {
  ownerId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  monthlyPrice: number;
  quarterlyPrice: number | null;
  yearlyPrice: number;
  partnerDiscountPercent: number;
  coverImageUrl: string | null;
};

async function createGymWithLegacyCoordinates(args: LegacyGymInsertArgs) {
  const id = randomUUID();
  const now = new Date();
  await prisma.$executeRaw`
    INSERT INTO "Gym" (
      "id",
      "name",
      "address",
      "latitude",
      "longitude",
      "ownerId",
      "monthlyPrice",
      "quarterlyPrice",
      "yearlyPrice",
      "partnerDiscountPercent",
      "coverImageUrl",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${id},
      ${args.name},
      ${args.address},
      ${args.latitude},
      ${args.longitude},
      ${args.ownerId},
      ${args.monthlyPrice},
      ${args.quarterlyPrice},
      ${args.yearlyPrice},
      ${args.partnerDiscountPercent},
      ${args.coverImageUrl},
      ${now},
      ${now}
    )
  `;
  return prisma.gym.findUnique({ where: { id } });
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const { searchParams } = new URL(req.url);
  const compact = searchParams.get("compact") === "1";
  try {
    const query: Prisma.GymFindManyArgs = compact
      ? {
          where: { ownerId: uid },
          select: {
            id: true,
            name: true,
            verificationStatus: true,
            gstNumber: true,
            gstCertificateUrl: true,
            invoiceTypeDefault: true,
            partnerDiscountPercent: true,
            quarterlyDiscountType: true,
            quarterlyDiscountValue: true,
            yearlyDiscountType: true,
            yearlyDiscountValue: true,
            welcomeDiscountType: true,
            welcomeDiscountValue: true,
          },
        }
      : {
          where: { ownerId: uid },
          include: {
            _count: {
              select: { memberships: true, duos: true },
            },
          },
        };
    const gyms = await prisma.gym.findMany(query);
    return NextResponse.json(
      { gyms },
      { headers: { "Cache-Control": "private, max-age=20, stale-while-revalidate=40" } }
    );
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
    invoiceTypeDefault?: "GST" | "NON_GST" | null;
    quarterlyDiscountType?: "PERCENT" | "FLAT";
    quarterlyDiscountValue?: number;
    yearlyDiscountType?: "PERCENT" | "FLAT";
    yearlyDiscountValue?: number;
    welcomeDiscountType?: "PERCENT" | "FLAT";
    welcomeDiscountValue?: number;
    coverImageUrl?: string | null;
    imageUrls?: string[] | string | null;
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
    invoiceTypeDefault,
    quarterlyDiscountType,
    quarterlyDiscountValue,
    yearlyDiscountType,
    yearlyDiscountValue,
    welcomeDiscountType,
    welcomeDiscountValue,
    coverImageUrl,
    imageUrls,
    instagramUrl,
    facebookUrl,
    youtubeUrl,
  } = parsed.data;
  const normalizedImages = Array.isArray(imageUrls)
    ? imageUrls.map((url) => url?.trim()).filter(Boolean)
    : typeof imageUrls === "string"
      ? imageUrls.split(",").map((url) => url.trim()).filter(Boolean)
      : coverImageUrl
        ? [coverImageUrl.trim()]
        : [];
  const imageList = normalizedImages.slice(0, 4);
  if (!name || !address || monthlyPrice == null || yearlyPrice == null || imageList.length === 0) {
    return jsonError(
      "name, address, imageUrls, monthlyPrice, yearlyPrice required",
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
    let geocodeProvider: string | null = null;

    if (lat == null || lng == null) {
      const resolved = await resolveAddressToCoordinates(address.trim());
      if (resolved) {
        lat = resolved.latitude;
        lng = resolved.longitude;
        geocodeProvider = resolved.provider;
      } else {
        logObservabilityEvent({
          event: "owner.gym.geocode.unresolved",
          level: "warn",
          context: {
            userId: uid,
            address: address.trim().slice(0, 160),
            reason: "all_providers_failed",
          },
        });
      }
    }
    if (lat != null && lng != null) {
      const location = await reverseGeocode(Number(lat), Number(lng));
      city = location?.city ?? null;
      state = location?.state ?? null;
    }
    if (!city || !state) {
      const inferred = inferCityStateFromAddress(address.trim());
      city = city ?? inferred.city;
      state = state ?? inferred.state;
    }
    const baseCreateData: Prisma.GymCreateInput = {
      owner: { connect: { id: uid } },
      name: name.trim(),
      address: address.trim(),
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
      invoiceTypeDefault: invoiceTypeDefault ?? null,
      quarterlyDiscountType: quarterlyDiscountType ?? "PERCENT",
      quarterlyDiscountValue: Number(quarterlyDiscountValue ?? 10),
      yearlyDiscountType: yearlyDiscountType ?? "PERCENT",
      yearlyDiscountValue: Number(yearlyDiscountValue ?? 15),
      welcomeDiscountType: welcomeDiscountType ?? "PERCENT",
      welcomeDiscountValue: Number(welcomeDiscountValue ?? 10),
      coverImageUrl: imageList[0] ?? null,
      imageUrls: imageList,
      instagramUrl: instagramUrl?.trim() || null,
      facebookUrl: facebookUrl?.trim() || null,
      youtubeUrl: youtubeUrl?.trim() || null,
    };

    let gym = null as Awaited<ReturnType<typeof prisma.gym.create>> | null;
    let coordinateArgsUnsupported = false;

    if (lat != null && lng != null) {
      try {
        gym = await prisma.gym.create({
          data: {
            ...baseCreateData,
            latitude: Number(lat),
            longitude: Number(lng),
          } as Prisma.GymCreateInput,
        });
      } catch (error) {
        if (isUnknownCoordinateArgError(error)) {
          coordinateArgsUnsupported = true;
        } else {
          throw error;
        }
      }
    }

    if (!gym) {
      try {
        gym = await prisma.gym.create({ data: baseCreateData });
      } catch (error) {
        if (isCoordinateConstraintError(error)) {
          if (lat == null || lng == null) {
            return jsonError(
              "Could not resolve gym coordinates from address. Please use 'Resolve coordinates' and retry.",
              422
            );
          }
          if (coordinateArgsUnsupported) {
            const legacyGym = await createGymWithLegacyCoordinates({
              ownerId: uid,
              name: name.trim(),
              address: address.trim(),
              latitude: Number(lat),
              longitude: Number(lng),
              monthlyPrice: Number(monthlyPrice),
              quarterlyPrice: quarterlyPrice != null ? Number(quarterlyPrice) : null,
              yearlyPrice: Number(yearlyPrice),
              partnerDiscountPercent: Number(partnerDiscountPercent ?? 10),
              coverImageUrl: imageList[0] ?? null,
            });
            if (legacyGym) {
              gym = legacyGym;
            }
          }
        }

        if (!gym) {
          throw error;
        }
      }
    }

    return NextResponse.json({
      gym,
      geocoding: {
        resolved: lat != null && lng != null,
        latitude: lat != null ? Number(lat) : null,
        longitude: lng != null ? Number(lng) : null,
        provider: geocodeProvider,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientInitializationError) {
      return jsonError("Database unavailable. Please try again in a moment.", 503);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") {
      return jsonError("Database schema mismatch detected. Please apply latest migrations.", 500);
    }
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
    invoiceTypeDefault?: "GST" | "NON_GST" | null;
    quarterlyDiscountType?: "PERCENT" | "FLAT";
    quarterlyDiscountValue?: number;
    yearlyDiscountType?: "PERCENT" | "FLAT";
    yearlyDiscountValue?: number;
    welcomeDiscountType?: "PERCENT" | "FLAT";
    welcomeDiscountValue?: number;
    coverImageUrl?: string | null;
    imageUrls?: string[] | string | null;
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
      const geo = await resolveAddressToCoordinates(data.address.trim());
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
    if (data.invoiceTypeDefault !== undefined) update.invoiceTypeDefault = data.invoiceTypeDefault;
    if (data.quarterlyDiscountType != null) update.quarterlyDiscountType = data.quarterlyDiscountType;
    if (data.quarterlyDiscountValue != null) update.quarterlyDiscountValue = data.quarterlyDiscountValue;
    if (data.yearlyDiscountType != null) update.yearlyDiscountType = data.yearlyDiscountType;
    if (data.yearlyDiscountValue != null) update.yearlyDiscountValue = data.yearlyDiscountValue;
    if (data.welcomeDiscountType != null) update.welcomeDiscountType = data.welcomeDiscountType;
    if (data.welcomeDiscountValue != null) update.welcomeDiscountValue = data.welcomeDiscountValue;
    if (data.imageUrls !== undefined) {
      const normalizedImages = Array.isArray(data.imageUrls)
        ? data.imageUrls.map((url) => url?.trim()).filter(Boolean)
        : typeof data.imageUrls === "string"
          ? data.imageUrls.split(",").map((url) => url.trim()).filter(Boolean)
          : [];
      const imageList = normalizedImages.slice(0, 4);
      if (imageList.length === 0) {
        return jsonError("At least one image is required", 400);
      }
      update.imageUrls = imageList;
      update.coverImageUrl = imageList[0] ?? null;
    } else if (data.coverImageUrl !== undefined) {
      update.coverImageUrl = data.coverImageUrl;
    }
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
