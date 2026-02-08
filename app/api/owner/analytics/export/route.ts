import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/permissions";
import { jsonError } from "@/lib/api";
import { logServerError } from "@/lib/logger";

function toCsv(rows: string[][]) {
  return rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = (session!.user as { id: string }).id;
  const { searchParams } = new URL(req.url);
  const gymId = searchParams.get("gymId");
  if (!gymId) {
    return jsonError("gymId required", 400);
  }
  try {
    const gym = await prisma.gym.findFirst({ where: { id: gymId, ownerId: uid } });
    if (!gym) {
      return jsonError("Gym not found", 404);
    }
    const payments = await prisma.payment.findMany({
      where: { gymId },
      orderBy: { createdAt: "desc" },
      select: { id: true, amount: true, status: true, createdAt: true },
    });
    const memberships = await prisma.membership.findMany({
      where: { gymId },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        planType: true,
        basePrice: true,
        finalPrice: true,
        active: true,
        startedAt: true,
        expiresAt: true,
      },
    });
    const duos = await prisma.duo.findMany({
      where: { gymId },
      orderBy: { createdAt: "desc" },
      select: { id: true, userOneId: true, userTwoId: true, createdAt: true },
    });

    const totalRevenue = payments.filter((p) => p.status === "CAPTURED").reduce((s, p) => s + p.amount, 0);

    const rows: string[][] = [
      ["Gym", String(gym.name)],
      ["Generated", new Date().toISOString()],
      ["Total revenue (paise)", String(totalRevenue)],
      ["Total memberships", String(memberships.length)],
      ["Active memberships", String(memberships.filter((m) => m.active).length)],
      ["Total duos", String(duos.length)],
      [],
      ["Payments"],
      ["id", "amount", "status", "createdAt"],
      ...payments.map((p) => [p.id, String(p.amount), String(p.status), p.createdAt.toISOString()]),
      [],
      ["Memberships"],
      ["id", "planType", "basePrice", "finalPrice", "active", "startedAt", "expiresAt"],
      ...memberships.map((m) => [
        String(m.id),
        String(m.planType),
        String(m.basePrice),
        String(m.finalPrice),
        String(m.active),
        m.startedAt.toISOString(),
        m.expiresAt.toISOString(),
      ]),
      [],
      ["Duos"],
      ["id", "userOneId", "userTwoId", "createdAt"],
      ...duos.map((d) => [String(d.id), String(d.userOneId), String(d.userTwoId), d.createdAt.toISOString()]),
    ];

    const csv = toCsv(rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename=analytics-${gymId}.csv`,
      },
    });
  } catch (error) {
    logServerError(error as Error, { route: "/api/owner/analytics/export", userId: uid });
    return jsonError("Failed to export analytics", 500);
  }
}
