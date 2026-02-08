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
  const parsed = await safeJson<{ type?: "BOOK_CTA" | "ENQUIRY" }>(req);
  if (!parsed.ok) {
    return jsonError("Invalid JSON body", 400);
  }
  const { gymId } = await params;
  const type = parsed.data.type ?? "BOOK_CTA";
  if (!gymId) return jsonError("gymId required", 400);
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
        type,
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
          type,
          leadId: lead.id,
        },
        message: `New ${type === "BOOK_CTA" ? "booking" : "enquiry"} lead for ${gym.name}.`,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logServerError(error as Error, { route: "/api/gyms/[gymId]/leads", userId: uid });
    return jsonError("Failed to record lead", 500);
  }
}
