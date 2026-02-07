import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/permissions";
import { jsonError, safeJson } from "@/lib/api";
import { logServerError } from "@/lib/logger";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireUser(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = await safeJson<{ gymId?: string; code?: string }>(req);
  if (!parsed.ok) {
    return jsonError("Invalid JSON body", 400);
  }
  const gymId = parsed.data.gymId?.trim();
  const code = parsed.data.code?.trim();
  if (!gymId || !code) {
    return jsonError("gymId and code required", 400);
  }
  try {
    const discountCode = await prisma.discountCode.findFirst({
      where: {
        gymId,
        code,
        validFrom: { lte: new Date() },
        validUntil: { gte: new Date() },
      },
    });
    if (!discountCode || discountCode.usedCount >= discountCode.maxUses) {
      return NextResponse.json({
        valid: false,
        discountPercent: 0,
        message: "Invalid or expired code",
      });
    }
    return NextResponse.json({
      valid: true,
      discountPercent: discountCode.discountPercent,
      message: `${discountCode.discountPercent}% off applied`,
    });
  } catch (error) {
    logServerError(error as Error, { route: "/api/discount-codes/validate" });
    return jsonError("Failed to validate discount code", 500);
  }
}
