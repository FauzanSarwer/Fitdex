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
  const role = (session!.user as { role?: string }).role;
  if (role === "ADMIN") {
    return NextResponse.json({
      subscription: {
        id: `admin_${uid}`,
        ownerId: uid,
        plan: "PRO",
        status: "ACTIVE",
        startsAt: new Date(0),
        expiresAt: new Date("2999-12-31"),
        createdAt: new Date(0),
        updatedAt: new Date(),
        adminAccess: true,
      },
    });
  }
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
