import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/permissions";
import { jsonError } from "@/lib/api";
import { logServerError } from "@/lib/logger";
import { generateInvoicePdfBuffer } from "@/lib/invoice";

export async function GET(_req: Request, { params }: { params: Promise<{ transactionId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!requireUser(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const { transactionId } = await params;
  if (!transactionId) return jsonError("transactionId required", 400);

  try {
    const tx = await prisma.transaction.findFirst({
      where: { id: transactionId, userId: uid },
      include: { gym: true },
    });
    if (!tx) return jsonError("Transaction not found", 404);
    if (tx.paymentStatus !== "PAID") return jsonError("Invoice available after payment", 400);

    const now = new Date(tx.createdAt);
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const suffix = tx.id.slice(-4).toUpperCase();
    const invoiceNumber = `USR-${y}${m}-${suffix}`;

    const buffer = await generateInvoicePdfBuffer({
      invoiceNumber,
      issuedAt: now,
      gymName: tx.gym?.name ?? "Fitdex",
      gstNumber: null,
      amount: tx.totalAmount,
    });

    const body = new Uint8Array(buffer);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=${invoiceNumber}.pdf`,
      },
    });
  } catch (error) {
    logServerError(error as Error, { route: "/api/user/invoices/[transactionId]", userId: uid });
    return jsonError("Failed to generate invoice", 500);
  }
}
