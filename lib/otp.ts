import crypto from "crypto";
import { getOptionalEnv } from "@/lib/env";

const OTP_PEPPER = getOptionalEnv("OTP_PEPPER") ?? "";
const DEFAULT_COUNTRY_CODE = "+91"; // Default country code for phone numbers
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
if (!OTP_PEPPER && process.env.NODE_ENV === "production" && !isBuildPhase) {
  console.warn(
    "[otp] Missing OTP_PEPPER; OTP validation is insecure until configured. Ensure OTP_PEPPER is set in the environment variables."
  );
}

export function normalizePhoneNumber(raw: string): string | null {
  if (typeof raw !== "string" || !raw.trim()) {
    console.warn("Invalid input for normalizePhoneNumber:", raw);
    return null;
  }
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `${DEFAULT_COUNTRY_CODE}${digits}`;
  if (digits.length >= 11 && digits.length <= 13 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length >= 11 && digits.length <= 15 && raw.startsWith("+")) return `+${digits}`;
  console.warn("Unable to normalize phone number:", raw);
  return null;
}

export function generateOtpCode(): string {
  const code = Math.floor(100000 + Math.random() * 900000);
  if (code < 100000 || code > 999999) {
    console.warn("Generated OTP code is out of range:", code);
  }
  return String(code);
}

export function hashOtp(code: string): string {
  if (typeof code !== "string" || !code.trim()) {
    console.warn("Invalid input for hashOtp:", code);
    return "";
  }
  return crypto.createHmac("sha256", OTP_PEPPER).update(code).digest("hex");
}

function createBufferFromHex(hex: string): Buffer {
  return Buffer.from(hex, "hex");
}

export function timingSafeEqual(a: string, b: string): boolean {
  try {
    const aBuf = createBufferFromHex(a);
    const bBuf = createBufferFromHex(b);
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
  } catch (error) {
    console.warn("Error in timingSafeEqual:", error);
    return false;
  }
}
