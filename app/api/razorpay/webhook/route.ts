import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay";
import { jsonError } from "@/lib/api";
import { logServerError } from "@/lib/logger";

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    const sig = req.headers.get("x-razorpay-signature") ?? "";
    if (!sig) {
      return jsonError("Missing signature", 400);
    }
    if (!verifyRazorpayWebhookSignature(raw, sig)) {
      return jsonError("Invalid signature", 400);
    }
    let body: {
      event: string;
      payload?: { payment?: { entity?: { id: string; order_id: string } } };
    };
    try {
      body = JSON.parse(raw);
    } catch {
      return jsonError("Invalid JSON", 400);
    }
    if (body.event === "payment.captured") {
      const paymentId = body.payload?.payment?.entity?.id;
      const orderId = body.payload?.payment?.entity?.order_id;
      if (paymentId && orderId) {
        const payment = await prisma.payment.findFirst({
          where: { razorpayOrderId: orderId },
        });
        if (payment) {
          await prisma.payment.update({
            where: { id: payment.id },
            data: { razorpayPaymentId: paymentId, status: "CAPTURED" },
          });
          const membership = await prisma.membership.findFirst({
            where: { userId: payment.userId, gymId: payment.gymId },
            orderBy: { startedAt: "desc" },
          });
          if (membership && !membership.active) {
            await prisma.membership.update({
              where: { id: membership.id },
              data: { active: true },
            });
          }
        }
      }
    }
    if (body.event === "payment.failed") {
      const orderId = body.payload?.payment?.entity?.order_id;
      if (orderId) {
        await prisma.payment.updateMany({
          where: { razorpayOrderId: orderId },
          data: { status: "FAILED" },
        });
      }
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    logServerError(error as Error, { route: "/api/razorpay/webhook" });
    return jsonError("Webhook processing failed", 500);
  }
}
