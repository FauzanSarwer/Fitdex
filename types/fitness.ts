import { z } from "zod";

export const SessionEndReasonSchema = z.enum(["EXIT_QR", "INACTIVITY_TIMEOUT", "MANUAL"]);
export type SessionEndReason = z.infer<typeof SessionEndReasonSchema>;

export const SessionVerificationStatusSchema = z.enum(["PENDING", "VERIFIED", "REJECTED"]);
export type SessionVerificationStatus = z.infer<typeof SessionVerificationStatusSchema>;

export const SessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  gymId: z.string().nullable(),
  entryAt: z.string(),
  exitAt: z.string().nullable(),
  durationMinutes: z.number().nullable(),
  calories: z.number().nullable(),
  validForStreak: z.boolean(),
  endedBy: SessionEndReasonSchema.nullable(),
  verificationStatus: SessionVerificationStatusSchema.optional(),
  deviceId: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Session = z.infer<typeof SessionSchema>;

export const WeightLogSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  valueKg: z.number(),
  loggedAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type WeightLog = z.infer<typeof WeightLogSchema>;

export const QrTokenTypeSchema = z.enum(["ENTRY", "EXIT", "PAYMENT"]);
export type QrTokenType = z.infer<typeof QrTokenTypeSchema>;

export const QrTokenSchema = z.object({
  id: z.string(),
  gymId: z.string(),
  type: QrTokenTypeSchema,
  tokenHash: z.string(),
  expiresAt: z.string(),
  createdAt: z.string(),
  usedAt: z.string().nullable(),
});
export type QrToken = z.infer<typeof QrTokenSchema>;

export const SyncEntityTypeSchema = z.enum(["session", "weight"]);
export type SyncEntityType = z.infer<typeof SyncEntityTypeSchema>;

export const SyncOperationSchema = z.enum(["create", "update"]);
export type SyncOperation = z.infer<typeof SyncOperationSchema>;

export const SyncQueueItemSchema = z.object({
  id: z.string().uuid(),
  entityType: SyncEntityTypeSchema,
  operation: SyncOperationSchema,
  payload: z.unknown(),
  createdAt: z.string(),
  retryCount: z.number(),
  lastAttemptAt: z.string().nullable(),
});
export type SyncQueueItem = z.infer<typeof SyncQueueItemSchema>;

export const SyncPayloadSchema = z.object({
  since: z.string().optional(),
  mutations: z.array(SyncQueueItemSchema).default([]),
});
export type SyncPayload = z.infer<typeof SyncPayloadSchema>;

export const SyncResponseSchema = z.object({
  ok: z.boolean(),
  serverTime: z.string(),
  results: z.array(
    z.object({
      id: z.string(),
      status: z.enum(["applied", "skipped", "failed"]),
      entityId: z.string().nullable(),
      error: z.string().optional(),
    })
  ),
  changes: z.object({
    sessions: z.array(SessionSchema),
    weights: z.array(WeightLogSchema),
  }),
});
export type SyncResponse = z.infer<typeof SyncResponseSchema>;
