import crypto from "crypto";
import { getOptionalEnv } from "@/lib/env";

const OTP_PEPPER = getOptionalEnv("OTP_PEPPER") ?? "";
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
if (!OTP_PEPPER && process.env.NODE_ENV === "production" && !isBuildPhase) {
  console.warn("[otp] Missing OTP_PEPPER; OTP validation is insecure until configured.");
}

export function normalizePhoneNumber(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length >= 11 && digits.length <= 13 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length >= 11 && digits.length <= 15 && raw.startsWith("+")) return `+${digits}`;
  return null;
}

export function generateOtpCode(): string {
  const code = Math.floor(100000 + Math.random() * 900000);
  return String(code);
}

export function hashOtp(code: string): string {
  return crypto.createHmac("sha256", OTP_PEPPER).update(code).digest("hex");
}

export function timingSafeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "hex");
  const bBuf = Buffer.from(b, "hex");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}
