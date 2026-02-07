import { getOptionalEnv } from "./env";

export class PaymentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentConfigError";
  }
}

function requireEnv(name: string) {
  const value = getOptionalEnv(name);
  if (!value) {
    throw new PaymentConfigError("Payments unavailable: missing configuration");
  }
  return value;
}

export function getRazorpayKeyId() {
  return requireEnv("RAZORPAY_KEY_ID");
}

export async function createRazorpayOrder(
  amountPaise: number,
  receipt: string,
  notes?: Record<string, string>
) {
  const crypto = await import("crypto");
  const keyId = requireEnv("RAZORPAY_KEY_ID");
  const keySecret = requireEnv("RAZORPAY_KEY_SECRET");
  const key = Buffer.from(keyId + ":" + keySecret).toString(
    "base64"
  );
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + key,
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes: notes ?? {},
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error("Razorpay order failed: " + err);
  }
  return res.json() as Promise<{ id: string; amount: number; currency: string }>;
}

export function verifyRazorpayPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const crypto = require("crypto");
  const keySecret = requireEnv("RAZORPAY_KEY_SECRET");
  const body = orderId + "|" + paymentId;
  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(body)
    .digest("hex");
  return timingSafeEqualHex(expected, signature);
}

export function verifyRazorpayWebhookSignature(
  body: string,
  signature: string
): boolean {
  const crypto = require("crypto");
  let secret = "";
  try {
    secret = requireEnv("RAZORPAY_WEBHOOK_SECRET");
  } catch (e) {
    if (e instanceof PaymentConfigError) return false;
    throw e;
  }
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  return timingSafeEqualHex(expected, signature);
}

function timingSafeEqualHex(expected: string, actual: string): boolean {
  const crypto = require("crypto");
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(actual, "hex");
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}
