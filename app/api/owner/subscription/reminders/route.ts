import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOptionalEnv } from "@/lib/env";
import { jsonError } from "@/lib/api";
import { logServerError } from "@/lib/logger";
import { sendOwnerRenewalReminderEmail } from "@/lib/email";
import { sendWhatsappNotification } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";
const prismaAny = prisma as any;

export async function POST(req: Request) {
  const cronSecret = getOptionalEnv("CRON_SECRET");
  const headerSecret = req.headers.get("x-cron-secret") ?? "";
  const { searchParams } = new URL(req.url);
  const querySecret = searchParams.get("token") ?? "";
  if (cronSecret && headerSecret !== cronSecret && querySecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const daysBeforeExpiry = Number(getOptionalEnv("OWNER_RENEWAL_REMINDER_DAYS") ?? "5");
  if (!Number.isFinite(daysBeforeExpiry) || daysBeforeExpiry <= 0) {
    return jsonError("Invalid reminder window", 400);
  }

  try {
    const now = new Date();
    const target = new Date();
    target.setDate(target.getDate() + daysBeforeExpiry);

    const expiring = await prisma.ownerSubscription.findMany({
      where: {
        status: "ACTIVE",
        expiresAt: { gte: now, lte: target },
      },
      include: { owner: true },
    });

    for (const sub of expiring) {
      const gym = await prisma.gym.findFirst({ where: { ownerId: sub.ownerId } });
      const gymName = gym?.name ?? "your gym";
      const email = sub.owner.email;

      if (email) {
        try {
          const result = await sendOwnerRenewalReminderEmail(email, gymName, daysBeforeExpiry);
          await prismaAny.subscriptionReminderLog.create({
            data: {
              ownerId: sub.ownerId,
              subscriptionId: sub.id,
              daysBeforeExpiry,
              channel: "EMAIL",
              status: result.ok ? "SENT" : "FAILED",
              error: result.ok ? null : result.error,
            },
          });
        } catch (error) {
          await prismaAny.subscriptionReminderLog.upsert({
            where: {
              subscriptionId_daysBeforeExpiry_channel: {
                subscriptionId: sub.id,
                daysBeforeExpiry,
                channel: "EMAIL",
              },
            },
            update: { status: "FAILED", error: error instanceof Error ? error.message : "FAILED" },
            create: {
              ownerId: sub.ownerId,
              subscriptionId: sub.id,
              daysBeforeExpiry,
              channel: "EMAIL",
              status: "FAILED",
              error: error instanceof Error ? error.message : "FAILED",
            },
          });
        }
      }

      if (sub.owner.supportWhatsapp) {
        const result = await sendWhatsappNotification({
          eventType: "PLAN_EXPIRY_REMINDER",
          toNumber: sub.owner.supportWhatsapp,
          userId: sub.ownerId,
          payload: { gymName, daysBeforeExpiry },
          message: `Reminder: ${gymName} plan expires in ${daysBeforeExpiry} days. Renew on Fitdex to avoid downtime.`,
        });
        await prismaAny.subscriptionReminderLog.upsert({
          where: {
            subscriptionId_daysBeforeExpiry_channel: {
              subscriptionId: sub.id,
              daysBeforeExpiry,
              channel: "WHATSAPP",
            },
          },
          update: {
            status: result.ok ? "SENT" : "FAILED",
            error: result.ok ? null : result.error,
          },
          create: {
            ownerId: sub.ownerId,
            subscriptionId: sub.id,
            daysBeforeExpiry,
            channel: "WHATSAPP",
            status: result.ok ? "SENT" : "FAILED",
            error: result.ok ? null : result.error,
          },
        });
      }
    }

    return NextResponse.json({ ok: true, count: expiring.length });
  } catch (error) {
    logServerError(error as Error, { route: "/api/owner/subscription/reminders" });
    return jsonError("Failed to send reminders", 500);
  }
}
