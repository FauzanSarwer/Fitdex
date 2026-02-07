import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/permissions";
import { PaymentConfigError, verifyRazorpayPaymentSignature } from "@/lib/razorpay";
import { jsonError, safeJson } from "@/lib/api";
import { logServerError } from "@/lib/logger";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireUser(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const parsed = await safeJson<{
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
    membershipId?: string;
  }>(req);
  if (!parsed.ok) {
    return jsonError("Invalid JSON body", 400);
  }
  const razorpay_order_id = parsed.data.razorpay_order_id?.trim();
  const razorpay_payment_id = parsed.data.razorpay_payment_id?.trim();
  const razorpay_signature = parsed.data.razorpay_signature?.trim();
  const membershipId = parsed.data.membershipId?.trim();
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !membershipId) {
    return jsonError("Missing payment details", 400);
  }
  try {
    const valid = verifyRazorpayPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );
    if (!valid) {
      return jsonError("Invalid payment signature", 400);
    }
    const transaction = await prisma.transaction.findFirst({
      where: {
        razorpayOrderId: razorpay_order_id,
        userId: uid,
        membershipId,
      },
    });
    if (!transaction) {
      return jsonError("Transaction not found", 404);
    }
    if (!transaction.razorpayPaymentId) {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { razorpayPaymentId: razorpay_payment_id },
      });
    }
    return NextResponse.json({ success: true, message: "Payment received; awaiting confirmation." });
  } catch (error) {
    if (error instanceof PaymentConfigError) {
      return jsonError("Payments unavailable", 503);
    }
    logServerError(error as Error, { route: "/api/razorpay/verify", userId: uid });
    return jsonError("Payment verification failed", 500);
  }
}
