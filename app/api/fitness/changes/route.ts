import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api";
import { requireUser } from "@/lib/permissions";
import { ratelimit } from "@/lib/rate-limit";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

function parseCursor(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

function parseLimit(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.floor(parsed));
}

function resolveServerVersionCursors(url: URL) {
  const sharedCursor = parseCursor(
    url.searchParams.get("serverVersion") ?? url.searchParams.get("cursor")
  );
  const sessionCursorParam = url.searchParams.get("sessionCursor");
  const weightCursorParam = url.searchParams.get("weightCursor");

  return {
    // Backward compatible: explicit per-entity cursors override the shared serverVersion cursor.
    sessionCursor:
      sessionCursorParam == null ? sharedCursor : parseCursor(sessionCursorParam),
    weightCursor:
      weightCursorParam == null ? sharedCursor : parseCursor(weightCursorParam),
  };
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !requireUser(session)) return jsonError("Unauthorized", 401);

  const uid = (session.user as { id: string }).id;
  const { success } = await ratelimit.limit(`fitness-changes:${uid}`);
  if (!success) return jsonError("Too many requests", 429);

  const url = new URL(req.url);
  const { sessionCursor, weightCursor } = resolveServerVersionCursors(url);
  const limit = parseLimit(url.searchParams.get("limit"));

  const [sessions, weights, activeSession] = await Promise.all([
    prisma.gymSession.findMany({
      where: {
        userId: uid,
        serverVersion: { gt: sessionCursor },
      },
      include: {
        gym: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { serverVersion: "asc" },
      take: limit,
    }),
    prisma.weightLog.findMany({
      where: {
        userId: uid,
        serverVersion: { gt: weightCursor },
      },
      orderBy: { serverVersion: "asc" },
      take: limit,
    }),
    prisma.gymSession.findFirst({
      where: { userId: uid, exitAt: null },
      include: { gym: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const nextSessionCursor =
    sessions.length > 0 ? sessions[sessions.length - 1]!.serverVersion : sessionCursor;
  const nextWeightCursor =
    weights.length > 0 ? weights[weights.length - 1]!.serverVersion : weightCursor;

  const [hasMoreSessions, hasMoreWeights] = await Promise.all([
    prisma.gymSession.findFirst({
      where: {
        userId: uid,
        serverVersion: { gt: nextSessionCursor },
      },
      select: { id: true },
      orderBy: { serverVersion: "asc" },
    }),
    prisma.weightLog.findFirst({
      where: {
        userId: uid,
        serverVersion: { gt: nextWeightCursor },
      },
      select: { id: true },
      orderBy: { serverVersion: "asc" },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    serverTime: new Date().toISOString(),
    cursor: {
      // `serverVersion` is conservative to avoid skipping slower-moving entity streams.
      serverVersion: Math.min(nextSessionCursor, nextWeightCursor),
      sessionCursor: nextSessionCursor,
      weightCursor: nextWeightCursor,
    },
    hasMore: {
      sessions: Boolean(hasMoreSessions),
      weights: Boolean(hasMoreWeights),
    },
    activeSession: activeSession
      ? {
          id: activeSession.id,
          userId: activeSession.userId,
          gymId: activeSession.gymId,
          gymName: activeSession.gym?.name ?? null,
          entryAt: activeSession.entryAt.toISOString(),
          exitAt: activeSession.exitAt ? activeSession.exitAt.toISOString() : null,
          durationMinutes: activeSession.durationMinutes,
          calories: activeSession.calories,
          validForStreak: activeSession.validForStreak,
          endedBy: activeSession.endedBy,
          verificationStatus: activeSession.verificationStatus,
          serverVersion: activeSession.serverVersion,
          createdAt: activeSession.createdAt.toISOString(),
          updatedAt: activeSession.updatedAt.toISOString(),
        }
      : null,
    changes: {
      sessions: sessions.map((item) => ({
        id: item.id,
        userId: item.userId,
        gymId: item.gymId,
        gymName: item.gym?.name ?? null,
        entryAt: item.entryAt.toISOString(),
        exitAt: item.exitAt ? item.exitAt.toISOString() : null,
        durationMinutes: item.durationMinutes,
        calories: item.calories,
        validForStreak: item.validForStreak,
        endedBy: item.endedBy,
        verificationStatus: item.verificationStatus,
        serverVersion: item.serverVersion,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
      weights: weights.map((item) => ({
        id: item.id,
        userId: item.userId,
        valueKg: item.valueKg,
        loggedAt: item.loggedAt.toISOString(),
        serverVersion: item.serverVersion,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
    },
  });
}
