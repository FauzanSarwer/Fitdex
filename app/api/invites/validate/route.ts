import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/permissions";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireUser(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const { code, gymId } = body as { code: string; gymId: string };
  if (!code || !gymId) {
    return NextResponse.json(
      { error: "code and gymId required" },
      { status: 400 }
    );
  }
  const invite = await prisma.invite.findFirst({
    where: {
      gymId,
      code: code.trim().toUpperCase(),
      accepted: false,
    },
    include: {
      inviter: { select: { name: true } },
      gym: { select: { name: true, partnerDiscountPercent: true } }, // <-- Fix: Use comma instead of semicolon
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
}
