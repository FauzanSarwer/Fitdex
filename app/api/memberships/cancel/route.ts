import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/permissions";
import { jsonError } from "@/lib/api";
import { logServerError } from "@/lib/logger";
import { cancelMembershipSchema } from "@/lib/validation/cancelMembership";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!requireUser(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const uid = (session!.user as { id: string }).id;

  // ✅ Safe JSON parse
  const raw = await req.json().catch(() => null);

  if (!raw) {
    return jsonError("Invalid JSON body", 400);
  }

  // ✅ Zod validation
  const parsed = cancelMembershipSchema.safeParse(raw);

  if (!parsed.success) {
    return jsonError(parsed.error.message, 400);
  }

  const { membershipId } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const membership = await tx.membership.findFirst({
        where: { id: membershipId, userId: uid },
      });

      if (!membership) {
        throw new Error("MEMBERSHIP_NOT_FOUND");
      }

      await tx.membership.update({
        where: { id: membershipId },
        data: { active: false },
      });

      await tx.duo.updateMany({
        where: {
          gymId: membership.gymId,
          OR: [{ userOneId: uid }, { userTwoId: uid }],
        },
        data: { active: false },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "MEMBERSHIP_NOT_FOUND") {
      return jsonError("Membership not found", 404);
    }

    logServerError(error, {
      route: "/api/memberships/cancel",
      userId: uid,
    });

    return jsonError("Failed to cancel membership", 500);
  }
}
