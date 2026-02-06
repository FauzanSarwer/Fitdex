import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/permissions";
import { createRazorpayOrder } from "@/lib/razorpay";

const VERIFIED_PRICE_PAISE = 9900; // ₹99

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const body = await req.json();
  const { gymId } = body as { gymId: string };
  if (!gymId) {
    return NextResponse.json({ error: "gymId required" }, { status: 400 });
  }
  const gym = await prisma.gym.findFirst({ where: { id: gymId, ownerId: uid } });
  if (!gym) {
    return NextResponse.json({ error: "Gym not found" }, { status: 404 });
  }
  const receipt = `verify_${gymId}_${Date.now()}`;
  try {
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
    console.error(e);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
