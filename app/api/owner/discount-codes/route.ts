import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/permissions";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const gymId = searchParams.get("gymId");
  if (!gymId) {
    return NextResponse.json({ error: "gymId required" }, { status: 400 });
  }
  const uid = (session!.user as { id: string }).id;
  const gym = await prisma.gym.findFirst({
    where: { id: gymId, ownerId: uid },
  });
  if (!gym) {
    return NextResponse.json({ error: "Gym not found" }, { status: 404 });
  }
  const codes = await prisma.discountCode.findMany({
    where: { gymId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ codes });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const body = await req.json();
  const { gymId, code, discountPercent, maxUses, validUntil } = body as {
    gymId: string;
    code: string;
    discountPercent: number;
    maxUses?: number;
    validUntil: string;
  };
  if (!gymId || !code || discountPercent == null) {
    return NextResponse.json(
      { error: "gymId, code, discountPercent required" },
      { status: 400 }
    );
  }
  const gym = await prisma.gym.findFirst({
    where: { id: gymId, ownerId: uid },
  });
  if (!gym) {
    return NextResponse.json({ error: "Gym not found" }, { status: 404 });
  }
  const validUntilDate = validUntil ? new Date(validUntil) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  const created = await prisma.discountCode.create({
    data: {
      gymId,
      code: code.trim().toUpperCase(),
      discountPercent: Number(discountPercent),
      maxUses: Number(maxUses ?? 100),
      validUntil: validUntilDate,
    },
  });
  return NextResponse.json({ code: created });
}
