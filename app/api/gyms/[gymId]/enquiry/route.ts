import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonError, safeJson } from "@/lib/api";
import { logServerError } from "@/lib/logger";
import { sendWhatsappNotification } from "@/lib/whatsapp";

export async function POST(req: Request, { params }: { params: Promise<{ gymId: string }> }) {
  const session = await getServerSession(authOptions);
  const uid = session?.user ? (session.user as { id?: string }).id : undefined;
  const parsed = await safeJson<{
    name?: string;
    email?: string;
    phone?: string;
    message?: string;
  }>(req);
  if (!parsed.ok) {
    return jsonError("Invalid JSON body", 400);
  }
  const { gymId } = await params;
  if (!gymId) return jsonError("gymId required", 400);

  const name = parsed.data.name?.trim();
  const email = parsed.data.email?.trim();
  const phone = parsed.data.phone?.trim();
  const message = parsed.data.message?.trim();

  if (!name || name.length < 2) return jsonError("Name required", 400);
  if (!phone && !email) return jsonError("Phone or email required", 400);

  try {
    const gym = await prisma.gym.findFirst({
      where: { id: gymId, verificationStatus: { not: "REJECTED" }, suspendedAt: null, ownerConsentAt: { not: null } },
      include: { owner: { select: { supportWhatsapp: true } } },
    });
    if (!gym) return jsonError("Gym not found", 404);

    const lead = await prisma.lead.create({
      data: {
        gymId,
        userId: uid ?? null,
        type: "ENQUIRY",
        message: message || null,
        contactName: name,
        contactEmail: email || null,
        contactPhone: phone || null,
      },
    });

    if (gym.owner?.supportWhatsapp) {
      await sendWhatsappNotification({
        eventType: "NEW_LEAD",
        toNumber: gym.owner.supportWhatsapp,
        gymId: gym.id,
        userId: uid ?? null,
        payload: {
          gymName: gym.name,
          type: "ENQUIRY",
          leadId: lead.id,
          contactName: name,
          contactPhone: phone || null,
        },
        message: `New enquiry for ${gym.name} from ${name}${phone ? ` (${phone})` : ""}.`,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logServerError(error as Error, { route: "/api/gyms/[gymId]/enquiry", userId: uid });
    return jsonError("Failed to submit enquiry", 500);
  }
}
