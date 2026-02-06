import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/permissions";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireUser(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const { gymId, code } = body as { gymId: string; code: string };
  if (!gymId || !code || typeof code !== "string") {
    return NextResponse.json(
      { error: "gymId and code required" },
      { status: 400 }
    );
  }
  const discountCode = await prisma.discountCode.findFirst({
    where: {
      gymId,
      code: code.trim(),
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
}
