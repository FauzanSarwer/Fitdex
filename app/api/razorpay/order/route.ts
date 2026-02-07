import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/permissions";
import { createRazorpayMarketplaceOrder, PaymentConfigError } from "@/lib/razorpay";
import { jsonError, safeJson } from "@/lib/api";
import { logServerError } from "@/lib/logger";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireUser(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const parsed = await safeJson<{ membershipId?: string }>(req);
  if (!parsed.ok) {
    return jsonError("Invalid JSON body", 400);
  }
  const membershipId = parsed.data.membershipId?.trim();
  if (!membershipId) {
    return jsonError("membershipId required", 400);
  }
  try {
    const membership = await prisma.membership.findFirst({
      where: { id: membershipId, userId: uid },
      include: { gym: true },
    });
    if (!membership) {
      return jsonError("Membership not found", 404);
    }
    if (membership.active) {
      return jsonError("Membership already active", 400);
    }
    const amountPaise = membership.finalPrice;
    if (amountPaise <= 0) {
      return jsonError("Invalid amount", 400);
    }
    if (membership.gym.verificationStatus !== "VERIFIED") {
      return jsonError("Gym is not verified for payments", 403);
    }
    if (!membership.gym.razorpaySubAccountId) {
      return jsonError("Gym payout account missing", 403);
    }
    const platformCommission = Math.floor(amountPaise * 0.05);
    const gymPayout = amountPaise - platformCommission;
    const receipt = `mem_${membershipId}_${Date.now()}`;
    const order = await createRazorpayMarketplaceOrder(
      amountPaise,
      receipt,
      membership.gym.razorpaySubAccountId,
      gymPayout,
      {
        membershipId,
        userId: uid,
        gymId: membership.gymId,
        platformCommission: String(platformCommission),
        gymPayout: String(gymPayout),
      }
    );
    await prisma.transaction.create({
      data: {
        userId: uid,
        gymId: membership.gymId,
        membershipId,
        totalAmount: amountPaise,
        platformCommissionAmount: platformCommission,
        gymPayoutAmount: gymPayout,
        razorpayOrderId: order.id,
        paymentStatus: "CREATED",
        settlementStatus: "NOT_STARTED",
      },
    });
    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt,
    });
  } catch (error) {
    if (error instanceof PaymentConfigError) {
      return jsonError("Payments unavailable", 503);
    }
    logServerError(error as Error, { route: "/api/razorpay/order", userId: uid });
    return jsonError("Failed to create order", 500);
  }
}
