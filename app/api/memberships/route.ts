import { NextResponse } from "next/server";
import { createMembershipSchema } from "@/lib/validation/membership";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/permissions";
import { computeDiscount } from "@/lib/discounts";
import { jsonError } from "@/lib/api";
import { logServerError } from "@/lib/logger";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!requireUser(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const uid = (session!.user as { id: string }).id;

  try {
    const memberships = await prisma.membership.findMany({
      where: { userId: uid },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        gymId: true,
        active: true,
        planType: true,
        basePrice: true,
        finalPrice: true,
        startedAt: true,
        expiresAt: true,
        gym: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
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

  // ✅ Safe JSON parse
  const raw = await req.json().catch(() => null);

  if (!raw) {
    return jsonError("Invalid JSON body", 400);
  }

  // ✅ Zod validation
  const parsed = createMembershipSchema.safeParse(raw);

  if (!parsed.success) {
    return jsonError(parsed.error.message, 400);
  }

  const { gymId, planType, discountCode, inviteCode } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const gym = await tx.gym.findUnique({ where: { id: gymId } });

      if (!gym) throw new Error("GYM_NOT_FOUND");

      let basePrice: number;

      if (planType === "DAY_PASS") {
        if (!gym.dayPassPrice || gym.dayPassPrice <= 0) {
          throw new Error("DAY_PASS_NOT_AVAILABLE");
        }
        basePrice = gym.dayPassPrice;
      } else if (planType === "MONTHLY") basePrice = gym.monthlyPrice;
      else if (planType === "QUARTERLY")
        basePrice =
          gym.quarterlyPrice ??
          Math.round(gym.monthlyPrice * 3 * 0.9);
      else basePrice = gym.yearlyPrice;

      const existingActive = await tx.membership.findFirst({
        where: { userId: uid, active: true },
      });

      if (existingActive) {
        throw new Error("ACTIVE_MEMBERSHIP_EXISTS");
      }

      const activeDuo = await tx.duo.findFirst({
        where: {
          gymId,
          active: true,
          OR: [{ userOneId: uid }, { userTwoId: uid }],
        },
      });

      let hasActiveDuo = !!activeDuo;

      let hasPartnerDiscountViaInvite = false;
      let inviteForDuo:
        | { id: string; inviterId: string; invitedUserId: string | null }
        | null = null;

      if (inviteCode && gym.partnerDiscountPercent > 0) {
        const invite = await tx.invite.findFirst({
          where: {
            gymId,
            code: inviteCode.toUpperCase(),
            accepted: false,
          },
        });

        if (invite) {
          if (invite.inviterId === uid) {
            if (invite.invitedUserId) {
              const inviteeMembership =
                await tx.membership.findFirst({
                  where: {
                    userId: invite.invitedUserId,
                    gymId,
                    active: true,
                  },
                });

              if (inviteeMembership) {
                hasPartnerDiscountViaInvite = true;
                inviteForDuo = invite;
              }
            }
          } else {
            hasPartnerDiscountViaInvite = true;
            inviteForDuo = invite;
          }
        }
      }

      if (hasPartnerDiscountViaInvite) hasActiveDuo = true;

      const hasEverHadMembership = await tx.membership.findFirst({
        where: { userId: uid },
      });

      const isFirstTimeUser = !hasEverHadMembership;

      let promo: { type: "PERCENT" | "FLAT"; value: number } | null =
        null;

      if (discountCode) {
        const code = await tx.discountCode.findFirst({
          where: {
            gymId,
            code: discountCode,
            validFrom: { lte: new Date() },
            validUntil: { gte: new Date() },
          },
        });

        if (code && code.usedCount < code.maxUses) {
          promo = {
            type: code.discountType as "PERCENT" | "FLAT",
            value: code.discountValue,
          };
        }
      }

      const { finalPrice, breakdown } = computeDiscount(
        basePrice,
        planType,
        {
          isFirstTimeUser,
          hasActiveDuo,
          promo,
          gym: {
            monthlyPrice: gym.monthlyPrice,
            quarterlyPrice: gym.quarterlyPrice ?? undefined,
            yearlyPrice: gym.yearlyPrice,
            partnerDiscountPercent: gym.partnerDiscountPercent,
            quarterlyDiscountType:
              gym.quarterlyDiscountType as "PERCENT" | "FLAT",
            quarterlyDiscountValue:
              gym.quarterlyDiscountValue,
            yearlyDiscountType:
              gym.yearlyDiscountType as "PERCENT" | "FLAT",
            yearlyDiscountValue: gym.yearlyDiscountValue,
            welcomeDiscountType:
              gym.welcomeDiscountType as "PERCENT" | "FLAT",
            welcomeDiscountValue:
              gym.welcomeDiscountValue,
          },
        }
      );

      const expiresAt = new Date();

      if (planType === "DAY_PASS")
        expiresAt.setDate(expiresAt.getDate() + 1);
      else if (planType === "MONTHLY")
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      else if (planType === "QUARTERLY")
        expiresAt.setMonth(expiresAt.getMonth() + 3);
      else expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      const membership = await tx.membership.create({
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
        select: {
          id: true,
          gymId: true,
          active: true,
          planType: true,
          basePrice: true,
          finalPrice: true,
          startedAt: true,
          expiresAt: true,
          gym: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
        },
      });

      if (inviteForDuo && !inviteForDuo.invitedUserId) {
        await tx.invite.update({
          where: { id: inviteForDuo.id },
          data: { invitedUserId: uid },
        });
      }

      return { membership, finalPrice, breakdown };
    });

    return NextResponse.json({
      membership: result.membership,
      finalPricePaise: result.finalPrice,
      breakdown: result.breakdown,
    });
  } catch (error: any) {
    if (error.message === "GYM_NOT_FOUND")
      return jsonError("Gym not found", 404);

    if (error.message === "DAY_PASS_NOT_AVAILABLE")
      return jsonError("Day pass not available for this gym", 400);

    if (error.message === "ACTIVE_MEMBERSHIP_EXISTS")
      return jsonError(
        "You already have an active membership",
        400
      );

    logServerError(error, {
      route: "/api/memberships",
      userId: uid,
    });

    return jsonError("Failed to create membership", 500);
  }
}
