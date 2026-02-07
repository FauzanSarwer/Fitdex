import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/permissions";
import { createRazorpayOrder, PaymentConfigError } from "@/lib/razorpay";
import { jsonError, safeJson } from "@/lib/api";
import { logServerError } from "@/lib/logger";

const PLAN_PRICES: Record<string, number> = {
  STARTER: 149900,
  PRO: 199900,
};

export async function POST(req: Request) {
  if (process.env.PAYMENTS_ENABLED !== "true") {
    return jsonError("PAYMENTS_DISABLED", 503);
  }
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const parsed = await safeJson<{ plan?: string }>(req);
  if (!parsed.ok) {
    return jsonError("Invalid JSON body", 400);
  }
  const plan = parsed.data.plan?.toUpperCase();
  if (!plan || !PLAN_PRICES[plan]) {
    return jsonError("Invalid plan", 400);
  }
  try {
    const amount = PLAN_PRICES[plan];
    const receipt = `owner_${plan}_${uid}_${Date.now()}`;
    const order = await createRazorpayOrder(amount, receipt, {
      ownerId: uid,
      plan,
      purpose: "OWNER_SUBSCRIPTION",
    });
    const subscription = await prisma.ownerSubscription.create({
      data: {
        ownerId: uid,
        plan,
        status: "PENDING",
        startsAt: new Date(),
        expiresAt: new Date(),
        razorpayOrderId: order.id,
      },
    });
    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      subscriptionId: subscription.id,
      plan,
    });
  } catch (error) {
    if (error instanceof PaymentConfigError) {
      return jsonError("Payments unavailable", 503);
    }
    logServerError(error as Error, { route: "/api/owner/subscription/order", userId: uid });
    return jsonError("Failed to create order", 500);
  }
}
