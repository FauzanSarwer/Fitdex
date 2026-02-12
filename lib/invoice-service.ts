import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/logger";

export type InvoiceTaxMode = "CGST_SGST" | "IGST" | "NONE";
export type InvoiceType = "GST" | "NON_GST";

const GST_RATE = 18;
const PAID_PLANS = new Set(["STARTER", "PRO"]);

const normalizeState = (value?: string | null) => value?.trim().toLowerCase() ?? "";

export function determineTaxMode(gymState?: string | null, memberState?: string | null): InvoiceTaxMode {
  const gym = normalizeState(gymState);
  const member = normalizeState(memberState);
  if (!gym || !member) return "IGST";
  return gym === member ? "CGST_SGST" : "IGST";
}

export function calculateGstBreakdown(total: number, rate: number, taxMode: InvoiceTaxMode) {
  const divisor = 1 + rate / 100;
  const base = Math.round(total / divisor);
  const taxTotal = Math.max(total - base, 0);
  if (taxMode === "CGST_SGST") {
    const half = Math.floor(taxTotal / 2);
    return {
      base,
      taxTotal,
      taxes: [
        { type: "CGST", rate: rate / 2, amount: half },
        { type: "SGST", rate: rate / 2, amount: taxTotal - half },
      ],
    } as const;
  }
  if (taxMode === "IGST") {
    return {
      base,
      taxTotal,
      taxes: [{ type: "IGST", rate, amount: taxTotal }],
    } as const;
  }
  return { base: total, taxTotal: 0, taxes: [] } as const;
}

export function formatGymInvoiceNumber(gymId: string, issuedAt: Date, sequence: number) {
  const y = issuedAt.getFullYear();
  const m = String(issuedAt.getMonth() + 1).padStart(2, "0");
  const gymCode = gymId.slice(-4).toUpperCase();
  const seq = String(sequence).padStart(5, "0");
  return `INV-${gymCode}-${y}${m}-${seq}`;
}

export async function getActiveOwnerPlan(ownerId: string) {
  return prisma.ownerSubscription.findFirst({
    where: { ownerId, status: "ACTIVE", expiresAt: { gt: new Date() } },
  });
}

export async function ensureOwnerInvoiceForTransaction(params: {
  transactionId: string;
  invoiceType?: InvoiceType;
  allowSkip?: boolean;
}) {
  const { transactionId, invoiceType, allowSkip } = params;
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      gym: true,
      user: true,
      membership: true,
    },
  });
  if (!transaction || transaction.paymentStatus !== "PAID") {
    return null;
  }
  if (transaction.invoiceId) {
    return prisma.invoice.findUnique({ where: { id: transaction.invoiceId } });
  }

  const gym = transaction.gym;
  const ownerId = gym.ownerId;
  const subscription = await getActiveOwnerPlan(ownerId);
  if (!subscription || !PAID_PLANS.has(subscription.plan)) {
    return null;
  }

  const selectedType = invoiceType ?? gym.invoiceTypeDefault ?? null;
  if (!selectedType) {
    if (allowSkip) return null;
    throw new Error("Invoice type is required");
  }

  const issuedAt = new Date(transaction.createdAt);
  const memberState = transaction.user?.state ?? null;
  const taxMode = selectedType === "GST" ? determineTaxMode(gym.state, memberState) : "NONE";

  if (selectedType === "GST" && (!gym.gstNumber || !gym.gstCertificateUrl)) {
    if (allowSkip) return null;
    throw new Error("GST details are required for GST invoices");
  }

  const totalAmount = transaction.totalAmount;
  const taxBreakdown = selectedType === "GST"
    ? calculateGstBreakdown(totalAmount, GST_RATE, taxMode)
    : { base: totalAmount, taxTotal: 0, taxes: [] };

  const itemDescription = `${transaction.membership?.planType ?? "Membership"} membership`;

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.invoiceSequence.upsert({
        where: { gymId: gym.id },
        create: { gymId: gym.id, lastNumber: 0 },
        update: {},
      });
      const updatedSequence = await tx.invoiceSequence.update({
        where: { gymId: gym.id },
        data: { lastNumber: { increment: 1 } },
      });
      const invoiceNumber = formatGymInvoiceNumber(gym.id, issuedAt, updatedSequence.lastNumber);

      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          ownerId,
          gymId: gym.id,
          userId: transaction.userId,
          membershipId: transaction.membershipId,
          transactionId: transaction.id,
          invoiceType: selectedType,
          taxMode,
          gstRate: selectedType === "GST" ? GST_RATE : null,
          subtotal: taxBreakdown.base,
          taxTotal: taxBreakdown.taxTotal,
          total: totalAmount,
          amount: totalAmount,
          currency: "INR",
          gymName: gym.name,
          gymAddress: gym.address,
          gymCity: gym.city,
          gymState: gym.state,
          gymGstNumber: gym.gstNumber,
          memberName: transaction.user?.name ?? null,
          memberEmail: transaction.user?.email ?? null,
          memberState,
          gstNumber: selectedType === "GST" ? gym.gstNumber : null,
          status: "ISSUED",
          issuedAt,
        },
      });

      await tx.invoiceItem.create({
        data: {
          invoiceId: invoice.id,
          description: itemDescription,
          quantity: 1,
          unitPrice: taxBreakdown.base,
          total: taxBreakdown.base,
        },
      });

      if (selectedType === "GST") {
        await tx.invoiceTax.createMany({
          data: taxBreakdown.taxes.map((t) => ({
            invoiceId: invoice.id,
            taxType: t.type,
            rate: t.rate,
            amount: t.amount,
          })),
        });
      }

      await tx.transaction.update({
        where: { id: transaction.id },
        data: { invoiceId: invoice.id },
      });

      return invoice;
    });
  } catch (error) {
    logServerError(error as Error, { scope: "invoice/create", transactionId });
    if (allowSkip) return null;
    throw error;
  }
}
