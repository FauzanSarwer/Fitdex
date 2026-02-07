import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/permissions";
import { jsonError, safeJson } from "@/lib/api";
import { logServerError } from "@/lib/logger";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireUser(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const parsed = await safeJson<{ ids?: string[]; all?: boolean }>(req);
  if (!parsed.ok) {
    return jsonError("Invalid JSON body", 400);
  }
  const { ids, all } = parsed.data;
  try {
    if (all) {
      await prisma.notification.updateMany({
        where: { userId: uid, read: false },
        data: { read: true },
      });
      return NextResponse.json({ success: true });
    }

    if (!ids || ids.length === 0) {
      return jsonError("ids required", 400);
    }

    await prisma.notification.updateMany({
      where: { userId: uid, id: { in: ids } },
      data: { read: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logServerError(error as Error, { route: "/api/notifications/read", userId: uid });
    return jsonError("Failed to update notifications", 500);
  }
}
