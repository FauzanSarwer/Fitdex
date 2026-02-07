import { getRequiredEnv } from "./env";

const RAZORPAY_KEY_ID = getRequiredEnv("RAZORPAY_KEY_ID", { allowEmptyInDev: true });
const RAZORPAY_KEY_SECRET = getRequiredEnv("RAZORPAY_KEY_SECRET", { allowEmptyInDev: true });

export function getRazorpayKeyId() {
  return RAZORPAY_KEY_ID;
}

export async function createRazorpayOrder(
  amountPaise: number,
  receipt: string,
  notes?: Record<string, string>
) {
  const crypto = await import("crypto");
  const key = Buffer.from(RAZORPAY_KEY_ID + ":" + RAZORPAY_KEY_SECRET).toString(
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
  const body = orderId + "|" + paymentId;
  const expected = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");
  return timingSafeEqualHex(expected, signature);
}

export function verifyRazorpayWebhookSignature(
  body: string,
  signature: string
): boolean {
  const crypto = require("crypto");
  const secret = getRequiredEnv("RAZORPAY_WEBHOOK_SECRET", { allowEmptyInDev: true });
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
