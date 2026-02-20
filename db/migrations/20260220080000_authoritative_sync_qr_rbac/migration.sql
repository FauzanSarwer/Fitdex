-- Fitness authoritative versioning
ALTER TABLE IF EXISTS "WeightLog"
  ADD COLUMN IF NOT EXISTS "serverVersion" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE IF EXISTS "gymSession"
  ADD COLUMN IF NOT EXISTS "serverVersion" INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF to_regclass('public."WeightLog"') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "WeightLog_userId_serverVersion_idx" ON "WeightLog" ("userId", "serverVersion")';
  END IF;
  IF to_regclass('public."gymSession"') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "gymSession_userId_serverVersion_idx" ON "gymSession" ("userId", "serverVersion")';
  END IF;
END
$$;

-- Sync mutation idempotency receipts
CREATE TABLE IF NOT EXISTS "SyncMutationReceipt" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mutationId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "serverVersion" INTEGER,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SyncMutationReceipt_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'SyncMutationReceipt_userId_fkey'
  ) THEN
    ALTER TABLE "SyncMutationReceipt"
      ADD CONSTRAINT "SyncMutationReceipt_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "SyncMutationReceipt_userId_mutationId_key"
  ON "SyncMutationReceipt" ("userId", "mutationId");
CREATE INDEX IF NOT EXISTS "SyncMutationReceipt_userId_createdAt_idx"
  ON "SyncMutationReceipt" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "SyncMutationReceipt_entityType_entityId_idx"
  ON "SyncMutationReceipt" ("entityType", "entityId");

-- Global audit log
CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "gymId" TEXT,
  "type" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "metadata" JSONB,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AuditLog_actorId_fkey'
  ) THEN
    ALTER TABLE "AuditLog"
      ADD CONSTRAINT "AuditLog_actorId_fkey"
      FOREIGN KEY ("actorId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "AuditLog_actorId_timestamp_idx" ON "AuditLog" ("actorId", "timestamp");
CREATE INDEX IF NOT EXISTS "AuditLog_gymId_timestamp_idx" ON "AuditLog" ("gymId", "timestamp");
CREATE INDEX IF NOT EXISTS "AuditLog_type_timestamp_idx" ON "AuditLog" ("type", "timestamp");

-- QR token hardening
ALTER TABLE IF EXISTS "qrToken"
  ADD COLUMN IF NOT EXISTS "nonce" TEXT,
  ADD COLUMN IF NOT EXISTS "deviceBindingHash" TEXT;

DO $$
BEGIN
  IF to_regclass('public."qrToken"') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "qrToken_gymId_type_expiresAt_idx" ON "qrToken" ("gymId", "type", "expiresAt")';
    EXECUTE 'CREATE INDEX IF NOT EXISTS "qrToken_nonce_idx" ON "qrToken" ("nonce")';
  END IF;
END
$$;

-- QR key uniqueness and batch metadata
DO $$
BEGIN
  IF to_regclass('public."QrKey"') IS NOT NULL THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS "QrKey_gymId_version_key" ON "QrKey" ("gymId", "version")';
    EXECUTE 'CREATE INDEX IF NOT EXISTS "QrKey_gymId_createdAt_idx" ON "QrKey" ("gymId", "createdAt")';
  ELSIF to_regclass('public."qrKey"') IS NOT NULL THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS "QrKey_gymId_version_key" ON "qrKey" ("gymId", "version")';
    EXECUTE 'CREATE INDEX IF NOT EXISTS "QrKey_gymId_createdAt_idx" ON "qrKey" ("gymId", "createdAt")';
  END IF;
END
$$;

ALTER TABLE IF EXISTS "QrAuditLog"
  ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'QR';
ALTER TABLE IF EXISTS "qrAuditLog"
  ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'QR';

ALTER TABLE IF EXISTS "QrBatchJob"
  ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "error" TEXT;
ALTER TABLE IF EXISTS "qrBatchJob"
  ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "error" TEXT;
