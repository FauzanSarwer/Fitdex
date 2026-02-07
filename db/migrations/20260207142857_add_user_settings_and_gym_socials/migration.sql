-- AlterTable
ALTER TABLE "Gym" ADD COLUMN     "facebookUrl" TEXT,
ADD COLUMN     "instagramUrl" TEXT,
ADD COLUMN     "youtubeUrl" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "billingEmail" TEXT,
ADD COLUMN     "notifyDuo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyMemberships" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyPromos" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "timezone" TEXT;
