import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonError, safeJson } from "@/lib/api";
import { ensureGymScope, getAppRole, getUserId, requireGymAdmin } from "@/lib/permissions";
import { QrTypeSchema } from "@/lib/qr/qr-types";
import { ensureStaticQr, getLastQrGeneration, rotateQrKey } from "@/lib/qr/qr-service";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://fitdex.app";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireGymAdmin(session)) return jsonError("Unauthorized", 401);

  const uid = getUserId(session);
  const role = getAppRole(session);
  if (!uid || !role) return jsonError("Unauthorized", 401);

  const gymIdFilter = new URL(req.url).searchParams.get("gymId");
  const gyms = await prisma.gym.findMany({
    where:
      role === "SUPER_ADMIN"
        ? gymIdFilter
          ? { id: gymIdFilter }
          : undefined
        : { ownerId: uid, ...(gymIdFilter ? { id: gymIdFilter } : {}) },
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

  const scope = await ensureGymScope(session, gymId);
  if (!scope.ok) {
    if (scope.status === 404) return jsonError("Gym not found", 404);
    if (scope.status === 403) return jsonError("Forbidden", 403);
    return jsonError("Unauthorized", 401);
  }

  await rotateQrKey({
    gymId,
    type: typeParsed.data,
    actorId: scope.userId!,
    revoke: Boolean(revoke),
  });

  return NextResponse.json({ ok: true });
}
