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
  const uid = (session!.user as { id: string }).id;
  const parsed = await safeJson<{ membershipId?: string }>(req);
  if (!parsed.ok) {
    return jsonError("Invalid JSON body", 400);
  }
  const membershipId = parsed.data.membershipId?.trim();
  if (!membershipId) {
    return jsonError("membershipId required", 400);
  }
  try {
    const membership = await prisma.membership.findFirst({
      where: { id: membershipId, userId: uid },
    });
    if (!membership) {
      return jsonError("Membership not found", 404);
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
  } catch (error) {
    logServerError(error as Error, { route: "/api/memberships/cancel", userId: uid });
    return jsonError("Failed to cancel membership", 500);
  }
}
