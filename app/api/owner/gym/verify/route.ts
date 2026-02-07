import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/permissions";
import { createRazorpayOrder, PaymentConfigError } from "@/lib/razorpay";
import { jsonError, safeJson } from "@/lib/api";
import { logServerError } from "@/lib/logger";

const VERIFIED_PRICE_PAISE = 9900; // ₹99

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const parsed = await safeJson<{ gymId?: string }>(req);
  if (!parsed.ok) {
    return jsonError("Invalid JSON body", 400);
  }
  const gymId = parsed.data.gymId?.trim();
  if (!gymId) {
    return jsonError("gymId required", 400);
  }
  try {
    const gym = await prisma.gym.findFirst({ where: { id: gymId, ownerId: uid } });
    if (!gym) {
      return jsonError("Gym not found", 404);
    }
    const receipt = `verify_${gymId}_${Date.now()}`;
    const order = await createRazorpayOrder(VERIFIED_PRICE_PAISE, receipt, {
      gymId,
      ownerId: uid,
      purpose: "VERIFY_BADGE",
    });
    const purchase = await prisma.verifiedBadgePurchase.create({
      data: {
        gymId,
        ownerId: uid,
        amount: VERIFIED_PRICE_PAISE,
        status: "PENDING",
        razorpayOrderId: order.id,
      },
    });
    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      purchaseId: purchase.id,
      gymId,
    });
  } catch (e) {
    if (e instanceof PaymentConfigError) {
      return jsonError("Payments unavailable", 503);
    }
    logServerError(e as Error, { route: "/api/owner/gym/verify", userId: uid });
    return jsonError("Failed to create order", 500);
  }
}
