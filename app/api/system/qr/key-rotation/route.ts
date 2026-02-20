import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { getUserId, requireSuperAdmin } from "@/lib/permissions";
import { runQrSigningKeyRotationSweep } from "@/lib/qr/qr-service";

const CRON_SECRET = process.env.QR_ROTATION_CRON_SECRET ?? "";

function hasValidCronSecret(req: Request) {
  if (!CRON_SECRET) return false;
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : req.headers.get("x-cron-secret") ?? "";
  return token === CRON_SECRET;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const authorizedByCron = hasValidCronSecret(req);
  const authorizedByRole = requireSuperAdmin(session);
  if (!authorizedByCron && !authorizedByRole) {
    return jsonError("Unauthorized", 401);
  }

  const raw = await req.text();
  let body: { gymId?: string; force?: boolean } = {};
  if (raw.trim().length > 0) {
    try {
      body = JSON.parse(raw) as { gymId?: string; force?: boolean };
    } catch {
      return jsonError("Invalid JSON body", 400);
    }
  }

  const actorId = authorizedByRole
    ? getUserId(session)
    : (process.env.QR_ROTATION_SYSTEM_ACTOR_ID ?? process.env.SYSTEM_ACTOR_ID ?? null);
  if (!actorId) {
    return jsonError("Missing system actor id for scheduled rotation", 503);
  }

  const result = await runQrSigningKeyRotationSweep({
    actorId,
    gymId: body.gymId ?? null,
    force: Boolean(body.force),
  });

  return NextResponse.json({ ok: true, ...result });
}
