import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/permissions";
import { computeDiscount } from "@/lib/discounts";
import type { PlanType } from "@/lib/discounts";
import { jsonError, safeJson } from "@/lib/api";
import { logServerError } from "@/lib/logger";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!requireUser(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const emailVerified = !!(session!.user as { emailVerified?: boolean }).emailVerified;
  const role = (session!.user as { role?: string }).role;
  const isAdmin = role === "ADMIN";
  if (!emailVerified && !isAdmin) {
    return jsonError("Please verify your email to continue", 403);
  }
  const uid = (session!.user as { id: string }).id;
  try {
    const memberships = await prisma.membership.findMany({
      where: { userId: uid },
      include: { gym: true },
      orderBy: { startedAt: "desc" },
    });
    return NextResponse.json({ memberships });
  } catch (error) {
    logServerError(error as Error, { route: "/api/memberships", userId: uid });
    return jsonError("Failed to load memberships", 500);
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireUser(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const parsed = await safeJson<{
    gymId?: string;
    planType?: PlanType;
    discountCode?: string;
    inviteCode?: string;
  }>(req);
  if (!parsed.ok) {
    return jsonError("Invalid JSON body", 400);
  }
  const gymId = parsed.data.gymId?.trim();
  const planType = parsed.data.planType;
  const discountCode = parsed.data.discountCode?.trim();
  const inviteCode = parsed.data.inviteCode?.trim();
  if (!gymId || !planType || !["DAY_PASS", "MONTHLY", "QUARTERLY", "YEARLY"].includes(planType)) {
    return jsonError("Invalid gymId or planType", 400);
  }
  try {
    const gym = await prisma.gym.findUnique({ where: { id: gymId } });
    if (!gym) {
      return jsonError("Gym not found", 404);
    }
    let basePrice: number;
    if (planType === "DAY_PASS") {
      if (!gym.dayPassPrice || gym.dayPassPrice <= 0) {
        return jsonError("Day pass not available for this gym", 400);
      }
      basePrice = gym.dayPassPrice;
    } else if (planType === "MONTHLY") basePrice = gym.monthlyPrice;
    else if (planType === "QUARTERLY")
      basePrice = gym.quarterlyPrice ?? Math.round(gym.monthlyPrice * 3 * 0.9); // 10% off if not set
    else basePrice = gym.yearlyPrice;

    const existingActive = await prisma.membership.findFirst({
      where: { userId: uid, active: true },
    });
    if (existingActive) {
      return jsonError("You already have an active membership", 400);
    }
    const activeDuo = await prisma.duo.findFirst({
      where: {
        gymId,
        active: true,
        OR: [{ userOneId: uid }, { userTwoId: uid }],
      },
    });
    let hasActiveDuo = !!activeDuo;

    // Partner discount via invite code: join-together (invitee uses code) or inviter's invitee already joined
    let hasPartnerDiscountViaInvite = false;
    let inviteForDuo: { id: string; inviterId: string; invitedUserId: string | null } | null = null;
    if (inviteCode && gym.partnerDiscountPercent > 0) {
      const invite = await prisma.invite.findFirst({
        where: {
          gymId,
          code: inviteCode.toUpperCase(),
          accepted: false,
        },
      });
      if (invite) {
        if (invite.inviterId === uid) {
          // User is the inviter: partner discount if invitee has already joined
          if (invite.invitedUserId) {
            const inviteeMembership = await prisma.membership.findFirst({
              where: { userId: invite.invitedUserId, gymId, active: true },
            });
            if (inviteeMembership) {
              hasPartnerDiscountViaInvite = true;
              inviteForDuo = { id: invite.id, inviterId: invite.inviterId, invitedUserId: invite.invitedUserId };
            }
          }
        } else {
          // User is the invitee: partner discount (joining with partner)
          hasPartnerDiscountViaInvite = true;
          inviteForDuo = { id: invite.id, inviterId: invite.inviterId, invitedUserId: null };
        }
      }
    }
    if (hasPartnerDiscountViaInvite) hasActiveDuo = true;
    const hasEverHadMembership = await prisma.membership.findFirst({
      where: { userId: uid },
    });
    const isFirstTimeUser = !hasEverHadMembership;

    let promo: { type: "PERCENT" | "FLAT"; value: number } | null = null;
    if (discountCode) {
      const code = await prisma.discountCode.findFirst({
        where: {
          gymId,
          code: discountCode,
          validFrom: { lte: new Date() },
          validUntil: { gte: new Date() },
        },
      });
      if (code && code.usedCount < code.maxUses) {
        promo = { type: code.discountType as "PERCENT" | "FLAT", value: code.discountValue };
      }
    }

    const { finalPrice, breakdown } = computeDiscount(basePrice, planType, {
      isFirstTimeUser,
      hasActiveDuo,
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
    });
    const expiresAt = new Date();
    if (planType === "DAY_PASS") expiresAt.setDate(expiresAt.getDate() + 1);
    else if (planType === "MONTHLY") expiresAt.setMonth(expiresAt.getMonth() + 1);
    else if (planType === "QUARTERLY") expiresAt.setMonth(expiresAt.getMonth() + 3);
    else expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    const membership = await prisma.membership.create({
      data: {
        userId: uid,
        gymId,
        planType,
        basePrice,
        finalPrice,
        discountBreakdown: JSON.stringify(breakdown),
        active: false,
        expiresAt,
      },
      include: { gym: true },
    });

    // Post-creation: update invite (duo is created in Razorpay verify when both have active membership)
    if (inviteForDuo && !inviteForDuo.invitedUserId) {
      // User is invitee — mark them as joined (invitedUserId); duo created when invitee pays
      await prisma.invite.update({
        where: { id: inviteForDuo.id },
        data: { invitedUserId: uid },
      });
    }

    return NextResponse.json({
      membership,
      finalPricePaise: finalPrice,
      breakdown,
    });
  } catch (error) {
    logServerError(error as Error, { route: "/api/memberships", userId: uid });
    return jsonError("Failed to create membership", 500);
  }
}
