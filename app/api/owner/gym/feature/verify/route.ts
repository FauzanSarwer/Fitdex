import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/permissions";
import { verifyRazorpayPaymentSignature } from "@/lib/razorpay";
import { jsonError, safeJson } from "@/lib/api";
import { logServerError } from "@/lib/logger";

const FEATURE_DAYS = 3;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const parsed = await safeJson<{
    gymId?: string;
    orderId?: string;
    paymentId?: string;
    signature?: string;
  }>(req);
  if (!parsed.ok) {
    return jsonError("Invalid JSON body", 400);
  }
  const gymId = parsed.data.gymId?.trim();
  const orderId = parsed.data.orderId?.trim();
  const paymentId = parsed.data.paymentId?.trim();
  const signature = parsed.data.signature?.trim();
  if (!gymId || !orderId || !paymentId || !signature) {
    return jsonError("Missing fields", 400);
  }
  try {
    const gym = await prisma.gym.findFirst({ where: { id: gymId, ownerId: uid } });
    if (!gym) {
      return jsonError("Gym not found", 404);
    }
    const purchase = await prisma.featuredListingPurchase.findUnique({
      where: { razorpayOrderId: orderId },
    });
    if (!purchase) {
      return jsonError("Purchase not found", 404);
    }
    if (!verifyRazorpayPaymentSignature(orderId, paymentId, signature)) {
      await prisma.featuredListingPurchase.update({
        where: { id: purchase.id },
        data: { status: "FAILED" },
      });
      return jsonError("Invalid signature", 400);
    }
    const now = new Date();
    const current = gym.featuredUntil && gym.featuredUntil > now ? gym.featuredUntil : now;
    const featuredUntil = new Date(current.getTime() + FEATURE_DAYS * 24 * 60 * 60 * 1000);
    await prisma.featuredListingPurchase.update({
      where: { id: purchase.id },
      data: { status: "CAPTURED", razorpayPaymentId: paymentId },
    });
    const updated = await prisma.gym.update({
      where: { id: gymId },
      data: { featuredUntil },
    });
    return NextResponse.json({
      ok: true,
      featuredUntil: updated.featuredUntil,
    });
  } catch (error) {
    logServerError(error as Error, { route: "/api/owner/gym/feature/verify", userId: uid });
    return jsonError("Failed to verify purchase", 500);
  }
}
