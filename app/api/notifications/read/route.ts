import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/permissions";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireUser(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const body = await req.json();
  const { ids, all } = body as { ids?: string[]; all?: boolean };

  if (all) {
    await prisma.notification.updateMany({
      where: { userId: uid, read: false },
      data: { read: true },
    });
    return NextResponse.json({ success: true });
  }

  if (!ids || ids.length === 0) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }

  await prisma.notification.updateMany({
    where: { userId: uid, id: { in: ids } },
    data: { read: true },
  });

  return NextResponse.json({ success: true });
}
