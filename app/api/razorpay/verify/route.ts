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
    const payment = await prisma.payment.findFirst({
      where: {
        razorpayOrderId: razorpay_order_id,
        userId: uid,
      },
    });
    if (!payment) {
      return jsonError("Payment not found", 404);
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
      const { gymId } = membership;

      // Create duo if both inviter and invitee now have active membership (join-together or invite-after-join)
      const invite = await prisma.invite.findFirst({
        where: {
          gymId,
          accepted: false,
          OR: [{ inviterId: uid }, { invitedUserId: uid }],
        },
      });
      if (invite && invite.invitedUserId) {
        const inviterActive = await prisma.membership.findFirst({
          where: { userId: invite.inviterId, gymId, active: true },
        });
        const inviteeActive = await prisma.membership.findFirst({
          where: { userId: invite.invitedUserId, gymId, active: true },
        });
        if (inviterActive && inviteeActive) {
          const [u1, u2] =
            invite.inviterId < invite.invitedUserId
              ? [invite.inviterId, invite.invitedUserId]
              : [invite.invitedUserId, invite.inviterId];
          await prisma.duo.upsert({
            where: {
              userOneId_userTwoId_gymId: { userOneId: u1, userTwoId: u2, gymId },
            },
            create: { userOneId: u1, userTwoId: u2, gymId, active: true },
            update: {},
          });
          await prisma.invite.update({
            where: { id: invite.id },
            data: { accepted: true },
          });
        }
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof PaymentConfigError) {
      return jsonError("Payments unavailable", 503);
    }
    logServerError(error as Error, { route: "/api/razorpay/verify", userId: uid });
    return jsonError("Payment verification failed", 500);
  }
}
