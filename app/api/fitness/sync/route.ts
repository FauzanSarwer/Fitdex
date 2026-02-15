import { NextResponse } from "next/server";
import { ratelimit } from "@/lib/rate-limit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonError, safeJson } from "@/lib/api";
import { requireUser } from "@/lib/permissions";
import type { SyncQueueItem } from "@/types/fitness";
import { logServerError } from "@/lib/logger";
import { getMetrics } from "@/lib/metrics";

const SYNC_V2_ENABLED = process.env.SYNC_V2_ENABLED === "true";

if (process.env.SYNC_V2_ENABLED !== undefined) {
  console.info(`[Fitdex] SYNC_V2_ENABLED = ${process.env.SYNC_V2_ENABLED}`);
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

if (!session || !requireUser(session)) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const uid = (session.user as { id: string }).id;

    const { success } = await ratelimit.limit(uid);
    if (!success) return jsonError("Too many requests", 429);

    const parsed = await safeJson<{
      mutations: SyncQueueItem[];
      since?: string;
    }>(req);

    if (!parsed.ok) return jsonError("Invalid JSON body", 400);

    const { mutations, since } = parsed.data;

    const metrics = getMetrics("sync");
    const syncStart = Date.now();

    // 🟡 READ ONLY MODE
    if (!SYNC_V2_ENABLED) {
      const sinceFilter = since ? { gte: new Date(since) } : undefined;

      const [sessions, weights] = await Promise.all([
        prisma.gymSession.findMany({
          where: { userId: uid, ...(sinceFilter && { updatedAt: sinceFilter }) },
          orderBy: { updatedAt: "desc" },
          take: 200,
        }),
        prisma.weightLog.findMany({
          where: { userId: uid, ...(sinceFilter && { updatedAt: sinceFilter }) },
          orderBy: { updatedAt: "desc" },
          take: 200,
        }),
      ]);

      return NextResponse.json({
        ok: true,
        serverTime: new Date().toISOString(),
        results: [],
        changes: { sessions, weights },
      });
    }

    // 🟢 APPLY MUTATIONS (minimal safe version)

    const results: {
      id: string;
      status: "applied" | "skipped" | "failed";
      entityId: string | null;
      error?: string;
    }[] = [];

    for (const mutation of mutations) {
      try {
        if (mutation.entityType === "weight") {
          const payload = mutation.payload as any;

          const existing = await prisma.weightLog.findUnique({
            where: { id: payload.id },
          });

          if (!existing && mutation.operation === "create") {
            const created = await prisma.weightLog.create({
              data: {
                id: payload.id,
                userId: uid,
                valueKg: payload.valueKg,
                loggedAt: new Date(payload.loggedAt),
              },
            });

            results.push({
              id: mutation.id,
              status: "applied",
              entityId: created.id,
            });
          } else {
            results.push({
              id: mutation.id,
              status: "skipped",
              entityId: existing?.id ?? null,
            });
          }
        }

        if (mutation.entityType === "session") {
          const payload = mutation.payload as any;

          const existing = await prisma.gymSession.findUnique({
            where: { id: payload.id },
          });

          if (!existing && mutation.operation === "create") {
            const created = await prisma.gymSession.create({
              data: {
                id: payload.id,
                userId: uid,
                gymId: payload.gymId ?? null,
                entryAt: new Date(payload.entryAt),
                exitAt: payload.exitAt ? new Date(payload.exitAt) : null,
              },
            });

            results.push({
              id: mutation.id,
              status: "applied",
              entityId: created.id,
            });
          } else {
            results.push({
              id: mutation.id,
              status: "skipped",
              entityId: existing?.id ?? null,
            });
          }
        }
      } catch (err) {
        results.push({
          id: mutation.id,
          status: "failed",
          entityId: null,
          error: err instanceof Error ? err.message : "Mutation failed",
        });
      }
    }

    // 🔵 RETURN LATEST STATE

    const sinceFilter = since ? { gte: new Date(since) } : undefined;

    const [sessions, weights] = await Promise.all([
      prisma.gymSession.findMany({
        where: { userId: uid, ...(sinceFilter && { updatedAt: sinceFilter }) },
        orderBy: { updatedAt: "desc" },
        take: 200,
      }),
      prisma.weightLog.findMany({
        where: { userId: uid, ...(sinceFilter && { updatedAt: sinceFilter }) },
        orderBy: { updatedAt: "desc" },
        take: 200,
      }),
    ]);

    const duration = Date.now() - syncStart;

    metrics.observe("sync.duration", duration);
    metrics.observe("sync.batchSize", mutations.length);

    return NextResponse.json({
      ok: true,
      serverTime: new Date().toISOString(),
      results,
      changes: { sessions, weights },
    });
  } catch (error) {
    logServerError(error as Error, { route: "/api/fitness/sync" });
    return jsonError("Sync failed", 500);
  }
}
