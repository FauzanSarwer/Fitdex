import { z } from "zod";

export const SessionEndReasonSchema = z.enum(["EXIT_QR", "INACTIVITY_TIMEOUT", "MANUAL"]);
export const SessionVerificationStatusSchema = z.enum(["PENDING", "VERIFIED", "REJECTED"]);
export const ServerVersionSchema = z.number().int().nonnegative();

export const SessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  gymId: z.string(),
  gymName: z.string().nullable().optional(),
  entryAt: z.string().datetime(),
  exitAt: z.string().datetime().nullable(),
  durationMinutes: z.number().int().nullable(),
  calories: z.number().int().nullable(),
  validForStreak: z.boolean(),
  endedBy: SessionEndReasonSchema.nullable(),
  verificationStatus: SessionVerificationStatusSchema,
  serverVersion: ServerVersionSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const WeightLogSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  valueKg: z.number(),
  loggedAt: z.string().datetime(),
  serverVersion: ServerVersionSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const QrTokenTypeSchema = z.enum(["ENTRY", "EXIT", "PAYMENT"]);

export const QrTokenSchema = z.object({
  gymId: z.string(),
  type: QrTokenTypeSchema,
  tokenHash: z.string(),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  usedAt: z.string().datetime().nullable(),
});

export const SyncEntityTypeSchema = z.enum(["session", "weight"]);
export const SyncOperationSchema = z.enum(["create", "update"]);
export const SyncMutationStatusSchema = z.enum(["applied", "skipped", "conflict", "failed"]);

export const SessionMutationPayloadSchema = z.object({
  id: z.string().uuid(),
  gymId: z.string().nullable(),
  entryAt: z.string().datetime(),
  exitAt: z.string().datetime().nullable().optional(),
  durationMinutes: z.number().int().nullable().optional(),
  calories: z.number().int().nullable().optional(),
  validForStreak: z.boolean().optional(),
  endedBy: SessionEndReasonSchema.nullable().optional(),
  verificationStatus: SessionVerificationStatusSchema.optional(),
  baseServerVersion: ServerVersionSchema.optional(),
  updatedAt: z.string().datetime().optional(),
});

export const WeightMutationPayloadSchema = z.object({
  id: z.string().uuid(),
  valueKg: z.number(),
  loggedAt: z.string().datetime(),
  baseServerVersion: ServerVersionSchema.optional(),
  updatedAt: z.string().datetime().optional(),
});

export const SyncQueueItemSchema = z.object({
  id: z.string().uuid(),
  entityType: SyncEntityTypeSchema,
  operation: SyncOperationSchema,
  payload: z.union([SessionMutationPayloadSchema, WeightMutationPayloadSchema]),
  createdAt: z.string().datetime(),
  retryCount: z.number().int().nonnegative(),
  lastAttemptAt: z.string().datetime().nullable(),
  nextAttemptAt: z.string().datetime().nullable().optional(),
});

export const SyncMutationResultSchema = z.object({
  id: z.string().uuid(),
  entityType: SyncEntityTypeSchema,
  status: SyncMutationStatusSchema,
  entityId: z.string().uuid().nullable(),
  serverVersion: ServerVersionSchema.nullable().optional(),
  canonicalSession: SessionSchema.optional(),
  canonicalWeight: WeightLogSchema.optional(),
  error: z.string().optional(),
});

export const SyncPayloadSchema = z.object({
  since: z.string().datetime().optional(),
  mutations: z.array(SyncQueueItemSchema).default([]),
});

export const SyncResponseSchema = z.object({
  ok: z.boolean(),
  serverTime: z.string().datetime(),
  results: z.array(SyncMutationResultSchema),
  activeSession: SessionSchema.nullable(),
  changes: z.object({
    sessions: z.array(SessionSchema),
    weights: z.array(WeightLogSchema),
  }),
});

export type Session = z.infer<typeof SessionSchema>;
export type WeightLog = z.infer<typeof WeightLogSchema>;
export type QrToken = z.infer<typeof QrTokenSchema>;
export type SyncQueueItem = z.infer<typeof SyncQueueItemSchema>;
export type SyncMutationResult = z.infer<typeof SyncMutationResultSchema>;
export type SyncPayload = z.infer<typeof SyncPayloadSchema>;
export type SyncResponse = z.infer<typeof SyncResponseSchema>;
