import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/permissions";
import { jsonError } from "@/lib/api";
import { logServerError } from "@/lib/logger";
import { generateOwnerInvoicePdfBuffer } from "@/lib/invoice";

export async function GET(_req: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const { invoiceId } = await params;
  if (!invoiceId) return jsonError("invoiceId required", 400);

  try {
    const { searchParams } = new URL(_req.url);
    const layoutParam = searchParams.get("layout")?.toUpperCase();
    const layout = layoutParam === "THERMAL" ? "THERMAL" : "A4";
    const disposition = searchParams.get("disposition") === "inline" ? "inline" : "attachment";
    const active = await prisma.ownerSubscription.findFirst({
      where: { ownerId: uid, status: "ACTIVE", expiresAt: { gt: new Date() } },
    });
    if (!active || !["STARTER", "PRO"].includes(active.plan)) {
      return NextResponse.json({ error: "Invoices are available only for paid plans" }, { status: 403 });
    }
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, ownerId: uid },
      include: { items: true, taxes: true },
    });
    if (!invoice) return jsonError("Invoice not found", 404);

    const buffer = await generateOwnerInvoicePdfBuffer({
      invoiceNumber: invoice.invoiceNumber,
      issuedAt: invoice.issuedAt,
      gymName: invoice.gymName,
      gymAddress: invoice.gymAddress,
      gymGstNumber: invoice.gymGstNumber ?? invoice.gstNumber,
      memberName: invoice.memberName,
      memberEmail: invoice.memberEmail,
      items: invoice.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      })),
      taxes: invoice.taxes.map((tax) => ({
        label: tax.taxType,
        rate: tax.rate,
        amount: tax.amount,
      })),
      subtotal: invoice.subtotal,
      taxTotal: invoice.taxTotal,
      total: invoice.total,
      layout,
    });

    const body = new Uint8Array(buffer);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename=${invoice.invoiceNumber}.pdf`,
      },
    });
  } catch (error) {
    logServerError(error as Error, { route: "/api/owner/invoices/[invoiceId]", userId: uid });
    return jsonError("Failed to generate invoice", 500);
  }
}
