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
  const uid = (session!.user as { id: string }).id;
  const body = await req.json();
  const { code } = body as { code: string };
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "code required" }, { status: 400 });
  }
  const invite = await prisma.invite.findUnique({
    where: { code: code.trim().toUpperCase(), accepted: false },
    include: { gym: true },
  });
  if (!invite) {
    return NextResponse.json({ error: "Invalid or expired invite" }, { status: 404 });
  }
  const myMembership = await prisma.membership.findFirst({
    where: { userId: uid, gymId: invite.gymId, active: true },
  });
  if (!myMembership) {
    return NextResponse.json(
      { error: "You need an active membership at this gym to join the duo" },
      { status: 400 }
    );
  }
  const inviterMembership = await prisma.membership.findFirst({
    where: { userId: invite.inviterId, gymId: invite.gymId, active: true },
  });
  if (!inviterMembership) {
    return NextResponse.json(
      { error: "Inviter no longer has active membership" },
      { status: 400 }
    );
  }
  const [userOneId, userTwoId] =
    invite.inviterId < uid ? [invite.inviterId, uid] : [uid, invite.inviterId];
  const existing = await prisma.duo.findUnique({
    where: {
      userOneId_userTwoId_gymId: { userOneId, userTwoId, gymId: invite.gymId },
    },
  });
  if (existing) {
    await prisma.invite.update({
      where: { id: invite.id },
      data: { accepted: true },
    });
    return NextResponse.json({ duo: existing, message: "Duo already exists" });
  }
  const duo = await prisma.duo.create({
    data: {
      userOneId,
      userTwoId,
      gymId: invite.gymId,
      active: true,
    },
    include: {
      userOne: { select: { id: true, name: true, email: true } },
      userTwo: { select: { id: true, name: true, email: true } },
      gym: true,
    },
  });
  await prisma.invite.update({
    where: { id: invite.id },
    data: { accepted: true },
  });
  return NextResponse.json({ duo });
}
