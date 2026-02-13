import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { jsonError, safeJson } from "@/lib/api";
import { createEmailVerificationLinks, verifyEmailToken } from "@/lib/email-verification";
import { sendVerificationEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/logger";
import { randomBytes } from "crypto";

const RESEND_PURPOSE = "VERIFY_RESEND";
const RESEND_COOLDOWN_SECONDS = 30;
const RESEND_DAILY_LIMIT = 5;
const DAY_WINDOW_MS = 24 * 60 * 60 * 1000;

type VerificationUser = {
  id: string;
  email: string | null;
  emailVerified: Date | null;
};

async function getVerificationUser(uid: string): Promise<VerificationUser | null> {
  return prisma.user.findUnique({
    where: { id: uid },
    select: { id: true, email: true, emailVerified: true },
  });
}

async function getResendState(userId: string, now = new Date()) {
  const windowStart = new Date(now.getTime() - DAY_WINDOW_MS);
  const [lastSent, dailyResendCount] = await prisma.$transaction([
    prisma.emailVerificationToken.findFirst({
      where: { userId, purpose: RESEND_PURPOSE, createdAt: { gte: windowStart } },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.emailVerificationToken.count({
      where: { userId, purpose: RESEND_PURPOSE, createdAt: { gte: windowStart } },
    }),
  ]);

  return {
    lastSentAt: lastSent?.createdAt ?? null,
    dailyResendCount,
    dailyLimit: RESEND_DAILY_LIMIT,
    cooldownSeconds: RESEND_COOLDOWN_SECONDS,
  };
}

function serializeResendState(state: {
  lastSentAt: Date | null;
  dailyResendCount: number;
  dailyLimit: number;
  cooldownSeconds: number;
}) {
  return {
    lastSentAt: state.lastSentAt ? state.lastSentAt.toISOString() : null,
    dailyResendCount: state.dailyResendCount,
    dailyLimit: state.dailyLimit,
    cooldownSeconds: state.cooldownSeconds,
  };
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await safeJson<{ resend?: boolean }>(req);
  const uid = (session.user as { id: string }).id;
  try {
    const user = await getVerificationUser(uid);
    if (!user?.email) {
      return jsonError("Email not found", 400);
    }
    const now = new Date();
    const resendState = await getResendState(uid, now);
    if (user.emailVerified) {
      return NextResponse.json({
        ok: true,
        message: "Email already verified",
        emailVerified: true,
        resend: serializeResendState(resendState),
      });
    }

    if (resendState.dailyResendCount >= RESEND_DAILY_LIMIT) {
      return NextResponse.json(
        {
          ok: false,
          error: "Please try again in 24 hours",
          resend: serializeResendState(resendState),
        },
        { status: 429 }
      );
    }

    if (resendState.lastSentAt) {
      const secondsSinceLastSend = (now.getTime() - resendState.lastSentAt.getTime()) / 1000;
      if (secondsSinceLastSend < RESEND_COOLDOWN_SECONDS) {
        return NextResponse.json(
          {
            ok: false,
            error: "Please wait before resending",
            resend: serializeResendState(resendState),
          },
          { status: 429 }
        );
      }
    }

    const links = await createEmailVerificationLinks(user.id, user.email, req);
    await sendVerificationEmail(user.email, links.verifyUrl, links.deleteUrl);
    await prisma.emailVerificationToken.create({
      data: {
        userId: uid,
        tokenHash: `resend-${randomBytes(20).toString("hex")}`,
        purpose: RESEND_PURPOSE,
        expiresAt: new Date(now.getTime() + DAY_WINDOW_MS),
      },
    });

    const updatedState = {
      ...resendState,
      lastSentAt: now,
      dailyResendCount: resendState.dailyResendCount + 1,
    };
    return NextResponse.json({ ok: true, resend: serializeResendState(updatedState) });
  } catch (error) {
    logServerError(error as Error, { route: "/api/auth/verify", userId: uid });
    return jsonError("Unable to start verification", 500);
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token")?.trim();
  const statusRequested = searchParams.get("status") === "1";
  if (!token) {
    if (!statusRequested) {
      return jsonError("Token required", 400);
    }
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const uid = (session.user as { id: string }).id;
    try {
      const user = await getVerificationUser(uid);
      if (!user) {
        return jsonError("User not found", 404);
      }
      const resendState = await getResendState(uid);
      return NextResponse.json({
        ok: true,
        emailVerified: !!user.emailVerified,
        resend: serializeResendState(resendState),
      });
    } catch (error) {
      logServerError(error as Error, { route: "/api/auth/verify", userId: uid, action: "status" });
      return jsonError("Unable to fetch verification status", 500);
    }
  }

  const action = (searchParams.get("action")?.trim() || "verify") as "verify" | "delete";

  try {
    const result = await verifyEmailToken(token, action);
    if (!result.ok) {
      return jsonError(result.error ?? "Invalid token", 400);
    }
    return NextResponse.json({ ok: true, action: result.action });
  } catch (error) {
    logServerError(error as Error, { route: "/api/auth/verify" });
    return jsonError("Unable to verify token", 500);
  }
}
