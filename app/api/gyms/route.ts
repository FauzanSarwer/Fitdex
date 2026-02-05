import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const gyms = await prisma.gym.findMany({
      include: {
        owner: { select: { id: true, name: true } },
      },
    });
    let list = gyms.map((g) => ({
      id: g.id,
      name: g.name,
      address: g.address,
      latitude: g.latitude,
      longitude: g.longitude,
      monthlyPrice: g.monthlyPrice,
      yearlyPrice: g.yearlyPrice,
      partnerDiscountPercent: g.partnerDiscountPercent,
      yearlyDiscountPercent: g.yearlyDiscountPercent,
      welcomeDiscountPercent: g.welcomeDiscountPercent,
      maxDiscountCapPercent: g.maxDiscountCapPercent,
      ownerId: g.ownerId,
    }));
    if (lat && lng) {
      const numLat = parseFloat(lat);
      const numLng = parseFloat(lng);
      if (Number.isFinite(numLat) && Number.isFinite(numLng)) {
        list = list
          .map((g) => ({
            ...g,
            distance: haversine(numLat, numLng, g.latitude, g.longitude),
          }))
          .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
      }
    }
    return NextResponse.json({ gyms: list });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to fetch gyms" },
      { status: 500 }
    );
  }
}

/**
 * Join gym POST handler
 * Expects: { "gymId": string, "plan": "monthly" | "yearly", "partnerId"?: string, "discountCodes"?: string[] }
 * Returns: gym plan & joining details (to render structured joining page like the "district" app)
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    const uid = (session.user as { id: string }).id;
    const body = await req.json();

    const { gymId, plan, partnerId, discountCodes } = body as {
      gymId: string;
      plan?: "monthly" | "yearly";
      partnerId?: string;
      discountCodes?: string[];
    };

    if (!gymId) {
      return NextResponse.json({ error: "Missing gymId" }, { status: 400 });
    }

    // Fetch gym details
    const gym = await prisma.gym.findUnique({
      where: { id: gymId },
      include: {
        owner: { select: { id: true, name: true } }
      }
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
        yearlyDiscountPercent: gym.yearlyDiscountPercent,
      },
    ];

    // Assume you apply welcome/partner/discount coupons/logic here
    let selectedPlan = plan ?? "monthly";
    let appliedDiscounts: { type: string; value: number; label: string }[] = [];

    let planData = plans.find(p => p.type === selectedPlan && p.available);

    if (!planData) {
      // fallback to any available plan
      planData = plans.find(p => p.available);
      selectedPlan = (planData?.type as typeof selectedPlan) ?? "monthly";
    }

    let finalPrice = planData ? planData.price : 0;

    // Apply discounts
    // Welcome Discount
    if (
      typeof gym.welcomeDiscountPercent === "number" &&
      gym.welcomeDiscountPercent > 0
    ) {
      const discountValue = (finalPrice * gym.welcomeDiscountPercent) / 100;
      appliedDiscounts.push({
        type: "welcome",
        value: discountValue,
        label: `Welcome Discount (${gym.welcomeDiscountPercent}%)`
      });
      finalPrice -= discountValue;
    }

    // Yearly Discount (if yearly plan)
    if (
      selectedPlan === "yearly" &&
      typeof gym.yearlyDiscountPercent === "number" &&
      gym.yearlyDiscountPercent > 0
    ) {
      const discountValue = (finalPrice * gym.yearlyDiscountPercent) / 100;
      appliedDiscounts.push({
        type: "yearly",
        value: discountValue,
        label: `Yearly Plan Discount (${gym.yearlyDiscountPercent}%)`
      });
      finalPrice -= discountValue;
    }

    // Partner Discount
    if (partnerId && typeof gym.partnerDiscountPercent === "number" && gym.partnerDiscountPercent > 0) {
      const discountValue = (finalPrice * gym.partnerDiscountPercent) / 100;
      appliedDiscounts.push({
        type: "partner",
        value: discountValue,
        label: `Partner Discount (${gym.partnerDiscountPercent}%)`
      });
      finalPrice -= discountValue;
    }

    // Discount codes (stub: logic to validate & apply can be added)
    if (discountCodes && Array.isArray(discountCodes)) {
      // For now, just mock a 5% total discount if any codes are passed
      if (discountCodes.length > 0) {
        const codeDiscount = (finalPrice * 5) / 100;
        appliedDiscounts.push({
          type: "promo",
          value: codeDiscount,
          label: "Promo Code (5%)",
        });
        finalPrice -= codeDiscount;
      }
    }

    // Max total discount cap
    if (
      typeof gym.maxDiscountCapPercent === "number" &&
      gym.maxDiscountCapPercent > 0
    ) {
      const maxDiscount = (planData!.originalPrice * gym.maxDiscountCapPercent) / 100;
      const totalDiscount = planData!.originalPrice - finalPrice;
      if (totalDiscount > maxDiscount) {
        finalPrice = planData!.originalPrice - maxDiscount;
      }
    }

    if (finalPrice < 0) finalPrice = 0;

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
          yearlyDiscountPercent: p.yearlyDiscountPercent ?? undefined
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
    console.error(e);
    return NextResponse.json(
      { error: "Failed to join gym" },
      { status: 500 }
    );
  }
}