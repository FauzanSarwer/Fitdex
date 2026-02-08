import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/permissions";
import { PaymentConfigError, verifyRazorpayPaymentSignature } from "@/lib/razorpay";
import { jsonError, safeJson } from "@/lib/api";
import { logServerError } from "@/lib/logger";
import { generateInvoiceNumber } from "@/lib/invoice";

const SUBSCRIPTION_DAYS = 30;
const PLAN_PRICES: Record<string, number> = {
  STARTER: 149900,
  PRO: 199900,
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const role = (session!.user as { role?: string }).role;
  if (role === "ADMIN") {
    const adminSub = await prisma.ownerSubscription.findFirst({
      where: { ownerId: uid, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ ok: true, subscription: adminSub });
  }
  const parsed = await safeJson<{
    orderId?: string;
    paymentId?: string;
    signature?: string;
  }>(req);
  if (!parsed.ok) {
    return jsonError("Invalid JSON body", 400);
  }
  const orderId = parsed.data.orderId?.trim();
  const paymentId = parsed.data.paymentId?.trim();
  const signature = parsed.data.signature?.trim();
  if (!orderId || !paymentId || !signature) {
    return jsonError("Missing fields", 400);
  }
  try {
    const subscription = await prisma.ownerSubscription.findFirst({
      where: { ownerId: uid, razorpayOrderId: orderId },
    });
    if (!subscription) {
      return jsonError("Subscription not found", 404);
    }
    if (!verifyRazorpayPaymentSignature(orderId, paymentId, signature)) {
      await prisma.ownerSubscription.update({
        where: { id: subscription.id },
        data: { status: "CANCELED" },
      });
      return jsonError("Invalid signature", 400);
    }

    const now = new Date();
    const active = await prisma.ownerSubscription.findFirst({
      where: { ownerId: uid, status: "ACTIVE", expiresAt: { gt: now } },
      orderBy: { expiresAt: "desc" },
    });

    let startsAt = now;
    if (active && active.plan === subscription.plan) {
      startsAt = active.expiresAt;
    } else if (active && active.id !== subscription.id) {
      await prisma.ownerSubscription.update({
        where: { id: active.id },
        data: { status: "CANCELED" },
      });
    }
    const expiresAt = new Date(startsAt.getTime() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000);

    const updated = await prisma.ownerSubscription.update({
      where: { id: subscription.id },
      data: {
        status: "ACTIVE",
        startsAt,
        expiresAt,
        razorpayPaymentId: paymentId,
      },
    });

    const gym = await prisma.gym.findFirst({
      where: { ownerId: uid },
      orderBy: { createdAt: "asc" },
    });
    if (PLAN_PRICES[updated.plan] && PLAN_PRICES[updated.plan] >= 149900) {
      const invoiceNumber = generateInvoiceNumber("OWN");
      await prisma.invoice.create({
        data: {
          invoiceNumber,
          ownerId: uid,
          gymId: gym?.id,
          amount: PLAN_PRICES[updated.plan] ?? 0,
          gstNumber: gym?.gstNumber ?? null,
          issuedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      ok: true,
      subscription: updated,
    });
  } catch (error) {
    if (error instanceof PaymentConfigError) {
      return jsonError("Payments unavailable", 503);
    }
    logServerError(error as Error, { route: "/api/owner/subscription/verify", userId: uid });
    return jsonError("Failed to verify subscription", 500);
  }
}
