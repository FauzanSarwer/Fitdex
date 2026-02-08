import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/permissions";
import { jsonError } from "@/lib/api";
import { logServerError } from "@/lib/logger";

const ELIGIBLE_PLANS = new Set(["STARTER", "PRO"]);

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const { searchParams } = new URL(req.url);
  const invoiceNumber = searchParams.get("invoiceNumber")?.trim();
  if (!invoiceNumber) return jsonError("invoiceNumber required", 400);

  try {
    const active = await prisma.ownerSubscription.findFirst({
      where: { ownerId: uid, status: "ACTIVE", expiresAt: { gt: new Date() } },
    });
    if (!active || !ELIGIBLE_PLANS.has(active.plan)) {
      return jsonError("Invoices are available only for paid plans", 403);
    }

    const invoice = await prisma.invoice.findFirst({
      where: { ownerId: uid, invoiceNumber },
    });
    if (!invoice) return jsonError("Invoice not found", 404);

    return NextResponse.json({ invoice });
  } catch (error) {
    logServerError(error as Error, { route: "/api/owner/invoices/lookup", userId: uid });
    return jsonError("Failed to lookup invoice", 500);
  }
}
