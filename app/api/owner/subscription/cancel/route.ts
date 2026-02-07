import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/permissions";
import { jsonError } from "@/lib/api";
import { logServerError } from "@/lib/logger";

export async function POST() {
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
    if (!active) {
      return jsonError("No active subscription", 400);
    }
    const updated = await prisma.ownerSubscription.update({
      where: { id: active.id },
      data: { status: "CANCELED" },
    });
    return NextResponse.json({ ok: true, subscription: updated });
  } catch (error) {
    logServerError(error as Error, { route: "/api/owner/subscription/cancel", userId: uid });
    return jsonError("Failed to cancel subscription", 500);
  }
}
