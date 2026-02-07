import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/permissions";
import { createRazorpayOrder } from "@/lib/razorpay";
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
    const receipt = `mem_${membershipId}_${Date.now()}`;
    const order = await createRazorpayOrder(amountPaise, receipt, {
      membershipId,
      userId: uid,
      gymId: membership.gymId,
    });
    await prisma.payment.create({
      data: {
        userId: uid,
        gymId: membership.gymId,
        amount: amountPaise,
        razorpayOrderId: order.id,
        status: "PENDING",
      },
    });
    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt,
    });
  } catch (error) {
    logServerError(error as Error, { route: "/api/razorpay/order", userId: uid });
    return jsonError("Failed to create order", 500);
  }
}
