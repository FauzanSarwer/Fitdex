import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/permissions";
import { jsonError, safeJson } from "@/lib/api";
import { logServerError } from "@/lib/logger";
import { ensureOwnerInvoiceForTransaction } from "@/lib/invoice-service";

const ELIGIBLE_PLANS = new Set(["STARTER", "PRO"]);

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const parsed = await safeJson<{ membershipId?: string; invoiceType?: "GST" | "NON_GST" }>(req);
  if (!parsed.ok) return jsonError("Invalid JSON body", 400);
  const membershipId = parsed.data.membershipId?.trim();
  const invoiceType = parsed.data.invoiceType;
  if (!membershipId || !invoiceType) return jsonError("membershipId and invoiceType required", 400);
  if (!["GST", "NON_GST"].includes(invoiceType)) return jsonError("Invalid invoiceType", 400);

  try {
    const active = await prisma.ownerSubscription.findFirst({
      where: { ownerId: uid, status: "ACTIVE", expiresAt: { gt: new Date() } },
    });
    if (!active || !ELIGIBLE_PLANS.has(active.plan)) {
      return jsonError("Invoices are available only for paid plans", 403);
    }

    const membership = await prisma.membership.findFirst({
      where: { id: membershipId },
      include: { gym: true },
    });
    if (!membership || membership.gym.ownerId !== uid) {
      return jsonError("Membership not found", 404);
    }
    if (invoiceType === "GST" && (!membership.gym.gstNumber || !membership.gym.gstCertificateUrl)) {
      return jsonError("GST details are required for GST invoices", 400);
    }

    const transaction = await prisma.transaction.findFirst({
      where: { membershipId, paymentStatus: "PAID" },
      orderBy: { createdAt: "desc" },
    });
    if (!transaction) return jsonError("Paid transaction not found", 404);

    const existingInvoice = transaction.invoiceId
      ? await prisma.invoice.findUnique({ where: { id: transaction.invoiceId } })
      : await prisma.invoice.findFirst({ where: { transactionId: transaction.id } });
    if (existingInvoice) return NextResponse.json({ invoice: existingInvoice });

    const invoice = await ensureOwnerInvoiceForTransaction({
      transactionId: transaction.id,
      invoiceType,
    });
    if (!invoice) return jsonError("Invoice could not be generated", 400);

    return NextResponse.json({ invoice });
  } catch (error) {
    logServerError(error as Error, { route: "/api/owner/invoices/membership", userId: uid });
    return jsonError("Failed to generate invoice", 500);
  }
}
