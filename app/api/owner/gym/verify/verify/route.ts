import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/permissions";
import { verifyRazorpayPaymentSignature } from "@/lib/razorpay";

const VERIFIED_DAYS = 30;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const body = await req.json();
  const { gymId, orderId, paymentId, signature } = body as {
    gymId: string;
    orderId: string;
    paymentId: string;
    signature: string;
  };
  if (!gymId || !orderId || !paymentId || !signature) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  const gym = await prisma.gym.findFirst({ where: { id: gymId, ownerId: uid } });
  if (!gym) {
    return NextResponse.json({ error: "Gym not found" }, { status: 404 });
  }
  const purchase = await prisma.verifiedBadgePurchase.findUnique({
    where: { razorpayOrderId: orderId },
  });
  if (!purchase) {
    return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  }
  if (!verifyRazorpayPaymentSignature(orderId, paymentId, signature)) {
    await prisma.verifiedBadgePurchase.update({
      where: { id: purchase.id },
      data: { status: "FAILED" },
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  const now = new Date();
  const current = gym.verifiedUntil && gym.verifiedUntil > now ? gym.verifiedUntil : now;
  const verifiedUntil = new Date(current.getTime() + VERIFIED_DAYS * 24 * 60 * 60 * 1000);
  await prisma.verifiedBadgePurchase.update({
    where: { id: purchase.id },
    data: { status: "CAPTURED", razorpayPaymentId: paymentId },
  });
  const updated = await prisma.gym.update({
    where: { id: gymId },
    data: { verifiedUntil },
  });
  return NextResponse.json({
    ok: true,
    verifiedUntil: updated.verifiedUntil,
  });
}
