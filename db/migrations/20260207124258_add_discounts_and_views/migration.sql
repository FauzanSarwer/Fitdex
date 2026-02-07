/*
  Warnings:

  - You are about to drop the column `discountPercent` on the `DiscountCode` table. All the data in the column will be lost.
  - You are about to drop the column `maxDiscountCapPercent` on the `Gym` table. All the data in the column will be lost.
  - You are about to drop the column `quarterlyDiscountPercent` on the `Gym` table. All the data in the column will be lost.
  - You are about to drop the column `welcomeDiscountPercent` on the `Gym` table. All the data in the column will be lost.
  - You are about to drop the column `yearlyDiscountPercent` on the `Gym` table. All the data in the column will be lost.
  - Added the required column `discountValue` to the `DiscountCode` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DiscountCode" DROP COLUMN "discountPercent",
ADD COLUMN     "discountType" TEXT NOT NULL DEFAULT 'PERCENT',
ADD COLUMN     "discountValue" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Gym" DROP COLUMN "maxDiscountCapPercent",
DROP COLUMN "quarterlyDiscountPercent",
DROP COLUMN "welcomeDiscountPercent",
DROP COLUMN "yearlyDiscountPercent",
ADD COLUMN     "quarterlyDiscountType" TEXT NOT NULL DEFAULT 'PERCENT',
ADD COLUMN     "quarterlyDiscountValue" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "welcomeDiscountType" TEXT NOT NULL DEFAULT 'PERCENT',
ADD COLUMN     "welcomeDiscountValue" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "yearlyDiscountType" TEXT NOT NULL DEFAULT 'PERCENT',
ADD COLUMN     "yearlyDiscountValue" INTEGER NOT NULL DEFAULT 15;

-- CreateTable
CREATE TABLE "GymPageView" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GymPageView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GymPageView_gymId_createdAt_idx" ON "GymPageView"("gymId", "createdAt");

-- AddForeignKey
ALTER TABLE "GymPageView" ADD CONSTRAINT "GymPageView_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymPageView" ADD CONSTRAINT "GymPageView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
