import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api";
import { logServerError } from "@/lib/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ gymId: string }> }
) {
  try {
    const { gymId } = await params;
    const gym = await prisma.gym.findUnique({
      where: { id: gymId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            supportEmail: true,
            supportPhone: true,
            supportWhatsapp: true,
          },
        },
      },
    });
    if (!gym) {
      return NextResponse.json({ error: "Gym not found" }, { status: 404 });
    }
    if (gym.verificationStatus === "REJECTED" || gym.suspendedAt || !gym.ownerConsentAt) {
      return NextResponse.json({ error: "Gym not available" }, { status: 403 });
    }
    const monthly = gym.monthlyPrice;
    const quarterly =
      gym.quarterlyPrice ?? Math.round(gym.monthlyPrice * 3 * 0.9);
    const yearly = gym.yearlyPrice;
    const yearlySavePercent =
      monthly > 0
        ? Math.round(100 - (yearly / 12 / monthly) * 100)
        : 0;
    const quarterlySavePercent =
      monthly > 0
        ? Math.round(100 - (quarterly / 3 / monthly) * 100)
        : 0;
    return NextResponse.json(
      {
        gym: {
        id: gym.id,
        name: gym.name,
        address: gym.address,
        latitude: gym.latitude,
        longitude: gym.longitude,
        verificationStatus: gym.verificationStatus,
        coverImageUrl: gym.coverImageUrl,
        openTime: gym.openTime,
        closeTime: gym.closeTime,
        openDays: gym.openDays,
        dayPassPrice: gym.dayPassPrice,
        owner: gym.owner,
        monthlyPrice: monthly,
        quarterlyPrice: quarterly,
        yearlyPrice: yearly,
        partnerDiscountPercent: gym.partnerDiscountPercent,
        quarterlyDiscountType: gym.quarterlyDiscountType,
        quarterlyDiscountValue: gym.quarterlyDiscountValue,
        yearlyDiscountType: gym.yearlyDiscountType,
        yearlyDiscountValue: gym.yearlyDiscountValue,
        welcomeDiscountType: gym.welcomeDiscountType,
        welcomeDiscountValue: gym.welcomeDiscountValue,
        hasAC: gym.hasAC,
        amenities: gym.amenities,
        instagramUrl: gym.instagramUrl,
        facebookUrl: gym.facebookUrl,
        youtubeUrl: gym.youtubeUrl,
        featuredUntil: gym.featuredUntil,
        isFeatured: gym.isFeatured,
        featuredStartAt: gym.featuredStartAt,
        featuredEndAt: gym.featuredEndAt,
        verifiedUntil: gym.verifiedUntil,
        yearlySavePercent,
        quarterlySavePercent,
      },
      },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=120" } }
    );
  } catch (e) {
    logServerError(e as Error, { route: "/api/gyms/[gymId]" });
    return jsonError("Failed to fetch gym", 500);
  }
}
