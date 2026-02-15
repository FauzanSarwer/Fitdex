import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonError, safeJson } from "@/lib/api";
import { requireUser } from "@/lib/permissions";
import type { SyncQueueItem } from "@/types/fitness";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireUser(session)) {
    return jsonError("Unauthorized", 401);
  }

  const uid = (session!.user as { id: string }).id;
  const parsed = await safeJson<{ since?: string; mutations?: SyncQueueItem[] }>(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);

  const since = parsed.data.since ? new Date(parsed.data.since) : null;
  const mutations = Array.isArray(parsed.data.mutations) ? parsed.data.mutations : [];

  const results: Array<{ id: string; status: "applied" | "skipped" | "failed"; entityId: string | null; error?: string }> = [];

  for (const mutation of mutations) {
    try {
      if (mutation.entityType === "session") {
        const payload = mutation.payload as any;
        if (!payload?.id || !payload.entryAt) {
          results.push({ id: mutation.id, status: "failed", entityId: null, error: "Invalid session payload" });
          continue;
        }

        const existing = await prisma.gymSession.findUnique({ where: { id: payload.id } });
        const incomingUpdatedAt = payload.updatedAt ? new Date(payload.updatedAt) : new Date(payload.entryAt);

        if (mutation.operation === "create") {
          if (existing) {
            if (existing.updatedAt >= incomingUpdatedAt) {
              results.push({ id: mutation.id, status: "skipped", entityId: existing.id });
              continue;
            }
            await prisma.gymSession.update({
              where: { id: existing.id },
              data: {
                gymId: payload.gymId ?? null,
                entryAt: new Date(payload.entryAt),
                exitAt: payload.exitAt ? new Date(payload.exitAt) : null,
                durationMinutes: payload.durationMinutes ?? null,
                calories: payload.calories ?? null,
                validForStreak: Boolean(payload.validForStreak),
                endedBy: payload.endedBy ?? null,
                verificationStatus: payload.verificationStatus ?? "VERIFIED",
                deviceId: payload.deviceId ?? null,
                updatedAt: incomingUpdatedAt,
              },
            });
            results.push({ id: mutation.id, status: "applied", entityId: existing.id });
          } else {
            const created = await prisma.gymSession.create({
              data: {
                id: payload.id,
                userId: uid,
                gymId: payload.gymId ?? null,
                entryAt: new Date(payload.entryAt),
                exitAt: payload.exitAt ? new Date(payload.exitAt) : null,
                durationMinutes: payload.durationMinutes ?? null,
                calories: payload.calories ?? null,
                validForStreak: Boolean(payload.validForStreak),
                endedBy: payload.endedBy ?? null,
                verificationStatus: payload.verificationStatus ?? "VERIFIED",
                deviceId: payload.deviceId ?? null,
              },
            });
            results.push({ id: mutation.id, status: "applied", entityId: created.id });
          }
        } else if (mutation.operation === "update") {
          if (!existing) {
            results.push({ id: mutation.id, status: "skipped", entityId: payload.id });
            continue;
          }
          if (existing.updatedAt >= incomingUpdatedAt) {
            results.push({ id: mutation.id, status: "skipped", entityId: existing.id });
            continue;
          }
          const updated = await prisma.gymSession.update({
            where: { id: existing.id },
            data: {
              exitAt: payload.exitAt ? new Date(payload.exitAt) : existing.exitAt,
              durationMinutes: payload.durationMinutes ?? existing.durationMinutes,
              calories: payload.calories ?? existing.calories,
              validForStreak: payload.validForStreak ?? existing.validForStreak,
              endedBy: payload.endedBy ?? existing.endedBy,
              verificationStatus: payload.verificationStatus ?? existing.verificationStatus,
              updatedAt: incomingUpdatedAt,
            },
          });
          results.push({ id: mutation.id, status: "applied", entityId: updated.id });
        }
      } else if (mutation.entityType === "weight") {
        const payload = mutation.payload as any;
        if (!payload?.id || !payload.loggedAt) {
          results.push({ id: mutation.id, status: "failed", entityId: null, error: "Invalid weight payload" });
          continue;
        }
        const existing = await prisma.weightLog.findUnique({ where: { id: payload.id } });
        const incomingUpdatedAt = payload.updatedAt ? new Date(payload.updatedAt) : new Date(payload.loggedAt);

        if (mutation.operation === "create") {
          if (existing) {
            if (existing.updatedAt >= incomingUpdatedAt) {
              results.push({ id: mutation.id, status: "skipped", entityId: existing.id });
              continue;
            }
            await prisma.weightLog.update({
              where: { id: existing.id },
              data: {
                valueKg: payload.valueKg ?? existing.valueKg,
                loggedAt: new Date(payload.loggedAt),
                updatedAt: incomingUpdatedAt,
              },
            });
            results.push({ id: mutation.id, status: "applied", entityId: existing.id });
          } else {
            const created = await prisma.weightLog.create({
              data: {
                id: payload.id,
                userId: uid,
                valueKg: payload.valueKg,
                loggedAt: new Date(payload.loggedAt),
              },
            });
            results.push({ id: mutation.id, status: "applied", entityId: created.id });
          }
        } else if (mutation.operation === "update") {
          if (!existing) {
            results.push({ id: mutation.id, status: "skipped", entityId: payload.id });
            continue;
          }
          if (existing.updatedAt >= incomingUpdatedAt) {
            results.push({ id: mutation.id, status: "skipped", entityId: existing.id });
            continue;
          }
          const updated = await prisma.weightLog.update({
            where: { id: existing.id },
            data: {
              valueKg: payload.valueKg ?? existing.valueKg,
              loggedAt: new Date(payload.loggedAt),
              updatedAt: incomingUpdatedAt,
            },
          });
          results.push({ id: mutation.id, status: "applied", entityId: updated.id });
        }
      }
    } catch (error) {
      results.push({
        id: mutation.id,
        status: "failed",
        entityId: null,
        error: error instanceof Error ? error.message : "Mutation failed",
      });
    }
  }

  const sinceFilter = since ? { gte: since } : undefined;
  const [sessions, weights] = await Promise.all([
    prisma.gymSession.findMany({
      where: {
        userId: uid,
        ...(sinceFilter ? { updatedAt: sinceFilter } : {}),
      },
      include: { gym: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    prisma.weightLog.findMany({
      where: {
        userId: uid,
        ...(sinceFilter ? { updatedAt: sinceFilter } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
  ]);

  const response = {
    ok: true,
    serverTime: new Date().toISOString(),
    results,
    changes: {
      sessions: sessions.map((session) => ({
        id: session.id,
        userId: session.userId,
        gymId: session.gymId,
        entryAt: session.entryAt.toISOString(),
        exitAt: session.exitAt ? session.exitAt.toISOString() : null,
        durationMinutes: session.durationMinutes ?? null,
        calories: session.calories ?? null,
        validForStreak: session.validForStreak,
        endedBy: session.endedBy,
        verificationStatus: session.verificationStatus,
        deviceId: session.deviceId,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        gymName: session.gym?.name ?? null,
      })),
      weights: weights.map((weight) => ({
        id: weight.id,
        userId: weight.userId,
        valueKg: weight.valueKg,
        loggedAt: weight.loggedAt.toISOString(),
        createdAt: weight.createdAt.toISOString(),
        updatedAt: weight.updatedAt.toISOString(),
      })),
    },
  };

  return NextResponse.json(response);
}
