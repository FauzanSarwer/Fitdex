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
    const active = await prisma.ownerSubscription.findFirst({
      where: { ownerId: uid, status: "ACTIVE", expiresAt: { gt: new Date() } },
    });
    if (!active || !["STARTER", "PRO"].includes(active.plan)) {
      return NextResponse.json({ error: "Invoices are available only for paid plans" }, { status: 403 });
    }
    const invoices = await prisma.invoice.findMany({
      where: { ownerId: uid },
      orderBy: { issuedAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ invoices });
  } catch (error) {
    logServerError(error as Error, { route: "/api/owner/invoices", userId: uid });
    return jsonError("Failed to load invoices", 500);
  }
}
