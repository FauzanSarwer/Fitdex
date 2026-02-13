import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getOptionalEnv, getRequiredEnv } from "@/lib/env";

const passwordPepper = getRequiredEnv("PASSWORD_PEPPER", { allowEmptyInDev: true });
const TOKEN_EXPIRATION_MS = 1000 * 60 * 60 * 24; // Token expiration time (24 hours)
const DEFAULT_APP_URL = "http://localhost:3000";

type PrismaWithEmailVerification = typeof prisma & { emailVerificationToken: any };

function resolveAppUrl(req?: Request): string {
  const envUrl = getOptionalEnv("NEXT_PUBLIC_APP_URL") || getOptionalEnv("NEXTAUTH_URL");
  if (envUrl) return envUrl.replace(/\/$/, "");
  const origin = req?.headers.get("origin");
  return origin ? origin.replace(/\/$/, "") : DEFAULT_APP_URL;
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token + passwordPepper).digest("hex");
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createEmailVerificationLinks(userId: string, email: string, req?: Request) {
  if (!userId || !email) {
    throw new Error("Invalid userId or email provided for email verification links.");
  }

  const verifyToken = generateToken();
  const deleteToken = generateToken();
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRATION_MS);

  try {
    await (prisma as PrismaWithEmailVerification).emailVerificationToken.deleteMany({
      where: { userId, purpose: { in: ["VERIFY", "DELETE"] } },
    });
    await (prisma as PrismaWithEmailVerification).emailVerificationToken.createMany({
      data: [
        { userId, tokenHash: hashToken(verifyToken), purpose: "VERIFY", expiresAt },
        { userId, tokenHash: hashToken(deleteToken), purpose: "DELETE", expiresAt },
      ],
    });
  } catch (error) {
    console.error("Error creating email verification tokens:", error);
    throw new Error("Failed to create email verification tokens");
  }

  const appUrl = resolveAppUrl(req);
  const verifyUrl = `${appUrl}/auth/verify?token=${encodeURIComponent(verifyToken)}`;
  const deleteUrl = `${appUrl}/auth/verify?token=${encodeURIComponent(deleteToken)}&action=delete`;

  if (process.env.NODE_ENV !== "production") {
    console.info("[auth] Email verification link:", verifyUrl);
    console.info("[auth] Not you? link:", deleteUrl);
  }

  return { verifyUrl, deleteUrl, email };
}

export async function verifyEmailToken(token: string, action: "verify" | "delete") {
  if (!token || !action) {
    return { ok: false, error: "Invalid token or action provided." } as const;
  }

  const tokenHash = hashToken(token);
  let record;
  try {
    record = await (prisma as PrismaWithEmailVerification).emailVerificationToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, purpose: true, expiresAt: true },
    });
  } catch (error) {
    console.error("Error verifying email token:", error);
    return { ok: false, error: "Internal server error" } as const;
  }

  if (!record || record.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "Token invalid or expired" } as const;
  }

  try {
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
  } catch (error) {
    console.error("Error processing email token action:", error);
    return { ok: false, error: "Failed to process token action" } as const;
  }
}
