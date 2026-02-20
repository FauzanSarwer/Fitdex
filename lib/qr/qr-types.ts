import { z } from "zod";

export const QrTypeSchema = z.enum(["ENTRY", "EXIT", "PAYMENT"]);
export type QrType = z.infer<typeof QrTypeSchema>;

export const StaticQrSchema = z.object({
  gymId: z.string(),
  type: QrTypeSchema,
  currentKeyVersion: z.number().int().positive(),
  revokedAt: z.string().datetime().nullable(),
});
export type StaticQr = z.infer<typeof StaticQrSchema>;

export const QrKeySchema = z.object({
  id: z.string(),
  gymId: z.string(),
  version: z.number().int().positive(),
  key: z.string(),
  createdAt: z.string().datetime(),
});
export type QrKey = z.infer<typeof QrKeySchema>;

export const QrAuditActionSchema = z.enum([
  "GENERATE",
  "REGENERATE",
  "REVOKE",
  "VERIFY_ENTRY",
  "VERIFY_EXIT",
  "VERIFY_PAYMENT",
  "BULK_GENERATE",
  "BULK_EXPORT",
]);
export type QrAuditAction = z.infer<typeof QrAuditActionSchema>;

export const QrAuditLogSchema = z.object({
  id: z.string(),
  actorId: z.string(),
  gymId: z.string(),
  type: z.string(),
  action: QrAuditActionSchema,
  createdAt: z.string().datetime(),
});
export type QrAuditLog = z.infer<typeof QrAuditLogSchema>;

export const SignedQrPayloadSchema = z.object({
  gymId: z.string(),
  type: QrTypeSchema,
  exp: z.number().int(),
  nonce: z.string(),
  v: z.number().int().positive(),
  deviceBinding: z.string().optional().nullable(),
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
  lastGeneratedAt: z.string().datetime().nullable(),
  staticUrl: z.string(),
});
export type QrPreviewResponse = z.infer<typeof QrPreviewResponseSchema>;
