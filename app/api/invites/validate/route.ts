import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/permissions";
import { jsonError, safeJson } from "@/lib/api";
import { logServerError } from "@/lib/logger";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireUser(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = await safeJson<{ code?: string; gymId?: string }>(req);
  if (!parsed.ok) {
    return jsonError("Invalid JSON body", 400);
  }
  const code = parsed.data.code?.trim();
  const gymId = parsed.data.gymId?.trim();
  if (!code || !gymId) {
    return jsonError("code and gymId required", 400);
  }
  try {
    const invite = await prisma.invite.findFirst({
      where: {
        gymId,
        code: code.toUpperCase(),
        accepted: false,
      },
      include: {
        inviter: { select: { name: true } },
        gym: { select: { name: true, partnerDiscountPercent: true } },
      },
    });
    if (!invite) {
      return NextResponse.json({
        valid: false,
        message: "Invalid or expired invite code",
      });
    }
    return NextResponse.json({
      valid: true,
      inviterName: invite.inviter?.name ?? "Partner",
      gymName: invite.gym?.name,
      partnerDiscountPercent: invite.gym?.partnerDiscountPercent ?? 0,
      message: `${invite.inviter?.name ?? "Partner"} invited you — ${invite.gym?.partnerDiscountPercent ?? 0}% partner discount applied`,
    });
  } catch (error) {
    logServerError(error as Error, { route: "/api/invites/validate" });
    return jsonError("Failed to validate invite", 500);
  }
}
