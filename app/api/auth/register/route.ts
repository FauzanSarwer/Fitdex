import { NextResponse } from "next/server";
import { ratelimit } from "@/lib/rate-limit";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRequiredEnv } from "@/lib/env";
import bcrypt from "bcryptjs";
import { jsonError, safeJson } from "@/lib/api";
import { logServerError } from "@/lib/logger";

const passwordPepper = getRequiredEnv("PASSWORD_PEPPER", { allowEmptyInDev: true });

export async function POST(req: Request) {
    const ip =
      req.headers.get("x-forwarded-for") ??
      req.headers.get("x-real-ip") ??
      "anonymous";

    const { success } = await ratelimit.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }
  try {
    const parsed = await safeJson<{
      email?: string;
      password?: string;
      name?: string;
      role?: string;
    }>(req);
    if (!parsed.ok) {
      return jsonError("Invalid JSON body", 400);
    }
    const { email, password, name, role } = parsed.data;
    if (!email || !password || !name?.trim()) {
      return jsonError("Name, email, and password required", 400);
    }
    if (password.length < 8) {
      return jsonError("Password must be at least 8 characters", 400);
    }
    const validRole = ["USER", "OWNER"].includes(role ?? "USER") ? (role ?? "USER") : "USER";
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (existing) {
      return jsonError("Email already registered", 400);
    }
    const hashed = await bcrypt.hash(`${password}${passwordPepper}`, 12);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        password: hashed,
        name: name?.trim() || null,
        role: validRole,
      },
    });
    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  } catch (e) {
    logServerError(e as Error, { route: "/api/auth/register" });
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        return jsonError("Email already registered", 409);
      }
    }
    if (e instanceof Prisma.PrismaClientInitializationError) {
      return jsonError("Database unavailable. Check DATABASE_URL or run migrations.", 500);
    }
    return jsonError("Registration failed", 500);
  }
}
