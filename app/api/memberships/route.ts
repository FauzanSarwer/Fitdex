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
  const { gymId, planType } = body as { gymId: string; planType: PlanType };
  if (!gymId || !planType || !["MONTHLY", "YEARLY"].includes(planType)) {
    return NextResponse.json(
      { error: "Invalid gymId or planType" },
      { status: 400 }
    );
  }
  const gym = await prisma.gym.findUnique({ where: { id: gymId } });
  if (!gym) {
    return NextResponse.json({ error: "Gym not found" }, { status: 404 });
  }
  const basePrice =
    planType === "MONTHLY" ? gym.monthlyPrice : gym.yearlyPrice;
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
  const hasActiveDuo = !!activeDuo;
  const hasEverHadMembership = await prisma.membership.findFirst({
    where: { userId: uid },
  });
  const isFirstTimeUser = !hasEverHadMembership;
  const { finalPrice, breakdown } = computeDiscount(basePrice, planType, {
    isFirstTimeUser,
    hasActiveDuo,
    gym: {
      monthlyPrice: gym.monthlyPrice,
      yearlyPrice: gym.yearlyPrice,
      partnerDiscountPercent: gym.partnerDiscountPercent,
      yearlyDiscountPercent: gym.yearlyDiscountPercent,
      welcomeDiscountPercent: gym.welcomeDiscountPercent,
      maxDiscountCapPercent: gym.maxDiscountCapPercent,
    },
  });
  const expiresAt = new Date();
  if (planType === "MONTHLY") expiresAt.setMonth(expiresAt.getMonth() + 1);
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
  return NextResponse.json({
    membership,
    finalPricePaise: finalPrice,
    breakdown,
  });
}
