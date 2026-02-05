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
  const { membershipId } = body as { membershipId: string };
  if (!membershipId) {
    return NextResponse.json(
      { error: "membershipId required" },
      { status: 400 }
    );
  }
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, userId: uid },
  });
  if (!membership) {
    return NextResponse.json({ error: "Membership not found" }, { status: 404 });
  }
  await prisma.membership.update({
    where: { id: membershipId },
    data: { active: false },
  });
  await prisma.duo.updateMany({
    where: {
      gymId: membership.gymId,
      OR: [{ userOneId: uid }, { userTwoId: uid }],
    },
    data: { active: false },
  });
  return NextResponse.json({ success: true });
}
