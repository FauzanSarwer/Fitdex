import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/permissions";
import { jsonError } from "@/lib/api";
import { logServerError } from "@/lib/logger";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const { searchParams } = new URL(req.url);
  const gymId = searchParams.get("gymId");
  if (!gymId) {
    return jsonError("gymId required", 400);
  }
  try {
    const gym = await prisma.gym.findFirst({
      where: { id: gymId, ownerId: uid },
    });
    if (!gym) {
      return jsonError("Gym not found", 404);
    }
    const memberships = await prisma.membership.findMany({
      where: { gymId, active: true },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json({ members: memberships });
  } catch (error) {
    logServerError(error as Error, { route: "/api/owner/members", userId: uid });
    return jsonError("Failed to load members", 500);
  }
}
