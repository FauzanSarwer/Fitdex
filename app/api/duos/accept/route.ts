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
  const emailVerified = !!(session!.user as { emailVerified?: boolean }).emailVerified;
  if (!emailVerified) {
    return jsonError("Please verify your email to continue", 403);
  }
  const uid = (session!.user as { id: string }).id;
  const parsed = await safeJson<{ code?: string }>(req);
  if (!parsed.ok) {
    return jsonError("Invalid JSON body", 400);
  }
  const code = parsed.data.code?.trim();
  if (!code) {
    return jsonError("code required", 400);
  }
  try {
    const invite = await prisma.invite.findUnique({
      where: { code: code.toUpperCase(), accepted: false },
      include: { gym: true },
    });
    if (!invite) {
      return jsonError("Invalid or expired invite", 404);
    }
    const myMembership = await prisma.membership.findFirst({
      where: { userId: uid, gymId: invite.gymId, active: true },
    });
    if (!myMembership) {
      return jsonError(
        "You need an active membership at this gym to join the duo",
        400
      );
    }
    const inviterMembership = await prisma.membership.findFirst({
      where: { userId: invite.inviterId, gymId: invite.gymId, active: true },
    });
    if (!inviterMembership) {
      return jsonError("Inviter no longer has active membership", 400);
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
    await Promise.all([
      prisma.notification.upsert({
        where: {
          userId_type_entityId: {
            userId: invite.inviterId,
            type: "duo_accepted",
            entityId: duo.id,
          },
        },
        update: {},
        create: {
          userId: invite.inviterId,
          type: "duo_accepted",
          entityId: duo.id,
          title: "Duo accepted",
          body: `${duo.userTwo?.name ?? "Your partner"} accepted your duo invite at ${duo.gym.name}.`,
        },
      }),
      prisma.notification.upsert({
        where: {
          userId_type_entityId: {
            userId: uid,
            type: "duo_accepted",
            entityId: duo.id,
          },
        },
        update: {},
        create: {
          userId: uid,
          type: "duo_accepted",
          entityId: duo.id,
          title: "Duo created",
          body: `You are now paired with ${duo.userOne?.name ?? "your partner"} at ${duo.gym.name}.`,
        },
      }),
    ]);
    return NextResponse.json({ duo });
  } catch (error) {
    logServerError(error as Error, { route: "/api/duos/accept", userId: uid });
    return jsonError("Failed to accept invite", 500);
  }
}
