import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/permissions";
import { jsonError } from "@/lib/api";
import { logServerError } from "@/lib/logger";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  try {
    const gyms = await prisma.gym.findMany({
      where: { verificationStatus: { not: "REJECTED" } },
      select: {
        id: true,
        name: true,
        address: true,
        coverImageUrl: true,
        instagramUrl: true,
        facebookUrl: true,
        youtubeUrl: true,
        ownerId: true,
        verificationStatus: true,
        featuredUntil: true,
        verifiedUntil: true,
        openTime: true,
        closeTime: true,
        openDays: true,
        dayPassPrice: true,
        monthlyPrice: true,
        quarterlyPrice: true,
        yearlyPrice: true,
        partnerDiscountPercent: true,
        quarterlyDiscountType: true,
        quarterlyDiscountValue: true,
        yearlyDiscountType: true,
        yearlyDiscountValue: true,
        welcomeDiscountType: true,
        welcomeDiscountValue: true,
        owner: { select: { id: true, name: true } },
        _count: { select: { memberships: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const activeSubscription = await prisma.ownerSubscription.findFirst({
      where: { ownerId: uid, status: "ACTIVE", expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: "desc" },
    });
    const hasOwnerSubscription = !!activeSubscription;

    const viewCounts = await prisma.gymPageView.groupBy({
      by: ["gymId"],
      _count: { _all: true },
    });
    const viewMap = new Map(viewCounts.map((view) => [view.gymId, view._count._all]));

    const now = Date.now();
    const list = gyms.map((g) => {
      const isOwner = g.ownerId === uid;
      const hasPremiumAccess =
        hasOwnerSubscription ||
        (g.featuredUntil && new Date(g.featuredUntil).getTime() > now) ||
        (g.verifiedUntil && new Date(g.verifiedUntil).getTime() > now);

      return {
        id: g.id,
        name: g.name,
        address: g.address,
        coverImageUrl: g.coverImageUrl,
        instagramUrl: g.instagramUrl,
        facebookUrl: g.facebookUrl,
        youtubeUrl: g.youtubeUrl,
        ownerId: g.ownerId,
        ownerName: g.owner?.name,
        verificationStatus: g.verificationStatus,
        featuredUntil: g.featuredUntil,
        verifiedUntil: g.verifiedUntil,
        openTime: g.openTime,
        closeTime: g.closeTime,
        openDays: g.openDays,
        dayPassPrice: g.dayPassPrice,
        monthlyPrice: g.monthlyPrice,
        quarterlyPrice: g.quarterlyPrice,
        yearlyPrice: g.yearlyPrice,
        partnerDiscountPercent: g.partnerDiscountPercent,
        quarterlyDiscountType: g.quarterlyDiscountType,
        quarterlyDiscountValue: g.quarterlyDiscountValue,
        yearlyDiscountType: g.yearlyDiscountType,
        yearlyDiscountValue: g.yearlyDiscountValue,
        welcomeDiscountType: g.welcomeDiscountType,
        welcomeDiscountValue: g.welcomeDiscountValue,
        isOwner,
        hasPremiumAccess,
        stats: isOwner && hasPremiumAccess
          ? {
              membersJoined: g._count.memberships,
              pageViews: viewMap.get(g.id) ?? 0,
            }
          : null,
      };
    });

    return NextResponse.json(
      { gyms: list },
      { headers: { "Cache-Control": "private, max-age=20, stale-while-revalidate=40" } }
    );
  } catch (error) {
    logServerError(error as Error, { route: "/api/owner/explore", userId: uid });
    return jsonError("Failed to load explore data", 500);
  }
}
