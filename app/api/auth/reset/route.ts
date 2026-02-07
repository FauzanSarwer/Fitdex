import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getRequiredEnv } from "@/lib/env";
import { jsonError, safeJson } from "@/lib/api";
import { logServerError } from "@/lib/logger";

const passwordPepper = getRequiredEnv("PASSWORD_PEPPER", { allowEmptyInDev: true });

export async function POST(req: Request) {
  try {
    const parsed = await safeJson<{ token?: string; password?: string }>(req);
    if (!parsed.ok) {
      return jsonError("Invalid JSON body", 400);
    }
    const token = parsed.data.token?.trim();
    const password = parsed.data.password?.trim();

    if (!token) {
      return jsonError("Reset token required", 400);
    }
    if (!password || password.length < 8) {
      return jsonError("Password must be at least 8 characters", 400);
    }

    const tokenHash = crypto.createHash("sha256").update(token + passwordPepper).digest("hex");
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true },
    });

    if (!record || record.expiresAt.getTime() < Date.now()) {
      return jsonError("Reset link is invalid or expired", 400);
    }

    const hashed = await bcrypt.hash(`${password}${passwordPepper}`, 12);
    await prisma.user.update({
      where: { id: record.userId },
      data: { password: hashed },
    });
    await prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } });

    return NextResponse.json({ ok: true });
  } catch (e) {
    logServerError(e as Error, { route: "/api/auth/reset" });
    return jsonError("Unable to reset password", 500);
  }
}
