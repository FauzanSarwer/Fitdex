import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/permissions";
import { jsonError, safeJson } from "@/lib/api";
import { logServerError } from "@/lib/logger";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  try {
    const gyms = await prisma.gym.findMany({
      where: { ownerId: uid },
      include: {
        _count: {
          select: { memberships: true, duos: true },
        },
      },
    });
    return NextResponse.json({ gyms });
  } catch (error) {
    logServerError(error as Error, { route: "/api/owner/gym", userId: uid });
    return jsonError("Failed to load gyms", 500);
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const parsed = await safeJson<{
    name?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    openTime?: string | null;
    closeTime?: string | null;
    openDays?: string | null;
    dayPassPrice?: number | null;
    monthlyPrice?: number;
    quarterlyPrice?: number | null;
    yearlyPrice?: number;
    partnerDiscountPercent?: number;
    quarterlyDiscountPercent?: number;
    yearlyDiscountPercent?: number;
    welcomeDiscountPercent?: number;
    maxDiscountCapPercent?: number;
  }>(req);
  if (!parsed.ok) {
    return jsonError("Invalid JSON body", 400);
  }
  const {
    name,
    address,
    latitude,
    longitude,
    openTime,
    closeTime,
    openDays,
    dayPassPrice,
    monthlyPrice,
    quarterlyPrice,
    yearlyPrice,
    partnerDiscountPercent,
    quarterlyDiscountPercent,
    yearlyDiscountPercent,
    welcomeDiscountPercent,
    maxDiscountCapPercent,
  } = parsed.data;
  if (!name || !address || latitude == null || longitude == null || monthlyPrice == null || yearlyPrice == null) {
    return jsonError(
      "name, address, latitude, longitude, monthlyPrice, yearlyPrice required",
      400
    );
  }
  try {
    const gym = await prisma.gym.create({
      data: {
        ownerId: uid,
        name: name.trim(),
        address: address.trim(),
        latitude: Number(latitude),
        longitude: Number(longitude),
        openTime: openTime ?? null,
        closeTime: closeTime ?? null,
        openDays: openDays ?? null,
        dayPassPrice: dayPassPrice != null ? Number(dayPassPrice) : null,
        monthlyPrice: Number(monthlyPrice),
        quarterlyPrice: quarterlyPrice != null ? Number(quarterlyPrice) : null,
        yearlyPrice: Number(yearlyPrice),
        partnerDiscountPercent: Number(partnerDiscountPercent ?? 10),
        quarterlyDiscountPercent: Number(quarterlyDiscountPercent ?? 10),
        yearlyDiscountPercent: Number(yearlyDiscountPercent ?? 15),
        welcomeDiscountPercent: Number(welcomeDiscountPercent ?? 10),
        maxDiscountCapPercent: Number(maxDiscountCapPercent ?? 40),
      },
    });
    return NextResponse.json({ gym });
  } catch (error) {
    logServerError(error as Error, { route: "/api/owner/gym", userId: uid });
    return jsonError("Failed to create gym", 500);
  }
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const parsed = await safeJson<{
    gymId?: string;
    name?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    openTime?: string | null;
    closeTime?: string | null;
    openDays?: string | null;
    dayPassPrice?: number | null;
    monthlyPrice?: number;
    quarterlyPrice?: number | null;
    yearlyPrice?: number;
    partnerDiscountPercent?: number;
    quarterlyDiscountPercent?: number;
    yearlyDiscountPercent?: number;
    welcomeDiscountPercent?: number;
    maxDiscountCapPercent?: number;
  }>(req);
  if (!parsed.ok) {
    return jsonError("Invalid JSON body", 400);
  }
  const { gymId, ...data } = parsed.data;
  if (!gymId) {
    return jsonError("gymId required", 400);
  }
  try {
    const existing = await prisma.gym.findFirst({
      where: { id: gymId, ownerId: uid },
    });
    if (!existing) {
      return jsonError("Gym not found", 404);
    }
    const update: Record<string, unknown> = {};
    if (data.name != null) update.name = data.name.trim();
    if (data.address != null) update.address = data.address.trim();
    if (data.latitude != null) update.latitude = data.latitude;
    if (data.longitude != null) update.longitude = data.longitude;
    if (data.openTime !== undefined) update.openTime = data.openTime;
    if (data.closeTime !== undefined) update.closeTime = data.closeTime;
    if (data.openDays !== undefined) update.openDays = data.openDays;
    if (data.dayPassPrice !== undefined) update.dayPassPrice = data.dayPassPrice;
    if (data.monthlyPrice != null) update.monthlyPrice = data.monthlyPrice;
    if (data.quarterlyPrice !== undefined) update.quarterlyPrice = data.quarterlyPrice;
    if (data.yearlyPrice != null) update.yearlyPrice = data.yearlyPrice;
    if (data.partnerDiscountPercent != null) update.partnerDiscountPercent = data.partnerDiscountPercent;
    if (data.quarterlyDiscountPercent != null) update.quarterlyDiscountPercent = data.quarterlyDiscountPercent;
    if (data.yearlyDiscountPercent != null) update.yearlyDiscountPercent = data.yearlyDiscountPercent;
    if (data.welcomeDiscountPercent != null) update.welcomeDiscountPercent = data.welcomeDiscountPercent;
    if (data.maxDiscountCapPercent != null) update.maxDiscountCapPercent = data.maxDiscountCapPercent;
    const gym = await prisma.gym.update({
      where: { id: gymId },
      data: update,
    });
    return NextResponse.json({ gym });
  } catch (error) {
    logServerError(error as Error, { route: "/api/owner/gym", userId: uid });
    return jsonError("Failed to update gym", 500);
  }
}
