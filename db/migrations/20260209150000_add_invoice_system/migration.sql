DO $$ BEGIN
  CREATE TYPE "InvoiceType" AS ENUM ('GST', 'NON_GST');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "InvoiceTaxMode" AS ENUM ('CGST_SGST', 'IGST', 'NONE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "InvoiceTaxType" AS ENUM ('CGST', 'SGST', 'IGST');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Gym"
  ADD COLUMN IF NOT EXISTS "invoiceTypeDefault" "InvoiceType";

ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "userId" TEXT,
  ADD COLUMN IF NOT EXISTS "membershipId" TEXT,
  ADD COLUMN IF NOT EXISTS "transactionId" TEXT,
  ADD COLUMN IF NOT EXISTS "invoiceType" "InvoiceType" NOT NULL DEFAULT 'NON_GST',
  ADD COLUMN IF NOT EXISTS "taxMode" "InvoiceTaxMode" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "gstRate" INTEGER,
  ADD COLUMN IF NOT EXISTS "subtotal" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "taxTotal" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "total" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS "gymName" TEXT NOT NULL DEFAULT 'Fitdex',
  ADD COLUMN IF NOT EXISTS "gymAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "gymCity" TEXT,
  ADD COLUMN IF NOT EXISTS "gymState" TEXT,
  ADD COLUMN IF NOT EXISTS "gymGstNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "memberName" TEXT,
  ADD COLUMN IF NOT EXISTS "memberEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "memberState" TEXT,
  ADD COLUMN IF NOT EXISTS "pdfUrl" TEXT;

UPDATE "Invoice"
SET "subtotal" = "amount",
    "total" = "amount"
WHERE "total" = 0;

ALTER TABLE "Transaction"
  ADD COLUMN IF NOT EXISTS "invoiceId" TEXT;

CREATE TABLE IF NOT EXISTS "InvoiceItem" (
  "id" TEXT PRIMARY KEY,
  "invoiceId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" INTEGER NOT NULL,
  "total" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "InvoiceTax" (
  "id" TEXT PRIMARY KEY,
  "invoiceId" TEXT NOT NULL,
  "taxType" "InvoiceTaxType" NOT NULL,
  "rate" INTEGER NOT NULL,
  "amount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "InvoiceSequence" (
  "id" TEXT PRIMARY KEY,
  "gymId" TEXT NOT NULL UNIQUE,
  "lastNumber" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "InvoiceTax" ADD CONSTRAINT "InvoiceTax_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "InvoiceSequence" ADD CONSTRAINT "InvoiceSequence_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Invoice_transactionId_idx" ON "Invoice"("transactionId");
CREATE INDEX IF NOT EXISTS "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");
CREATE INDEX IF NOT EXISTS "InvoiceTax_invoiceId_idx" ON "InvoiceTax"("invoiceId");
