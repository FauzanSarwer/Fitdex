import { z } from "zod";

export const QrTypeSchema = z.enum(["ENTRY", "EXIT", "PAYMENT"]);
export type QrType = z.infer<typeof QrTypeSchema>;

export const StaticQrSchema = z.object({
  id: z.string().uuid(),
  gymId: z.string(),
  type: QrTypeSchema,
  currentKeyVersion: z.number(),
  revokedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type StaticQr = z.infer<typeof StaticQrSchema>;

export const QrKeySchema = z.object({
  id: z.string().uuid(),
  gymId: z.string(),
  type: QrTypeSchema,
  version: z.number(),
  secretHash: z.string(),
  active: z.boolean(),
  rotatedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type QrKey = z.infer<typeof QrKeySchema>;

export const QrAuditActionSchema = z.enum([
  "GENERATE",
  "REGENERATE",
  "REVOKE",
  "BULK_GENERATE",
  "BULK_EXPORT",
]);
export type QrAuditAction = z.infer<typeof QrAuditActionSchema>;

export const QrAuditLogSchema = z.object({
  id: z.string().uuid(),
  actorId: z.string(),
  gymId: z.string(),
  type: QrTypeSchema.optional(),
  action: QrAuditActionSchema,
  metadata: z.record(z.any()).optional(),
  createdAt: z.string(),
});
export type QrAuditLog = z.infer<typeof QrAuditLogSchema>;

export const SignedQrPayloadSchema = z.object({
  gymId: z.string(),
  type: QrTypeSchema,
  exp: z.number(),
  nonce: z.string(),
  v: z.number(),
  sig: z.string(),
});
export type SignedQrPayload = z.infer<typeof SignedQrPayloadSchema>;

export const QrVerificationResultSchema = z.object({
  ok: z.boolean(),
  reason: z.string().optional(),
  payload: SignedQrPayloadSchema.optional(),
});
export type QrVerificationResult = z.infer<typeof QrVerificationResultSchema>;

export const QrPreviewResponseSchema = z.object({
  ok: z.boolean(),
  gym: z.object({
    id: z.string(),
    name: z.string(),
    logoUrl: z.string().nullable(),
  }),
  lastGeneratedAt: z.string().nullable(),
  staticUrl: z.string(),
});
export type QrPreviewResponse = z.infer<typeof QrPreviewResponseSchema>;
