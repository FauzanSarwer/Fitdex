import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/permissions";
import { createRazorpayOrder } from "@/lib/razorpay";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireUser(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const body = await req.json();
  const { membershipId } = body as { membershipId: string };
  if (!membershipId) {
    return NextResponse.json(
      { error: "membershipId required" },
      { status: 400 }
    );
  }
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, userId: uid },
    include: { gym: true },
  });
  if (!membership) {
    return NextResponse.json({ error: "Membership not found" }, { status: 404 });
  }
  if (membership.active) {
    return NextResponse.json(
      { error: "Membership already active" },
      { status: 400 }
    );
  }
  const amountPaise = membership.finalPrice;
  if (amountPaise <= 0) {
    return NextResponse.json(
      { error: "Invalid amount" },
      { status: 400 }
    );
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
}
