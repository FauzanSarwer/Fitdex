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
    const user = (await prisma.user.findUnique({
      where: { id: uid },
    })) as any;
    const settings = user
      ? {
          name: user.name,
          email: user.email,
          city: user.city,
          state: user.state,
          phoneNumber: user.phoneNumber,
          billingEmail: user.billingEmail,
          billingAddress: user.billingAddress,
          businessName: user.businessName,
          businessType: user.businessType,
          supportEmail: user.supportEmail,
          supportPhone: user.supportPhone,
          supportWhatsapp: user.supportWhatsapp,
          logoUrl: user.logoUrl,
          twoFactorEnabled: user.twoFactorEnabled,
          timezone: user.timezone,
          notifyMemberships: user.notifyMemberships,
          notifyPromos: user.notifyPromos,
          notifyDuo: user.notifyDuo,
        }
      : null;
    return NextResponse.json({ settings });
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
    billingAddress?: string;
    businessName?: string;
    businessType?: string;
    supportEmail?: string;
    supportPhone?: string;
    supportWhatsapp?: string;
    logoUrl?: string;
    twoFactorEnabled?: boolean;
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
    if (parsed.data.billingAddress !== undefined) update.billingAddress = parsed.data.billingAddress.trim() || null;
    if (parsed.data.businessName !== undefined) update.businessName = parsed.data.businessName.trim() || null;
    if (parsed.data.businessType !== undefined) update.businessType = parsed.data.businessType.trim() || null;
    if (parsed.data.supportEmail !== undefined) update.supportEmail = parsed.data.supportEmail.trim() || null;
    if (parsed.data.supportPhone !== undefined) update.supportPhone = parsed.data.supportPhone.trim() || null;
    if (parsed.data.supportWhatsapp !== undefined) update.supportWhatsapp = parsed.data.supportWhatsapp.trim() || null;
    if (parsed.data.logoUrl !== undefined) update.logoUrl = parsed.data.logoUrl.trim() || null;
    if (parsed.data.twoFactorEnabled !== undefined) update.twoFactorEnabled = parsed.data.twoFactorEnabled;
    if (parsed.data.timezone !== undefined) update.timezone = parsed.data.timezone.trim() || null;
    if (parsed.data.notifyMemberships !== undefined) update.notifyMemberships = parsed.data.notifyMemberships;
    if (parsed.data.notifyPromos !== undefined) update.notifyPromos = parsed.data.notifyPromos;
    if (parsed.data.notifyDuo !== undefined) update.notifyDuo = parsed.data.notifyDuo;

    const user = (await prisma.user.update({
      where: { id: uid },
      data: update,
    })) as any;
    const settings = {
      name: user.name,
      email: user.email,
      city: user.city,
      state: user.state,
      phoneNumber: user.phoneNumber,
      billingEmail: user.billingEmail,
      billingAddress: user.billingAddress,
      businessName: user.businessName,
      businessType: user.businessType,
      supportEmail: user.supportEmail,
      supportPhone: user.supportPhone,
      supportWhatsapp: user.supportWhatsapp,
      logoUrl: user.logoUrl,
      twoFactorEnabled: user.twoFactorEnabled,
      timezone: user.timezone,
      notifyMemberships: user.notifyMemberships,
      notifyPromos: user.notifyPromos,
      notifyDuo: user.notifyDuo,
    };

    return NextResponse.json({ settings });
  } catch (error) {
    logServerError(error as Error, { route: "/api/user/settings", userId: uid });
    return jsonError("Failed to update settings", 500);
  }
}
