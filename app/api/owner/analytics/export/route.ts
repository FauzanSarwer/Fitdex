import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/permissions";

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
    return NextResponse.json({ error: "gymId required" }, { status: 400 });
  }
  const gym = await prisma.gym.findFirst({ where: { id: gymId, ownerId: uid } });
  if (!gym) {
    return NextResponse.json({ error: "Gym not found" }, { status: 404 });
  }
  const payments = await prisma.payment.findMany({ where: { gymId }, orderBy: { createdAt: "desc" } });
  const memberships = await prisma.membership.findMany({ where: { gymId }, orderBy: { startedAt: "desc" } });
  const duos = await prisma.duo.findMany({ where: { gymId }, orderBy: { createdAt: "desc" } });

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
}
