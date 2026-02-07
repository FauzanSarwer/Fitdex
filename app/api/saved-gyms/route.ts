import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/permissions";
import { jsonError, safeJson } from "@/lib/api";
import { logServerError } from "@/lib/logger";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!requireUser(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  try {
    const saved = await prisma.savedGym.findMany({
      where: { userId: uid },
      include: { gym: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ saved });
  } catch (error) {
    logServerError(error as Error, { route: "/api/saved-gyms", userId: uid });
    return jsonError("Failed to load saved gyms", 500);
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireUser(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const parsed = await safeJson<{ gymId?: string }>(req);
  if (!parsed.ok) {
    return jsonError("Invalid JSON body", 400);
  }
  const gymId = parsed.data.gymId?.trim();
  if (!gymId) {
    return jsonError("gymId required", 400);
  }
  try {
    const saved = await prisma.savedGym.upsert({
      where: { userId_gymId: { userId: uid, gymId } },
      update: {},
      create: { userId: uid, gymId },
    });
    return NextResponse.json({ saved });
  } catch (error) {
    logServerError(error as Error, { route: "/api/saved-gyms", userId: uid });
    return jsonError("Failed to save gym", 500);
  }
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
    return jsonError("gymId required", 400);
  }
  try {
    await prisma.savedGym.deleteMany({
      where: { userId: uid, gymId },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logServerError(error as Error, { route: "/api/saved-gyms", userId: uid });
    return jsonError("Failed to remove saved gym", 500);
  }
}
