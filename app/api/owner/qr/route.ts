import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonError, safeJson } from "@/lib/api";
import { requireGymAdmin } from "@/lib/permissions";
import { QrTypeSchema } from "@/lib/qr/qr-types";
import { ensureStaticQr, getLastQrGeneration, rotateQrKey } from "@/lib/qr/qr-service";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://fitdex.app";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!requireGymAdmin(session)) return jsonError("Unauthorized", 401);

  const uid = (session!.user as { id: string }).id;
  const gyms = await prisma.gym.findMany({
    where: { ownerId: uid },
    select: { id: true, name: true },
  });

  const previews = await Promise.all(
    gyms.map(async (gym) => {
      const types = ["ENTRY", "EXIT", "PAYMENT"] as const;
      const entries = await Promise.all(
        types.map(async (type) => {
          await ensureStaticQr(gym.id, type, uid);
          const lastGeneratedAt = await getLastQrGeneration(gym.id, type);
          return {
            type,
            staticUrl: `${APP_URL}/qr/static/${gym.id}/${type}`,
            lastGeneratedAt: lastGeneratedAt ? lastGeneratedAt.toISOString() : null,
          };
        })
      );
      return {
        gym,
        entries,
      };
    })
  );

  return NextResponse.json({ ok: true, gyms: previews });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireGymAdmin(session)) return jsonError("Unauthorized", 401);

  const parsed = await safeJson<{ gymId?: string; type?: string; revoke?: boolean }>(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);

  const { gymId, type, revoke } = parsed.data;
  if (!gymId || !type) return jsonError("Missing parameters", 400);

  const typeParsed = QrTypeSchema.safeParse(type.toUpperCase());
  if (!typeParsed.success) return jsonError("Invalid QR type", 400);

  const uid = (session!.user as { id: string }).id;
  const gym = await prisma.gym.findFirst({ where: { id: gymId, ownerId: uid } });
  if (!gym) return jsonError("Gym not found", 404);

  await rotateQrKey({ gymId, type: typeParsed.data, actorId: uid, revoke: Boolean(revoke) });

  return NextResponse.json({ ok: true });
}
