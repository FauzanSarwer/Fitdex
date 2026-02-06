import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/permissions";
import { computeDiscount } from "@/lib/discounts";
import type { PlanType } from "@/lib/discounts";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!requireUser(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const memberships = await prisma.membership.findMany({
    where: { userId: uid },
    include: { gym: true },
    orderBy: { startedAt: "desc" },
  });
  return NextResponse.json({ memberships });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireUser(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const body = await req.json();
  const { gymId, planType, discountCode, inviteCode } = body as {
    gymId: string;
    planType: PlanType;
    discountCode?: string;
    inviteCode?: string; // partner invite code (for join-together or invite-after-join)
  };
  if (!gymId || !planType || !["MONTHLY", "QUARTERLY", "YEARLY"].includes(planType)) {
    return NextResponse.json(
      { error: "Invalid gymId or planType" },
      { status: 400 }
    );
  }
  const gym = await prisma.gym.findUnique({ where: { id: gymId } });
  if (!gym) {
    return NextResponse.json({ error: "Gym not found" }, { status: 404 });
  }
  let basePrice: number;
  if (planType === "MONTHLY") basePrice = gym.monthlyPrice;
  else if (planType === "QUARTERLY")
    basePrice = gym.quarterlyPrice ?? Math.round(gym.monthlyPrice * 3 * 0.9); // 10% off if not set
  else basePrice = gym.yearlyPrice;

  const existingActive = await prisma.membership.findFirst({
    where: { userId: uid, active: true },
  });
  if (existingActive) {
    return NextResponse.json(
      { error: "You already have an active membership" },
      { status: 400 }
    );
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
  if (inviteCode && inviteCode.trim() && gym.partnerDiscountPercent > 0) {
    const invite = await prisma.invite.findFirst({
      where: {
        gymId,
        code: inviteCode.trim().toUpperCase(),
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

  let promoPercent = 0;
  if (discountCode && discountCode.trim()) {
    const code = await prisma.discountCode.findFirst({
      where: {
        gymId,
        code: discountCode.trim(),
        validFrom: { lte: new Date() },
        validUntil: { gte: new Date() },
      },
    });
    if (code && code.usedCount < code.maxUses) {
      promoPercent = code.discountPercent;
    }
  }

  const { finalPrice, breakdown } = computeDiscount(basePrice, planType, {
    isFirstTimeUser,
    hasActiveDuo,
    promoPercent,
    gym: {
      monthlyPrice: gym.monthlyPrice,
      quarterlyPrice: gym.quarterlyPrice ?? undefined,
      yearlyPrice: gym.yearlyPrice,
      partnerDiscountPercent: gym.partnerDiscountPercent,
      quarterlyDiscountPercent: gym.quarterlyDiscountPercent,
      yearlyDiscountPercent: gym.yearlyDiscountPercent,
      welcomeDiscountPercent: gym.welcomeDiscountPercent,
      maxDiscountCapPercent: gym.maxDiscountCapPercent,
    },
  });
  const expiresAt = new Date();
  if (planType === "MONTHLY") expiresAt.setMonth(expiresAt.getMonth() + 1);
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
}
