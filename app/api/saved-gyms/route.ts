import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/permissions";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!requireUser(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const saved = await prisma.savedGym.findMany({
    where: { userId: uid },
    include: { gym: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ saved });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireUser(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const body = await req.json();
  const { gymId } = body as { gymId: string };
  if (!gymId) {
    return NextResponse.json({ error: "gymId required" }, { status: 400 });
  }
  const saved = await prisma.savedGym.upsert({
    where: { userId_gymId: { userId: uid, gymId } },
    update: {},
    create: { userId: uid, gymId },
  });
  return NextResponse.json({ saved });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireUser(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const { searchParams } = new URL(req.url);
  const gymId = searchParams.get("gymId");
  if (!gymId) {
    return NextResponse.json({ error: "gymId required" }, { status: 400 });
  }
  await prisma.savedGym.deleteMany({
    where: { userId: uid, gymId },
  });
  return NextResponse.json({ ok: true });
}
