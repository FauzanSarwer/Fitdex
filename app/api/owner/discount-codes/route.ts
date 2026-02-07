import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/permissions";
import { jsonError, safeJson } from "@/lib/api";
import { logServerError } from "@/lib/logger";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const gymId = searchParams.get("gymId");
  if (!gymId) {
    return jsonError("gymId required", 400);
  }
  const uid = (session!.user as { id: string }).id;
  try {
    const gym = await prisma.gym.findFirst({
      where: { id: gymId, ownerId: uid },
    });
    if (!gym) {
      return jsonError("Gym not found", 404);
    }
    const codes = await prisma.discountCode.findMany({
      where: { gymId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ codes });
  } catch (error) {
    logServerError(error as Error, { route: "/api/owner/discount-codes", userId: uid });
    return jsonError("Failed to load discount codes", 500);
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const parsed = await safeJson<{
    gymId?: string;
    code?: string;
    discountType?: "PERCENT" | "FLAT";
    discountValue?: number;
    maxUses?: number;
    validUntil?: string;
  }>(req);
  if (!parsed.ok) {
    return jsonError("Invalid JSON body", 400);
  }
  const gymId = parsed.data.gymId?.trim();
  const code = parsed.data.code?.trim();
  const discountType = parsed.data.discountType ?? "PERCENT";
  const discountValue = parsed.data.discountValue;
  const maxUses = parsed.data.maxUses;
  const validUntil = parsed.data.validUntil;
  if (!gymId || !code || discountValue == null) {
    return jsonError("gymId, code, discountValue required", 400);
  }
  if (discountType === "PERCENT" && (discountValue <= 0 || discountValue > 100)) {
    return jsonError("discountValue must be between 1 and 100 for percent", 400);
  }
  if (discountType === "FLAT" && discountValue <= 0) {
    return jsonError("discountValue must be greater than 0 for flat", 400);
  }
  try {
    const gym = await prisma.gym.findFirst({
      where: { id: gymId, ownerId: uid },
    });
    if (!gym) {
      return jsonError("Gym not found", 404);
    }
    const validUntilDate = validUntil
      ? new Date(validUntil)
      : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const created = await prisma.discountCode.create({
      data: {
        gymId,
        code: code.toUpperCase(),
        discountType,
        discountValue: Number(discountValue),
        maxUses: Number(maxUses ?? 100),
        validUntil: validUntilDate,
      },
    });
    return NextResponse.json({ code: created });
  } catch (error) {
    logServerError(error as Error, { route: "/api/owner/discount-codes", userId: uid });
    return jsonError("Failed to create discount code", 500);
  }
}
