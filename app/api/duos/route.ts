import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/permissions";
import { jsonError, safeJson } from "@/lib/api";
import { logServerError } from "@/lib/logger";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!requireUser(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const emailVerified = !!(session!.user as { emailVerified?: boolean }).emailVerified;
  const role = (session!.user as { role?: string }).role;
  const isAdmin = role === "ADMIN";
  if (!emailVerified && !isAdmin) {
    return jsonError("Please verify your email to continue", 403);
  }
  const uid = (session!.user as { id: string }).id;
  try {
    const duos = await prisma.duo.findMany({
      where: { OR: [{ userOneId: uid }, { userTwoId: uid }] },
      select: {
        id: true,
        active: true,
        gym: { select: { id: true, name: true } },
        userOne: { select: { id: true, name: true } },
        userTwo: { select: { id: true, name: true } },
      },
    });
    const invites = await prisma.invite.findMany({
      where: { inviterId: uid },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        accepted: true,
        createdAt: true,
        gym: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json({ duos, invites });
  } catch (error) {
    logServerError(error as Error, { route: "/api/duos", userId: uid });
    return jsonError("Failed to load duos", 500);
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireUser(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const parsed = await safeJson<{
    email?: string;
    gymId?: string;
    joinTogether?: boolean;
  }>(req);
  if (!parsed.ok) {
    return jsonError("Invalid JSON body", 400);
  }
  const gymId = parsed.data.gymId?.trim();
  const email = parsed.data.email?.trim();
  const joinTogether = parsed.data.joinTogether === true;
  if (!gymId) {
    return jsonError("gymId required", 400);
  }
  try {
    const myMembership = await prisma.membership.findFirst({
      where: { userId: uid, gymId, active: true },
    });
    if (!myMembership && !joinTogether) {
      return jsonError(
        "You need an active membership to invite. Or use joinTogether for inviting a partner to join with you.",
        400
      );
    }
    const code = Math.random().toString(36).slice(2, 10).toUpperCase();
    await prisma.invite.create({
      data: {
        email: email ? email.toLowerCase() : "",
        code,
        gymId,
        inviterId: uid,
      },
    });
    if (email) {
      return NextResponse.json({
        message: "Invite sent",
        code,
        email: email.toLowerCase(),
      });
    }
    return NextResponse.json({ code, message: "Invite code created" });
  } catch (error) {
    logServerError(error as Error, { route: "/api/duos", userId: uid });
    return jsonError("Failed to create invite", 500);
  }
}
