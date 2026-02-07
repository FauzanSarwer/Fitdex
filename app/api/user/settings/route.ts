import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonError, safeJson } from "@/lib/api";
import { logServerError } from "@/lib/logger";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session.user as { id: string }).id;
  try {
    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: {
        name: true,
        email: true,
        city: true,
        state: true,
        phoneNumber: true,
        billingEmail: true,
        timezone: true,
        notifyMemberships: true,
        notifyPromos: true,
        notifyDuo: true,
      },
    });
    return NextResponse.json({ settings: user });
  } catch (error) {
    logServerError(error as Error, { route: "/api/user/settings", userId: uid });
    return jsonError("Failed to load settings", 500);
  }
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session.user as { id: string }).id;
  const parsed = await safeJson<{
    name?: string;
    city?: string;
    state?: string;
    phoneNumber?: string;
    billingEmail?: string;
    timezone?: string;
    notifyMemberships?: boolean;
    notifyPromos?: boolean;
    notifyDuo?: boolean;
  }>(req);
  if (!parsed.ok) {
    return jsonError("Invalid JSON body", 400);
  }
  try {
    const update: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) update.name = parsed.data.name.trim() || null;
    if (parsed.data.city !== undefined) update.city = parsed.data.city.trim() || null;
    if (parsed.data.state !== undefined) update.state = parsed.data.state.trim() || null;
    if (parsed.data.phoneNumber !== undefined) update.phoneNumber = parsed.data.phoneNumber.trim() || null;
    if (parsed.data.billingEmail !== undefined) update.billingEmail = parsed.data.billingEmail.trim() || null;
    if (parsed.data.timezone !== undefined) update.timezone = parsed.data.timezone.trim() || null;
    if (parsed.data.notifyMemberships !== undefined) update.notifyMemberships = parsed.data.notifyMemberships;
    if (parsed.data.notifyPromos !== undefined) update.notifyPromos = parsed.data.notifyPromos;
    if (parsed.data.notifyDuo !== undefined) update.notifyDuo = parsed.data.notifyDuo;

    const user = await prisma.user.update({
      where: { id: uid },
      data: update,
      select: {
        name: true,
        email: true,
        city: true,
        state: true,
        phoneNumber: true,
        billingEmail: true,
        timezone: true,
        notifyMemberships: true,
        notifyPromos: true,
        notifyDuo: true,
      },
    });

    return NextResponse.json({ settings: user });
  } catch (error) {
    logServerError(error as Error, { route: "/api/user/settings", userId: uid });
    return jsonError("Failed to update settings", 500);
  }
}
