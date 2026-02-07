import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getOptionalEnv, getRequiredEnv } from "@/lib/env";

const passwordPepper = getRequiredEnv("PASSWORD_PEPPER", { allowEmptyInDev: true });
type PrismaWithEmailVerification = typeof prisma & { emailVerificationToken: any };

function resolveAppUrl(req?: Request) {
  const envUrl = getOptionalEnv("NEXT_PUBLIC_APP_URL") || getOptionalEnv("NEXTAUTH_URL");
  if (envUrl) return envUrl.replace(/\/$/, "");
  const origin = req?.headers.get("origin");
  return origin ? origin.replace(/\/$/, "") : "";
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token + passwordPepper).digest("hex");
}

export async function createEmailVerificationLinks(userId: string, email: string, req?: Request) {
  const verifyToken = crypto.randomBytes(32).toString("hex");
  const deleteToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

  await (prisma as PrismaWithEmailVerification).emailVerificationToken.deleteMany({ where: { userId } });
  await (prisma as PrismaWithEmailVerification).emailVerificationToken.createMany({
    data: [
      { userId, tokenHash: hashToken(verifyToken), purpose: "VERIFY", expiresAt },
      { userId, tokenHash: hashToken(deleteToken), purpose: "DELETE", expiresAt },
    ],
  });

  const appUrl = resolveAppUrl(req);
  const verifyUrl = appUrl ? `${appUrl}/auth/verify?token=${encodeURIComponent(verifyToken)}` : "";
  const deleteUrl = appUrl ? `${appUrl}/auth/verify?token=${encodeURIComponent(deleteToken)}&action=delete` : "";

  if (process.env.NODE_ENV !== "production") {
    console.info("[auth] Email verification link:", verifyUrl || verifyToken);
    console.info("[auth] Not you? link:", deleteUrl || deleteToken);
  }

  return { verifyUrl, deleteUrl, email };
}

export async function verifyEmailToken(token: string, action: "verify" | "delete") {
  const tokenHash = hashToken(token);
  const record = await (prisma as PrismaWithEmailVerification).emailVerificationToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, purpose: true, expiresAt: true },
  });

  if (!record || record.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "Token invalid or expired" } as const;
  }

  if (action === "delete") {
    if (record.purpose !== "DELETE") {
      return { ok: false, error: "Invalid delete token" } as const;
    }
    await prisma.user.delete({ where: { id: record.userId } });
    return { ok: true, action: "delete" } as const;
  }

  if (record.purpose !== "VERIFY") {
    return { ok: false, error: "Invalid verification token" } as const;
  }
  await prisma.user.update({
    where: { id: record.userId },
    data: { emailVerified: new Date() },
  });
  await (prisma as PrismaWithEmailVerification).emailVerificationToken.deleteMany({ where: { userId: record.userId } });
  return { ok: true, action: "verify" } as const;
}
