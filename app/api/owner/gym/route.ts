import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/permissions";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const gyms = await prisma.gym.findMany({
    where: { ownerId: uid },
    include: {
      _count: {
        select: { memberships: true, duos: true },
      },
    },
  });
  return NextResponse.json({ gyms });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const body = await req.json();
  const {
    name,
    address,
    latitude,
    longitude,
    monthlyPrice,
    yearlyPrice,
    partnerDiscountPercent,
    yearlyDiscountPercent,
    welcomeDiscountPercent,
    maxDiscountCapPercent,
  } = body as {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    monthlyPrice: number;
    yearlyPrice: number;
    partnerDiscountPercent?: number;
    yearlyDiscountPercent?: number;
    welcomeDiscountPercent?: number;
    maxDiscountCapPercent?: number;
  };
  if (!name || !address || latitude == null || longitude == null || monthlyPrice == null || yearlyPrice == null) {
    return NextResponse.json(
      { error: "name, address, latitude, longitude, monthlyPrice, yearlyPrice required" },
      { status: 400 }
    );
  }
  const gym = await prisma.gym.create({
    data: {
      ownerId: uid,
      name,
      address,
      latitude: Number(latitude),
      longitude: Number(longitude),
      monthlyPrice: Number(monthlyPrice),
      yearlyPrice: Number(yearlyPrice),
      partnerDiscountPercent: Number(partnerDiscountPercent ?? 10),
      yearlyDiscountPercent: Number(yearlyDiscountPercent ?? 15),
      welcomeDiscountPercent: Number(welcomeDiscountPercent ?? 10),
      maxDiscountCapPercent: Number(maxDiscountCapPercent ?? 40),
    },
  });
  return NextResponse.json({ gym });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const body = await req.json();
  const { gymId, ...data } = body as {
    gymId: string;
    name?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    monthlyPrice?: number;
    yearlyPrice?: number;
    partnerDiscountPercent?: number;
    yearlyDiscountPercent?: number;
    welcomeDiscountPercent?: number;
    maxDiscountCapPercent?: number;
  };
  if (!gymId) {
    return NextResponse.json({ error: "gymId required" }, { status: 400 });
  }
  const existing = await prisma.gym.findFirst({
    where: { id: gymId, ownerId: uid },
  });
  if (!existing) {
    return NextResponse.json({ error: "Gym not found" }, { status: 404 });
  }
  const update: Record<string, unknown> = {};
  if (data.name != null) update.name = data.name;
  if (data.address != null) update.address = data.address;
  if (data.latitude != null) update.latitude = data.latitude;
  if (data.longitude != null) update.longitude = data.longitude;
  if (data.monthlyPrice != null) update.monthlyPrice = data.monthlyPrice;
  if (data.yearlyPrice != null) update.yearlyPrice = data.yearlyPrice;
  if (data.partnerDiscountPercent != null) update.partnerDiscountPercent = data.partnerDiscountPercent;
  if (data.yearlyDiscountPercent != null) update.yearlyDiscountPercent = data.yearlyDiscountPercent;
  if (data.welcomeDiscountPercent != null) update.welcomeDiscountPercent = data.welcomeDiscountPercent;
  if (data.maxDiscountCapPercent != null) update.maxDiscountCapPercent = data.maxDiscountCapPercent;
  const gym = await prisma.gym.update({
    where: { id: gymId },
    data: update,
  });
  return NextResponse.json({ gym });
}
