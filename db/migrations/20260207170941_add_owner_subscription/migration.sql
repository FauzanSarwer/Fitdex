-- CreateTable
CREATE TABLE "OwnerSubscription" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OwnerSubscription_razorpayOrderId_key" ON "OwnerSubscription"("razorpayOrderId");

-- CreateIndex
CREATE INDEX "OwnerSubscription_ownerId_idx" ON "OwnerSubscription"("ownerId");

-- CreateIndex
CREATE INDEX "OwnerSubscription_status_idx" ON "OwnerSubscription"("status");

-- AddForeignKey
ALTER TABLE "OwnerSubscription" ADD CONSTRAINT "OwnerSubscription_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
