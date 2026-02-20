import { NextResponse } from "next/server";
import { ratelimit } from "@/lib/rate-limit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonError, safeJson } from "@/lib/api";
import { requireUser } from "@/lib/permissions";
import { logObservabilityEvent, logServerError } from "@/lib/logger";
import { getMetrics } from "@/lib/metrics";
import {
  SessionMutationPayloadSchema,
  SyncPayloadSchema,
  type Session,
  type SyncMutationResult,
  type SyncQueueItem,
  type WeightLog,
  WeightMutationPayloadSchema,
} from "@/lib/fitness/domain";
import { writeAuditLog } from "@/lib/audit-log";

const SYNC_V2_ENABLED = process.env.SYNC_V2_ENABLED !== "false";

const mapReceiptStatus = (status: string): SyncMutationResult["status"] => {
  if (status === "APPLIED") return "applied";
  if (status === "SKIPPED") return "skipped";
  if (status === "CONFLICT") return "conflict";
  return "failed";
};

const toReceiptStatus = (status: SyncMutationResult["status"]): string => {
  if (status === "applied") return "APPLIED";
  if (status === "skipped") return "SKIPPED";
  if (status === "conflict") return "CONFLICT";
  return "FAILED";
};

async function getCanonicalSession(userId: string, sessionId: string): Promise<Session | null> {
  const session = await prisma.gymSession.findFirst({
    where: { id: sessionId, userId },
    include: { gym: { select: { name: true } } },
  });
  if (!session) return null;
  return {
    id: session.id,
    userId: session.userId,
    gymId: session.gymId,
    gymName: session.gym?.name ?? null,
    entryAt: session.entryAt.toISOString(),
    exitAt: session.exitAt?.toISOString() ?? null,
    durationMinutes: session.durationMinutes ?? null,
    calories: session.calories ?? null,
    validForStreak: session.validForStreak,
    endedBy: session.endedBy as Session["endedBy"],
    verificationStatus: session.verificationStatus as Session["verificationStatus"],
    serverVersion: session.serverVersion,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

async function getCanonicalWeight(userId: string, weightId: string): Promise<WeightLog | null> {
  const weight = await prisma.weightLog.findFirst({
    where: { id: weightId, userId },
  });
  if (!weight) return null;
  return {
    id: weight.id,
    userId: weight.userId,
    valueKg: weight.valueKg,
    loggedAt: weight.loggedAt.toISOString(),
    serverVersion: weight.serverVersion,
    createdAt: weight.createdAt.toISOString(),
    updatedAt: weight.updatedAt.toISOString(),
  };
}

async function hydrateReceiptResult(
  userId: string,
  receipt: {
    mutationId: string;
    entityType: string;
    entityId: string;
    status: string;
    serverVersion: number | null;
    error: string | null;
  }
): Promise<SyncMutationResult> {
  if (receipt.entityType === "session") {
    const canonical = await getCanonicalSession(userId, receipt.entityId);
    return {
      id: receipt.mutationId,
      entityType: "session",
      status: mapReceiptStatus(receipt.status),
      entityId: canonical?.id ?? receipt.entityId ?? null,
      serverVersion: canonical?.serverVersion ?? receipt.serverVersion ?? null,
      canonicalSession: canonical ?? undefined,
      error: receipt.error ?? undefined,
    };
  }

  const canonical = await getCanonicalWeight(userId, receipt.entityId);
  return {
    id: receipt.mutationId,
    entityType: "weight",
    status: mapReceiptStatus(receipt.status),
    entityId: canonical?.id ?? receipt.entityId ?? null,
    serverVersion: canonical?.serverVersion ?? receipt.serverVersion ?? null,
    canonicalWeight: canonical ?? undefined,
    error: receipt.error ?? undefined,
  };
}

async function persistReceipt(
  userId: string,
  mutation: SyncQueueItem,
  result: SyncMutationResult
) {
  if (result.status === "failed" || !result.entityId) return;
  await prisma.syncMutationReceipt.upsert({
    where: {
      userId_mutationId: {
        userId,
        mutationId: mutation.id,
      },
    },
    update: {
      status: toReceiptStatus(result.status),
      entityType: mutation.entityType,
      entityId: result.entityId,
      serverVersion: result.serverVersion ?? null,
      error: result.error ?? null,
    },
    create: {
      userId,
      mutationId: mutation.id,
      entityType: mutation.entityType,
      entityId: result.entityId,
      status: toReceiptStatus(result.status),
      serverVersion: result.serverVersion ?? null,
      error: result.error ?? null,
    },
  });
}

function logSyncConflict(params: {
  userId: string;
  mutation: SyncQueueItem;
  entityId: string | null;
  serverVersion: number | null;
  baseServerVersion: number | null;
  reason: string;
  gymId?: string | null;
}) {
  logObservabilityEvent({
    event: "sync.conflict",
    level: "warn",
    context: {
      userId: params.userId,
      entityType: params.mutation.entityType,
      operation: params.mutation.operation,
      mutationId: params.mutation.id,
      entityId: params.entityId,
      serverVersion: params.serverVersion,
      baseServerVersion: params.baseServerVersion,
      reason: params.reason,
      gymId: params.gymId ?? null,
    },
  });
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !requireUser(session)) return jsonError("Unauthorized", 401);

    const uid = (session.user as { id: string }).id;
    const { success } = await ratelimit.limit(uid);
    if (!success) return jsonError("Too many requests", 429);

    const parsedBody = await safeJson<unknown>(req);
    if (!parsedBody.ok) return jsonError("Invalid JSON body", 400);
    const parsedPayload = SyncPayloadSchema.safeParse(parsedBody.data);
    if (!parsedPayload.success) return jsonError("Invalid sync payload", 400);

    const { mutations, since } = parsedPayload.data;
    const metrics = getMetrics("sync");
    const syncStart = Date.now();

    const results: SyncMutationResult[] = [];
    if (SYNC_V2_ENABLED && mutations.length > 0) {
      for (const mutation of mutations as SyncQueueItem[]) {
        try {
          const existingReceipt = await prisma.syncMutationReceipt.findUnique({
            where: {
              userId_mutationId: {
                userId: uid,
                mutationId: mutation.id,
              },
            },
            select: {
              mutationId: true,
              entityType: true,
              entityId: true,
              status: true,
              serverVersion: true,
              error: true,
            },
          });

          if (existingReceipt) {
            const receiptResult = await hydrateReceiptResult(uid, existingReceipt);
            results.push(receiptResult);
            continue;
          }

          if (mutation.entityType === "weight") {
            const payload = WeightMutationPayloadSchema.parse(mutation.payload);
            const existing = await prisma.weightLog.findUnique({
              where: { id: payload.id },
            });

            let result: SyncMutationResult;

            if (!existing) {
              const created = await prisma.weightLog.create({
                data: {
                  id: payload.id,
                  userId: uid,
                  valueKg: payload.valueKg,
                  loggedAt: new Date(payload.loggedAt),
                },
              });
              const canonical = await getCanonicalWeight(uid, created.id);
              result = {
                id: mutation.id,
                entityType: "weight",
                status: "applied",
                entityId: created.id,
                serverVersion: created.serverVersion,
                canonicalWeight: canonical ?? undefined,
              };
            } else if (existing.userId !== uid) {
              result = {
                id: mutation.id,
                entityType: "weight",
                status: "failed",
                entityId: null,
                error: "Forbidden",
              };
            } else if (
              payload.baseServerVersion != null &&
              payload.baseServerVersion !== existing.serverVersion
            ) {
              const canonical = await getCanonicalWeight(uid, existing.id);
              result = {
                id: mutation.id,
                entityType: "weight",
                status: "conflict",
                entityId: existing.id,
                serverVersion: existing.serverVersion,
                canonicalWeight: canonical ?? undefined,
                error: "Version conflict",
              };
            } else if (mutation.operation === "create") {
              const canonical = await getCanonicalWeight(uid, existing.id);
              result = {
                id: mutation.id,
                entityType: "weight",
                status: "skipped",
                entityId: existing.id,
                serverVersion: existing.serverVersion,
                canonicalWeight: canonical ?? undefined,
              };
            } else {
              const updated = await prisma.weightLog.update({
                where: { id: existing.id },
                data: {
                  valueKg: payload.valueKg,
                  loggedAt: new Date(payload.loggedAt),
                  serverVersion: { increment: 1 },
                },
              });
              const canonical = await getCanonicalWeight(uid, updated.id);
              result = {
                id: mutation.id,
                entityType: "weight",
                status: "applied",
                entityId: updated.id,
                serverVersion: updated.serverVersion,
                canonicalWeight: canonical ?? undefined,
              };
            }

            await persistReceipt(uid, mutation, result);
            if (result.status === "conflict") {
              logSyncConflict({
                userId: uid,
                mutation,
                entityId: result.entityId,
                serverVersion: result.serverVersion ?? null,
                baseServerVersion: payload.baseServerVersion ?? null,
                reason: result.error ?? "Version conflict",
              });
              await writeAuditLog({
                actorId: uid,
                type: "FITNESS_SYNC",
                action: "WEIGHT_CONFLICT",
                metadata: {
                  mutationId: mutation.id,
                  entityId: result.entityId,
                  serverVersion: result.serverVersion,
                },
              });
            }

            results.push(result);
            continue;
          }

          if (mutation.entityType === "session") {
            const payload = SessionMutationPayloadSchema.parse(mutation.payload);
            const existing = await prisma.gymSession.findUnique({
              where: { id: payload.id },
            });

            let result: SyncMutationResult;
            if (!existing) {
              if (!payload.gymId) {
                result = {
                  id: mutation.id,
                  entityType: "session",
                  status: "failed",
                  entityId: null,
                  error: "gymId required",
                };
              } else {
                if (!payload.exitAt) {
                  const active = await prisma.gymSession.findFirst({
                    where: { userId: uid, exitAt: null },
                    orderBy: { updatedAt: "desc" },
                  });
                  if (active && active.id !== payload.id) {
                    const canonical = await getCanonicalSession(uid, active.id);
                    result = {
                      id: mutation.id,
                      entityType: "session",
                      status: "conflict",
                      entityId: active.id,
                      serverVersion: active.serverVersion,
                      canonicalSession: canonical ?? undefined,
                      error: "Another active session exists",
                    };
                    logSyncConflict({
                      userId: uid,
                      mutation,
                      entityId: active.id,
                      serverVersion: active.serverVersion,
                      baseServerVersion: payload.baseServerVersion ?? null,
                      reason: "another_active_session",
                      gymId: active.gymId,
                    });
                    await persistReceipt(uid, mutation, result);
                    await writeAuditLog({
                      actorId: uid,
                      gymId: active.gymId,
                      type: "FITNESS_SYNC",
                      action: "SESSION_CONFLICT",
                      metadata: {
                        mutationId: mutation.id,
                        entityId: active.id,
                        serverVersion: active.serverVersion,
                      },
                    });
                    results.push(result);
                    continue;
                  }
                }

                const created = await prisma.gymSession.create({
                  data: {
                    id: payload.id,
                    userId: uid,
                    gymId: payload.gymId,
                    entryAt: new Date(payload.entryAt),
                    exitAt: payload.exitAt ? new Date(payload.exitAt) : null,
                    durationMinutes: payload.durationMinutes ?? null,
                    calories: payload.calories ?? null,
                    validForStreak: payload.validForStreak ?? false,
                    endedBy: payload.endedBy ?? null,
                    verificationStatus: payload.verificationStatus ?? "PENDING",
                  },
                });
                const canonical = await getCanonicalSession(uid, created.id);
                result = {
                  id: mutation.id,
                  entityType: "session",
                  status: "applied",
                  entityId: created.id,
                  serverVersion: created.serverVersion,
                  canonicalSession: canonical ?? undefined,
                };
              }
            } else if (existing.userId !== uid) {
              result = {
                id: mutation.id,
                entityType: "session",
                status: "failed",
                entityId: null,
                error: "Forbidden",
              };
            } else if (
              payload.baseServerVersion != null &&
              payload.baseServerVersion !== existing.serverVersion
            ) {
              const canonical = await getCanonicalSession(uid, existing.id);
              result = {
                id: mutation.id,
                entityType: "session",
                status: "conflict",
                entityId: existing.id,
                serverVersion: existing.serverVersion,
                canonicalSession: canonical ?? undefined,
                error: "Version conflict",
              };
            } else if (mutation.operation === "create") {
              const canonical = await getCanonicalSession(uid, existing.id);
              result = {
                id: mutation.id,
                entityType: "session",
                status: "skipped",
                entityId: existing.id,
                serverVersion: existing.serverVersion,
                canonicalSession: canonical ?? undefined,
              };
            } else {
              const updated = await prisma.gymSession.update({
                where: { id: existing.id },
                data: {
                  gymId: payload.gymId ?? existing.gymId,
                  entryAt: new Date(payload.entryAt),
                  exitAt:
                    payload.exitAt !== undefined
                      ? payload.exitAt
                        ? new Date(payload.exitAt)
                        : null
                      : existing.exitAt,
                  durationMinutes:
                    payload.durationMinutes === undefined
                      ? existing.durationMinutes
                      : payload.durationMinutes,
                  calories: payload.calories === undefined ? existing.calories : payload.calories,
                  validForStreak:
                    payload.validForStreak === undefined
                      ? existing.validForStreak
                      : payload.validForStreak,
                  endedBy: payload.endedBy === undefined ? existing.endedBy : payload.endedBy,
                  verificationStatus: payload.verificationStatus ?? existing.verificationStatus,
                  serverVersion: { increment: 1 },
                },
              });
              const canonical = await getCanonicalSession(uid, updated.id);
              result = {
                id: mutation.id,
                entityType: "session",
                status: "applied",
                entityId: updated.id,
                serverVersion: updated.serverVersion,
                canonicalSession: canonical ?? undefined,
              };
            }

            await persistReceipt(uid, mutation, result);
            if (result.status === "conflict") {
              logSyncConflict({
                userId: uid,
                mutation,
                entityId: result.entityId,
                serverVersion: result.serverVersion ?? null,
                baseServerVersion: payload.baseServerVersion ?? null,
                reason: result.error ?? "Version conflict",
                gymId: result.canonicalSession?.gymId ?? null,
              });
              await writeAuditLog({
                actorId: uid,
                gymId: result.canonicalSession?.gymId,
                type: "FITNESS_SYNC",
                action: "SESSION_CONFLICT",
                metadata: {
                  mutationId: mutation.id,
                  entityId: result.entityId,
                  serverVersion: result.serverVersion,
                },
              });
            }

            results.push(result);
          }
        } catch (err) {
          results.push({
            id: mutation.id,
            entityType: mutation.entityType,
            status: "failed",
            entityId: null,
            error: err instanceof Error ? err.message : "Mutation failed",
          });
        }
      }
    }

    const sinceDate = since ? new Date(since) : null;
    const hasValidSince = sinceDate && !Number.isNaN(sinceDate.getTime());
    const [sessions, weights, activeSession] = await Promise.all([
      prisma.gymSession.findMany({
        where: { userId: uid, ...(hasValidSince ? { updatedAt: { gte: sinceDate! } } : {}) },
        include: { gym: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
        take: 200,
      }),
      prisma.weightLog.findMany({
        where: { userId: uid, ...(hasValidSince ? { updatedAt: { gte: sinceDate! } } : {}) },
        orderBy: { updatedAt: "desc" },
        take: 200,
      }),
      prisma.gymSession.findFirst({
        where: { userId: uid, exitAt: null },
        include: { gym: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const serverTime = new Date().toISOString();
    metrics.observe("sync.duration", Date.now() - syncStart);
    metrics.observe("sync.batchSize", mutations.length);

    return NextResponse.json({
      ok: true,
      serverTime,
      results,
      activeSession: activeSession
        ? {
            id: activeSession.id,
            userId: activeSession.userId,
            gymId: activeSession.gymId,
            gymName: activeSession.gym?.name ?? null,
            entryAt: activeSession.entryAt.toISOString(),
            exitAt: activeSession.exitAt?.toISOString() ?? null,
            durationMinutes: activeSession.durationMinutes ?? null,
            calories: activeSession.calories ?? null,
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
          exitAt: item.exitAt?.toISOString() ?? null,
          durationMinutes: item.durationMinutes ?? null,
          calories: item.calories ?? null,
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
  } catch (error) {
    logServerError(error as Error, { route: "/api/fitness/sync" });
    return jsonError("Sync failed", 500);
  }
}
