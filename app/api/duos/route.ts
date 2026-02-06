import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/permissions";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!requireUser(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const duos = await prisma.duo.findMany({
    where: { OR: [{ userOneId: uid }, { userTwoId: uid }] },
    include: {
      gym: true,
      userOne: { select: { id: true, name: true, email: true } },
      userTwo: { select: { id: true, name: true, email: true } },
    },
  });
  return NextResponse.json({ duos });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireUser(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const body = await req.json();
  const { email, gymId, joinTogether } = body as {
    email?: string;
    gymId: string;
    joinTogether?: boolean; // true = invite for joining together (no membership required)
  };
  if (!gymId) {
    return NextResponse.json({ error: "gymId required" }, { status: 400 });
  }
  const myMembership = await prisma.membership.findFirst({
    where: { userId: uid, gymId, active: true },
  });
  if (!myMembership && !joinTogether) {
    return NextResponse.json(
      { error: "You need an active membership to invite. Or use joinTogether for inviting a partner to join with you." },
      { status: 400 }
    );
  }
  if (email) {
    const code = Math.random().toString(36).slice(2, 10).toUpperCase();
    await prisma.invite.create({
      data: {
        email: email.toLowerCase().trim(),
        code,
        gymId,
        inviterId: uid,
      },
    });
    return NextResponse.json({
      message: "Invite sent",
      code,
      email: email.toLowerCase().trim(),
    });
  }
  const code = Math.random().toString(36).slice(2, 10).toUpperCase();
  await prisma.invite.create({
    data: {
      email: "",
      code,
      gymId,
      inviterId: uid,
    },
  });
  return NextResponse.json({ code, message: "Invite code created" });
}
