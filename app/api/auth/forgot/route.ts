import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getOptionalEnv, getRequiredEnv } from "@/lib/env";
import { jsonError, safeJson } from "@/lib/api";
import { logServerError } from "@/lib/logger";

const passwordPepper = getRequiredEnv("PASSWORD_PEPPER", { allowEmptyInDev: true });

function resolveAppUrl(req: Request) {
  const envUrl = getOptionalEnv("NEXT_PUBLIC_APP_URL") || getOptionalEnv("NEXTAUTH_URL");
  if (envUrl) return envUrl.replace(/\/$/, "");
  const origin = req.headers.get("origin");
  return origin ? origin.replace(/\/$/, "") : "";
}

export async function POST(req: Request) {
  try {
    const parsed = await safeJson<{ email?: string }>(req);
    if (!parsed.ok) {
      return jsonError("Invalid JSON body", 400);
    }
    const emailRaw = parsed.data.email?.toLowerCase().trim();
    if (!emailRaw) {
      return jsonError("Email is required", 400);
    }

    const user = await prisma.user.findUnique({
      where: { email: emailRaw },
      select: { id: true, email: true },
    });

    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token + passwordPepper).digest("hex");
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      const appUrl = resolveAppUrl(req);
      const resetUrl = appUrl ? `${appUrl}/auth/reset?token=${encodeURIComponent(token)}` : "";
      if (process.env.NODE_ENV !== "production") {
        console.info("[auth] Password reset link:", resetUrl || token);
        return NextResponse.json({ ok: true, resetUrl });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    logServerError(e as Error, { route: "/api/auth/forgot" });
    return jsonError("Unable to start password reset", 500);
  }
}
