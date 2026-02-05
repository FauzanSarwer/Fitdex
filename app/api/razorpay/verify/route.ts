import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/permissions";
import { verifyRazorpayPaymentSignature } from "@/lib/razorpay";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireUser(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const body = await req.json();
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, membershipId } =
    body as {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
      membershipId: string;
    };
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !membershipId) {
    return NextResponse.json(
      { error: "Missing payment details" },
      { status: 400 }
    );
  }
  const valid = verifyRazorpayPaymentSignature(
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature
  );
  if (!valid) {
    return NextResponse.json(
      { error: "Invalid payment signature" },
      { status: 400 }
    );
  }
  const payment = await prisma.payment.findFirst({
    where: {
      razorpayOrderId: razorpay_order_id,
      userId: uid,
    },
  });
  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      razorpayPaymentId: razorpay_payment_id,
      status: "CAPTURED",
    },
  });
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, userId: uid },
  });
  if (membership) {
    await prisma.membership.update({
      where: { id: membershipId },
      data: { active: true },
    });
    const activeDuo = await prisma.duo.findFirst({
      where: {
        gymId: membership.gymId,
        OR: [{ userOneId: uid }, { userTwoId: uid }],
      },
    });
    if (activeDuo) {
      const otherId = activeDuo.userOneId === uid ? activeDuo.userTwoId : activeDuo.userOneId;
      const otherMembership = await prisma.membership.findFirst({
        where: { userId: otherId, gymId: membership.gymId, active: true },
      });
      if (otherMembership) {
        await prisma.duo.update({
          where: { id: activeDuo.id },
          data: { active: true },
        });
      }
    }
  }
  return NextResponse.json({ success: true });
}
