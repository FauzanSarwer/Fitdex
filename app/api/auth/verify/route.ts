import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { jsonError, safeJson } from "@/lib/api";
import { createEmailVerificationLinks, verifyEmailToken } from "@/lib/email-verification";
import { sendVerificationEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/logger";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = await safeJson<{ resend?: boolean }>(req);
  const _payload = parsed.ok ? parsed.data : {};
  const uid = (session.user as { id: string }).id;
  try {
    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { id: true, email: true, emailVerified: true },
    });
    if (!user?.email) {
      return jsonError("Email not found", 400);
    }
    if (user.emailVerified) {
      return NextResponse.json({ ok: true, message: "Email already verified" });
    }
    const links = await createEmailVerificationLinks(user.id, user.email, req);
    await sendVerificationEmail(user.email, links.verifyUrl, links.deleteUrl);
    return NextResponse.json({ ok: true, ...links });
  } catch (error) {
    logServerError(error as Error, { route: "/api/auth/verify", userId: uid });
    return jsonError("Unable to start verification", 500);
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token")?.trim();
  const action = (searchParams.get("action")?.trim() || "verify") as "verify" | "delete";

  if (!token) {
    return jsonError("Token required", 400);
  }

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
