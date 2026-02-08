import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay";
import { jsonError } from "@/lib/api";
import { logServerError } from "@/lib/logger";
import { sendWhatsappNotification } from "@/lib/whatsapp";

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
    let body: any;
    try {
      body = JSON.parse(raw);
    } catch {
      return jsonError("Invalid JSON", 400);
    }
    const eventType = String(body?.event ?? "unknown");
    const eventId = String(
      body?.id ??
        createWebhookEventId(raw)
    );

    const existing = await prisma.razorpayWebhookEvent.findUnique({
      where: { eventId },
    });
    if (existing) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    await prisma.razorpayWebhookEvent.create({
      data: {
        eventId,
        eventType,
        payload: body,
      },
    });

    if (eventType === "payment.captured") {
      const paymentId = body?.payload?.payment?.entity?.id as string | undefined;
      const orderId = body?.payload?.payment?.entity?.order_id as string | undefined;
      if (orderId) {
        const transaction = await prisma.transaction.findFirst({
          where: { razorpayOrderId: orderId },
        });
        if (transaction) {
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: {
              razorpayPaymentId: paymentId ?? transaction.razorpayPaymentId,
              paymentStatus: "PAID",
            },
          });
          await prisma.membership.update({
            where: { id: transaction.membershipId },
            data: { active: true },
          });
          const membership = await prisma.membership.findFirst({
            where: { id: transaction.membershipId },
          });
          if (membership) {
            const { gymId, userId } = membership;
            const [gym, user] = await Promise.all([
              prisma.gym.findUnique({ where: { id: gymId }, include: { owner: true } }),
              prisma.user.findUnique({ where: { id: userId } }),
            ]);
            if (gym?.owner?.supportWhatsapp) {
              await sendWhatsappNotification({
                eventType: "BOOKING_CONFIRMATION",
                toNumber: gym.owner.supportWhatsapp,
                gymId,
                userId,
                payload: { gymName: gym.name, membershipId: membership.id },
                message: `New booking confirmed for ${gym.name}.`,
              });
            }
            if (user?.phoneNumber) {
              await sendWhatsappNotification({
                eventType: "BOOKING_CONFIRMATION",
                toNumber: user.phoneNumber,
                gymId,
                userId,
                payload: { gymName: gym?.name ?? "Your gym", membershipId: membership.id },
                message: `Your booking for ${gym?.name ?? "the gym"} is confirmed. Welcome to FITDEX!`,
              });
            }
            const invite = await prisma.invite.findFirst({
              where: {
                gymId,
                accepted: false,
                OR: [{ inviterId: userId }, { invitedUserId: userId }],
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
        }
      }
    }

    if (eventType === "payment.failed") {
      const orderId = body?.payload?.payment?.entity?.order_id as string | undefined;
      if (orderId) {
        await prisma.transaction.updateMany({
          where: { razorpayOrderId: orderId },
          data: { paymentStatus: "FAILED" },
        });
      }
    }

    if (eventType === "transfer.processed") {
      const orderId = body?.payload?.transfer?.entity?.order_id as string | undefined;
      if (orderId) {
        await prisma.transaction.updateMany({
          where: { razorpayOrderId: orderId },
          data: { settlementStatus: "COMPLETED" },
        });
      }
    }

    if (eventType === "transfer.failed") {
      const orderId = body?.payload?.transfer?.entity?.order_id as string | undefined;
      if (orderId) {
        await prisma.transaction.updateMany({
          where: { razorpayOrderId: orderId },
          data: { settlementStatus: "PARTIAL" },
        });
      }
    }

    await prisma.razorpayWebhookEvent.update({
      where: { eventId },
      data: { processedAt: new Date() },
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    logServerError(error as Error, { route: "/api/razorpay/webhook" });
    return jsonError("Webhook processing failed", 500);
  }
}

function createWebhookEventId(raw: string) {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(raw).digest("hex");
}
