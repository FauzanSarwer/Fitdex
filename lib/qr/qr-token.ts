import crypto from "crypto";
import type { QrType, SignedQrPayload } from "./qr-types";

const MIN_TTL_SECONDS = 30;
const MAX_TTL_SECONDS = 60;
const DEFAULT_TTL_SECONDS = 45;
const QR_MASTER_KEY = process.env.QR_MASTER_KEY ?? "fitdex-dev-qr-master";

const base64UrlEncode = (input: Buffer | string) => {
  const buffer = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buffer.toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
};

const base64UrlDecode = (input: string) => {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(padLength);
  return Buffer.from(padded, "base64");
};

const buildSigningKey = (keyMaterial: string) => {
  return crypto
    .createHmac("sha256", QR_MASTER_KEY)
    .update(keyMaterial)
    .digest();
};

const signPayload = (
  payload: Omit<SignedQrPayload, "sig">,
  keyMaterial: string
) => {
  const key = buildSigningKey(keyMaterial);
  const body = `${payload.gymId}.${payload.type}.${payload.exp}.${payload.nonce}.${payload.v}.${payload.deviceBinding ?? ""}`;
  return crypto.createHmac("sha256", key).update(body).digest("base64url");
};

export function createSignedQrPayload(params: {
  gymId: string;
  type: QrType;
  version: number;
  keyMaterial: string;
  ttlSeconds?: number;
  deviceBinding?: string | null;
}): SignedQrPayload {
  const ttl = Math.max(
    MIN_TTL_SECONDS,
    Math.min(MAX_TTL_SECONDS, params.ttlSeconds ?? DEFAULT_TTL_SECONDS)
  );
  const exp = Date.now() + ttl * 1000;
  const nonce = crypto.randomBytes(16).toString("hex");
  const base: Omit<SignedQrPayload, "sig"> = {
    gymId: params.gymId,
    type: params.type,
    exp,
    nonce,
    v: params.version,
    deviceBinding: params.deviceBinding ?? undefined,
  };
  const sig = signPayload(base, params.keyMaterial);
  return { ...base, sig };
}

export function encodeSignedPayload(payload: SignedQrPayload): string {
  return base64UrlEncode(JSON.stringify(payload));
}

export function decodeSignedPayload(token: string): SignedQrPayload | null {
  try {
    const raw = base64UrlDecode(token).toString("utf8");
    const parsed = JSON.parse(raw) as SignedQrPayload;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function verifySignedPayload(
  payload: SignedQrPayload,
  keyMaterial: string,
  now = Date.now()
): { ok: boolean; reason?: string } {
  if (payload.exp < now) {
    return { ok: false, reason: "Token expired" };
  }

  const expected = signPayload(
    {
      gymId: payload.gymId,
      type: payload.type,
      exp: payload.exp,
      nonce: payload.nonce,
      v: payload.v,
      deviceBinding: payload.deviceBinding,
    },
    keyMaterial
  );
  if (expected !== payload.sig) {
    return { ok: false, reason: "Invalid signature" };
  }
  return { ok: true };
}

export function hashQrToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function hashDeviceBinding(deviceId: string): string {
  return crypto.createHash("sha256").update(deviceId).digest("hex");
}

export function buildScanDeepLink(payload: SignedQrPayload): string {
  const token = encodeSignedPayload(payload);
  const params = new URLSearchParams({
    gymId: payload.gymId,
    type: payload.type,
    token,
  });
  return `fitdex://scan?${params.toString()}`;
}
