import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api";
import { logServerError } from "@/lib/logger";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ gymId: string }> }
) {
  try {
    const { gymId } = await params;
    const session = await getServerSession(authOptions);
    const userId = session?.user ? (session.user as { id?: string }).id : undefined;

    await prisma.gymPageView.create({
      data: {
        gymId,
        userId: userId ?? null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logServerError(error as Error, { route: "/api/gyms/[gymId]/views" });
    return jsonError("Failed to record gym view", 500);
  }
}
