import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { jsonError, safeJson } from "@/lib/api";
import { computeDiscount, type PlanType } from "@/lib/discounts";
import { logServerError } from "@/lib/logger";
import { getGymTierRank, isGymFeatured } from "@/lib/gym-utils";
import { cityLabel, normalizeCityName } from "@/lib/seo/cities";

type GymListItem = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  verificationStatus: string;
  coverImageUrl: string | null;
  imageUrls: string[] | null;
  openTime: string | null;
  closeTime: string | null;
  openDays: string | null;
  dayPassPrice: number | null;
  monthlyPrice: number;
  yearlyPrice: number;
  partnerDiscountPercent: number;
  yearlyDiscountType: string;
  yearlyDiscountValue: number;
  quarterlyDiscountType: string;
  quarterlyDiscountValue: number;
  welcomeDiscountType: string;
  welcomeDiscountValue: number;
  ownerId: string;
  featuredUntil: Date | null;
  isFeatured: boolean;
  featuredStartAt: Date | null;
  featuredEndAt: Date | null;
  verifiedUntil: Date | null;
  gymTier: string;
  hasAC: boolean;
  amenities: string[];
  createdAt: Date;
  distance?: number;
  __tierRank: number;
  __isFeatured: boolean;
};

const CITY_EQUIVALENT_SLUGS: Record<string, string[]> = {
  delhi: ["delhi", "new-delhi"],
  "new-delhi": ["delhi", "new-delhi"],
  gurugram: ["gurugram", "gurgaon"],
  gurgaon: ["gurugram", "gurgaon"],
  bangalore: ["bangalore", "bengaluru"],
  bengaluru: ["bangalore", "bengaluru"],
};

function resolveCityFilterNames(rawCity: string | null): string[] {
  const slug = normalizeCityName(rawCity ?? "");
  if (!slug) return [];
  const slugs = CITY_EQUIVALENT_SLUGS[slug] ?? [slug];
  const labels = slugs.map((value) => cityLabel(value));
  return Array.from(new Set(labels));
}

function buildCityFilter(rawCity: string | null) {
  const cityNames = resolveCityFilterNames(rawCity);
  if (cityNames.length === 0) return {};
  return {
    OR: cityNames.flatMap((name) => [
      {
        city: {
          equals: name,
          mode: "insensitive" as const,
        },
      },
      {
        city: {
          contains: name,
          mode: "insensitive" as const,
        },
      },
      {
        address: {
          contains: name,
          mode: "insensitive" as const,
        },
      },
    ]),
  };
}

function haversine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const dynamic = 'force-dynamic';

const DISCOUNT_PLAN_TYPE_BY_REQUEST_PLAN: Record<"day_pass" | "monthly" | "yearly", PlanType> = {
  day_pass: "DAY_PASS",
  monthly: "MONTHLY",
  yearly: "YEARLY",
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const cityFilter = buildCityFilter(searchParams.get("city"));
    const gyms = await prisma.gym.findMany({
      where: {
        verificationStatus: { not: "REJECTED" },
        suspendedAt: null,
        ...cityFilter,
      },
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
        verificationStatus: true,
        coverImageUrl: true,
        imageUrls: true,
        openTime: true,
        closeTime: true,
        openDays: true,
        dayPassPrice: true,
        monthlyPrice: true,
        yearlyPrice: true,
        partnerDiscountPercent: true,
        yearlyDiscountType: true,
        yearlyDiscountValue: true,
        quarterlyDiscountType: true,
        quarterlyDiscountValue: true,
        welcomeDiscountType: true,
        welcomeDiscountValue: true,
        ownerId: true,
        featuredUntil: true,
        isFeatured: true,
        featuredStartAt: true,
        featuredEndAt: true,
        verifiedUntil: true,
        gymTier: true,
        hasAC: true,
        amenities: true,
        createdAt: true,
      },
    });

    let list: GymListItem[] = gyms.map((g) => ({
      id: g.id,
      name: g.name,
      address: g.address,
      latitude: g.latitude,
      longitude: g.longitude,
      verificationStatus: g.verificationStatus,
      coverImageUrl: g.coverImageUrl,
      imageUrls: g.imageUrls,
      openTime: g.openTime,
      closeTime: g.closeTime,
      openDays: g.openDays,
      dayPassPrice: g.dayPassPrice,
      monthlyPrice: g.monthlyPrice,
      yearlyPrice: g.yearlyPrice,
      partnerDiscountPercent: g.partnerDiscountPercent,
      yearlyDiscountType: g.yearlyDiscountType,
      yearlyDiscountValue: g.yearlyDiscountValue,
      quarterlyDiscountType: g.quarterlyDiscountType,
      quarterlyDiscountValue: g.quarterlyDiscountValue,
      welcomeDiscountType: g.welcomeDiscountType,
      welcomeDiscountValue: g.welcomeDiscountValue,
      ownerId: g.ownerId,
      featuredUntil: g.featuredUntil,
      isFeatured: g.isFeatured,
      featuredStartAt: g.featuredStartAt,
      featuredEndAt: g.featuredEndAt,
      verifiedUntil: g.verifiedUntil,
      gymTier: g.gymTier,
      hasAC: g.hasAC,
      amenities: g.amenities,
      createdAt: g.createdAt,
      __tierRank: getGymTierRank(g.gymTier),
      __isFeatured: isGymFeatured(g),
    }));

    const sortByTierAndDistance = (a: GymListItem, b: GymListItem) =>
      a.__tierRank - b.__tierRank ||
      (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY) ||
      Number(b.__isFeatured) - Number(a.__isFeatured) ||
      (a.monthlyPrice ?? 0) - (b.monthlyPrice ?? 0);

    const sortByTierAndPrice = (a: GymListItem, b: GymListItem) =>
      a.__tierRank - b.__tierRank ||
      Number(b.__isFeatured) - Number(a.__isFeatured) ||
      (a.monthlyPrice ?? 0) - (b.monthlyPrice ?? 0);

    if (lat && lng) {
      const numLat = parseFloat(lat);
      const numLng = parseFloat(lng);
      if (Number.isFinite(numLat) && Number.isFinite(numLng)) {
        list = list
          .map((g) => ({
            ...g,
            distance: haversine(numLat, numLng, g.latitude, g.longitude),
          }))
          .sort(sortByTierAndDistance);
      }
    } else {
      list = list.sort(sortByTierAndPrice);
    }

    const MIN_RESULTS_WITHOUT_EDGE = 10;
    const nonEdge = list.filter((g) => g.__tierRank < 2);
    if (nonEdge.length >= MIN_RESULTS_WITHOUT_EDGE) {
      list = list.filter((g) => g.__tierRank < 2);
    }

    const responseList = list.map(({ __tierRank: _tierRank, __isFeatured: _isFeatured, ...gym }) => gym);

    return NextResponse.json(
      { gyms: responseList },
      { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } }
    );
  } catch (e) {
    logServerError(e as Error, { route: "/api/gyms" });
    return jsonError("Failed to fetch gyms", 500);
  }
}

/**
 * Join gym POST handler
 * Expects: { "gymId": string, "plan": "monthly" | "yearly", "partnerId"?: string, "discountCodes"?: string[] }
 * Returns: gym plan & joining details (to render structured joining page like the "district" app)
 */
export async function POST(req: Request) {
  let uid: string | undefined;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    uid = (session.user as { id: string }).id;
    const parsed = await safeJson<{
      gymId?: string;
      plan?: "day_pass" | "monthly" | "yearly";
      partnerId?: string;
      discountCodes?: string[];
    }>(req);
    if (!parsed.ok) {
      return jsonError("Invalid JSON body", 400);
    }
    const { plan, partnerId, discountCodes } = parsed.data;
    const gymId = parsed.data.gymId?.trim();
    if (!gymId) {
      return jsonError("Missing gymId", 400);
    }

    // Fetch gym details
    const gym = await prisma.gym.findUnique({
      where: { id: gymId },
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
        dayPassPrice: true,
        monthlyPrice: true,
        yearlyPrice: true,
        quarterlyPrice: true,
        partnerDiscountPercent: true,
        quarterlyDiscountType: true,
        quarterlyDiscountValue: true,
        yearlyDiscountType: true,
        yearlyDiscountValue: true,
        welcomeDiscountType: true,
        welcomeDiscountValue: true,
        owner: { select: { id: true, name: true } },
      },
    });

    if (!gym) {
      return NextResponse.json(
        { error: "Gym not found" },
        { status: 404 }
      );
    }

    // Prepare available plans
    const plans = [
      {
        type: "day_pass",
        price: gym.dayPassPrice ?? 0,
        originalPrice: gym.dayPassPrice ?? 0,
        available: typeof gym.dayPassPrice === "number" && gym.dayPassPrice > 0,
      },
      {
        type: "monthly",
        price: gym.monthlyPrice,
        originalPrice: gym.monthlyPrice,
        available: typeof gym.monthlyPrice === "number" && gym.monthlyPrice > 0,
      },
      {
        type: "yearly",
        price: gym.yearlyPrice,
        originalPrice: gym.yearlyPrice,
        available: typeof gym.yearlyPrice === "number" && gym.yearlyPrice > 0,
      },
    ];

    // Compute pricing/discounts
    let selectedPlan = plan ?? "monthly";
    let appliedDiscounts: { type: string; value: number; label: string }[] = [];

    let planData = plans.find(p => p.type === selectedPlan && p.available);

    if (!planData) {
      // fallback to any available plan
      planData = plans.find(p => p.available);
      selectedPlan = (planData?.type as typeof selectedPlan) ?? "monthly";
    }

    let finalPrice = planData ? planData.price : 0;
    const hasEverHadMembership = await prisma.membership.findFirst({
      where: { userId: uid },
    });
    const isFirstTimeUser = !hasEverHadMembership;

    let promo: { type: "PERCENT" | "FLAT"; value: number } | null = null;
    if (discountCodes && Array.isArray(discountCodes) && discountCodes.length > 0) {
      const code = await prisma.discountCode.findFirst({
        where: {
          gymId,
          code: discountCodes[0],
          validFrom: { lte: new Date() },
          validUntil: { gte: new Date() },
        },
      });
      if (code && code.usedCount < code.maxUses) {
        promo = { type: code.discountType as "PERCENT" | "FLAT", value: code.discountValue };
      }
    }

    const discountResult = computeDiscount(
      planData?.originalPrice ?? 0,
      DISCOUNT_PLAN_TYPE_BY_REQUEST_PLAN[selectedPlan],
      {
        isFirstTimeUser,
        hasActiveDuo: !!partnerId,
        promo,
        gym: {
          monthlyPrice: gym.monthlyPrice,
        quarterlyPrice: gym.quarterlyPrice ?? undefined,
        yearlyPrice: gym.yearlyPrice,
        partnerDiscountPercent: gym.partnerDiscountPercent,
        quarterlyDiscountType: gym.quarterlyDiscountType as "PERCENT" | "FLAT",
        quarterlyDiscountValue: gym.quarterlyDiscountValue,
        yearlyDiscountType: gym.yearlyDiscountType as "PERCENT" | "FLAT",
        yearlyDiscountValue: gym.yearlyDiscountValue,
        welcomeDiscountType: gym.welcomeDiscountType as "PERCENT" | "FLAT",
        welcomeDiscountValue: gym.welcomeDiscountValue,
      },
      }
    );

    finalPrice = discountResult.finalPrice;
    const b = discountResult.breakdown;
    if (b.welcomeAmount > 0) appliedDiscounts.push({ type: "welcome", value: b.welcomeAmount, label: "Welcome discount" });
    if (b.quarterlyAmount > 0) appliedDiscounts.push({ type: "quarterly", value: b.quarterlyAmount, label: "Quarterly discount" });
    if (b.yearlyAmount > 0) appliedDiscounts.push({ type: "yearly", value: b.yearlyAmount, label: "Yearly discount" });
    if (b.partnerAmount > 0) appliedDiscounts.push({ type: "partner", value: b.partnerAmount, label: "Partner discount" });
    if (b.promoAmount > 0) appliedDiscounts.push({ type: "promo", value: b.promoAmount, label: "Promo code" });

    // Respond with structured data the UI can render (like the "district" app join flow)
    return NextResponse.json({
      gym: {
        id: gym.id,
        name: gym.name,
        address: gym.address,
        latitude: gym.latitude,
        longitude: gym.longitude,
        owner: gym.owner,
      },
      plans: plans
        .filter(p => p.available)
        .map(p => ({
          type: p.type,
          price: p.price,
          originalPrice: p.originalPrice,
        })),
      selectedPlan,
      partnerId: partnerId || null,
      discounts: appliedDiscounts,
      finalPrice,
      canAddPartner: typeof gym.partnerDiscountPercent === "number" && gym.partnerDiscountPercent > 0,
      canEnterDiscountCode: true,
      // Optionally, send redirectUrl if you want to force redirect to a step-by-step UI
      // redirectUrl: `/gyms/${gym.id}/join?plan=${selectedPlan}` 
    });
  } catch (e) {
    logServerError(e as Error, { route: "/api/gyms", userId: uid });
    return jsonError("Failed to fetch gym", 500);
  }
}
