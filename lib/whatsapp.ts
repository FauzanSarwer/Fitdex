import { prisma } from "@/lib/prisma";
import { getOptionalEnv } from "@/lib/env";
import { logServerError } from "@/lib/logger";

const WHATSAPP_API_URL = getOptionalEnv("WHATSAPP_API_URL");
const WHATSAPP_API_TOKEN = getOptionalEnv("WHATSAPP_API_TOKEN");
const prismaAny = prisma as any;

export async function sendWhatsappNotification(params: {
  eventType: string;
  toNumber: string;
  message: string;
  payload?: Record<string, unknown>;
  gymId?: string | null;
  userId?: string | null;
}) {
  const { eventType, toNumber, message, payload, gymId, userId } = params;
  if (!WHATSAPP_API_URL || !WHATSAPP_API_TOKEN) {
    await prismaAny.whatsAppLog.create({
      data: {
        eventType,
        toNumber,
        status: "SKIPPED",
        error: "WHATSAPP_NOT_CONFIGURED",
        payload: payload ?? undefined,
        gymId: gymId ?? undefined,
        userId: userId ?? undefined,
      },
    });
    return { ok: false as const, error: "WHATSAPP_NOT_CONFIGURED" };
  }

  try {
    const res = await fetch(WHATSAPP_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
      },
      body: JSON.stringify({
        to: toNumber,
        message,
        eventType,
        payload,
      }),
    });

    if (!res.ok) {
      const error = `WHATSAPP_FAILED_${res.status}`;
      await prismaAny.whatsAppLog.create({
        data: {
          eventType,
          toNumber,
          status: "FAILED",
          error,
          payload: payload ?? undefined,
          gymId: gymId ?? undefined,
          userId: userId ?? undefined,
        },
      });
      return { ok: false as const, error };
    }

    await prismaAny.whatsAppLog.create({
      data: {
        eventType,
        toNumber,
        status: "SENT",
        payload: payload ?? undefined,
        gymId: gymId ?? undefined,
        userId: userId ?? undefined,
      },
    });

    return { ok: true as const };
  } catch (error) {
    logServerError(error as Error, { route: "whatsapp" });
    await prismaAny.whatsAppLog.create({
      data: {
        eventType,
        toNumber,
        status: "FAILED",
        error: error instanceof Error ? error.message : "UNKNOWN_ERROR",
        payload: payload ?? undefined,
        gymId: gymId ?? undefined,
        userId: userId ?? undefined,
      },
    });
    return { ok: false as const, error: "WHATSAPP_REQUEST_FAILED" };
  }
}
