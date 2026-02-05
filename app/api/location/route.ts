import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isWithinDelhiNCR,
  isCityServiceable,
  reverseGeocode,
} from "@/lib/location";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();
    const { latitude, longitude } = body as { latitude: number; longitude: number };
    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return NextResponse.json(
        { error: "Invalid latitude or longitude" },
        { status: 400 }
      );
    }
    const inDelhi = isWithinDelhiNCR(latitude, longitude);
    const geo = await reverseGeocode(latitude, longitude);
    const city = geo?.city ?? null;
    const state = geo?.state ?? null;
    const serviceable = inDelhi || (city ? isCityServiceable(city) : false);

    if (session?.user) {
      await prisma.user.update({
        where: { id: (session.user as { id: string }).id },
        data: { latitude, longitude, city, state },
      });
    }

    return NextResponse.json({
      latitude,
      longitude,
      city,
      state,
      serviceable,
      inDelhiNCR: inDelhi,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to update location" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ location: null });
    }
    const uid = (session.user as { id: string }).id;
    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: {
        latitude: true,
        longitude: true,
        city: true,
        state: true,
      },
    });
    if (!user?.latitude || !user?.longitude) {
      return NextResponse.json({ location: null });
    }
    return NextResponse.json({
      location: {
        latitude: user.latitude,
        longitude: user.longitude,
        city: user.city,
        state: user.state,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to get location" },
      { status: 500 }
    );
  }
}
