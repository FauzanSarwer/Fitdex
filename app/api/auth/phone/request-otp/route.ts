import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, safeJson } from "@/lib/api";
import { generateOtpCode, hashOtp, normalizePhoneNumber } from "@/lib/otp";
import { sendWhatsappNotification } from "@/lib/whatsapp";
import { logServerError } from "@/lib/logger";

const OTP_EXPIRY_MIN = 5;
const MIN_RESEND_SECONDS = 60;
const MAX_PER_HOUR = 5;
const prismaAny = prisma as any;

export async function POST(req: Request) {
  const parsed = await safeJson<{ phoneNumber?: string }>(req);
  if (!parsed.ok) return jsonError("Invalid JSON body", 400);
  const raw = parsed.data.phoneNumber ?? "";
  const phoneNumber = normalizePhoneNumber(raw);
  if (!phoneNumber) return jsonError("Invalid phone number", 400);

  try {
    const existing = await prismaAny.phoneOtp.findUnique({ where: { phoneNumber } });
    const now = new Date();
    if (existing) {
      const diffSeconds = (now.getTime() - existing.lastSentAt.getTime()) / 1000;
      if (diffSeconds < MIN_RESEND_SECONDS) {
        return jsonError("OTP recently sent. Please wait.", 429);
      }
      const diffHours = (now.getTime() - existing.createdAt.getTime()) / (1000 * 60 * 60);
      if (diffHours < 1 && existing.sendCount >= MAX_PER_HOUR) {
        return jsonError("OTP limit reached. Try again later.", 429);
      }
    }

    const code = generateOtpCode();
    const codeHash = hashOtp(code);
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MIN * 60 * 1000);

    if (existing) {
      await prismaAny.phoneOtp.update({
        where: { phoneNumber },
        data: {
          codeHash,
          expiresAt,
          lastSentAt: now,
          sendCount: existing.sendCount + 1,
        },
      });
    } else {
      await prismaAny.phoneOtp.create({
        data: {
          phoneNumber,
          codeHash,
          expiresAt,
        },
      });
    }

    const sendResult = await sendWhatsappNotification({
      eventType: "OTP_LOGIN",
      toNumber: phoneNumber,
      message: `Your Fitdex login OTP is ${code}. It expires in ${OTP_EXPIRY_MIN} minutes.`,
    });

    if (!sendResult.ok) {
      if (sendResult.error === "WHATSAPP_NOT_CONFIGURED" && process.env.NODE_ENV !== "production") {
        return NextResponse.json({ ok: true, devOtp: code });
      }
      await prismaAny.phoneOtp.delete({ where: { phoneNumber } }).catch(() => undefined);
      return jsonError("OTP service unavailable", 503);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logServerError(error as Error, { route: "/api/auth/phone/request-otp" });
    return jsonError("Failed to send OTP", 500);
  }
}
