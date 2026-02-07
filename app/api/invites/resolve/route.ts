import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api";
import { logServerError } from "@/lib/logger";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  if (!code) {
    return jsonError("code required", 400);
  }
  try {
    const invite = await prisma.invite.findUnique({
      where: { code: code.trim().toUpperCase() },
      include: {
        gym: { select: { id: true, name: true, partnerDiscountPercent: true } },
        inviter: { select: { name: true } },
      },
    });
    if (!invite) {
      return jsonError("Invalid invite", 404);
    }
    return NextResponse.json(
      {
        code: invite.code,
        gymId: invite.gymId,
        gymName: invite.gym?.name,
        inviterName: invite.inviter?.name ?? "Partner",
        partnerDiscountPercent: invite.gym?.partnerDiscountPercent ?? 0,
      },
      { headers: { "Cache-Control": "public, max-age=120, stale-while-revalidate=300" } }
    );
  } catch (error) {
    logServerError(error as Error, { route: "/api/invites/resolve" });
    return jsonError("Failed to resolve invite", 500);
  }
}
