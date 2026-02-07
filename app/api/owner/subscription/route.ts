import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/permissions";
import { jsonError } from "@/lib/api";
import { logServerError } from "@/lib/logger";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  try {
    const now = new Date();
    const active = await prisma.ownerSubscription.findFirst({
      where: { ownerId: uid, status: "ACTIVE", expiresAt: { gt: now } },
      orderBy: { expiresAt: "desc" },
    });
    const latest = await prisma.ownerSubscription.findFirst({
      where: { ownerId: uid },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({
      subscription: active ?? latest ?? null,
    });
  } catch (error) {
    logServerError(error as Error, { route: "/api/owner/subscription", userId: uid });
    return jsonError("Failed to load subscription", 500);
  }
}
