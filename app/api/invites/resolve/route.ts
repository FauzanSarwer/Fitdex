import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "code required" }, { status: 400 });
  }
  const invite = await prisma.invite.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: {
      gym: { select: { id: true, name: true, partnerDiscountPercent: true } },
      inviter: { select: { name: true } },
    },
  });
  if (!invite) {
    return NextResponse.json({ error: "Invalid invite" }, { status: 404 });
  }
  return NextResponse.json({
    code: invite.code,
    gymId: invite.gymId,
    gymName: invite.gym?.name,
    inviterName: invite.inviter?.name ?? "Partner",
    partnerDiscountPercent: invite.gym?.partnerDiscountPercent ?? 0,
  });
}
