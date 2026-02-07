import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/permissions";
import { jsonError, safeJson } from "@/lib/api";
import { logServerError } from "@/lib/logger";
import { verifyBankAccount } from "@/lib/bank-verification";

const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const parsed = await safeJson<{
    gymId?: string;
    accountNumber?: string;
    ifsc?: string;
    accountHolderName?: string;
  }>(req);
  if (!parsed.ok) {
    return jsonError("Invalid JSON body", 400);
  }
  const gymId = parsed.data.gymId?.trim();
  const accountNumber = parsed.data.accountNumber?.trim();
  const ifsc = parsed.data.ifsc?.trim().toUpperCase();
  if (!gymId || !accountNumber || !ifsc) {
    return jsonError("gymId, accountNumber, ifsc required", 400);
  }
  if (!IFSC_REGEX.test(ifsc)) {
    return jsonError("Invalid IFSC code", 400);
  }
  try {
    const gym = await prisma.gym.findFirst({ where: { id: gymId, ownerId: uid } });
    if (!gym) {
      return jsonError("Gym not found", 404);
    }
    const result = await verifyBankAccount({
      accountNumber,
      ifsc,
      accountHolderName: parsed.data.accountHolderName,
    });
    if (!result.verified) {
      await prisma.gym.update({
        where: { id: gymId },
        data: {
          bankAccountVerified: false,
          bankAccountLast4: accountNumber.slice(-4),
          verificationStatus: "PENDING",
          verificationNotes: "Bank verification failed",
        },
      });
      return jsonError("Bank verification failed", 400);
    }
    const shouldVerify = gym.gstVerifiedAt && gym.razorpaySubAccountId;
    const updated = await prisma.gym.update({
      where: { id: gymId },
      data: {
        bankAccountVerified: true,
        bankAccountLast4: accountNumber.slice(-4),
        verificationStatus: shouldVerify ? "VERIFIED" : "PENDING",
        verificationNotes: null,
      },
    });
    return NextResponse.json({
      ok: true,
      verificationStatus: updated.verificationStatus,
      bankAccountVerified: updated.bankAccountVerified,
    });
  } catch (error) {
    logServerError(error as Error, { route: "/api/owner/gym/verification/bank", userId: uid });
    return jsonError("Failed to verify bank account", 500);
  }
}
