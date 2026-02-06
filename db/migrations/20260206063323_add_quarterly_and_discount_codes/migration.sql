-- CreateTable
CREATE TABLE "DiscountCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gymId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 100,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "validFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiscountCode_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Gym" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "ownerId" TEXT NOT NULL,
    "monthlyPrice" INTEGER NOT NULL,
    "quarterlyPrice" INTEGER,
    "yearlyPrice" INTEGER NOT NULL,
    "partnerDiscountPercent" INTEGER NOT NULL DEFAULT 10,
    "quarterlyDiscountPercent" INTEGER NOT NULL DEFAULT 10,
    "yearlyDiscountPercent" INTEGER NOT NULL DEFAULT 15,
    "welcomeDiscountPercent" INTEGER NOT NULL DEFAULT 10,
    "maxDiscountCapPercent" INTEGER NOT NULL DEFAULT 40,
    "coverImageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Gym_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Gym" ("address", "createdAt", "id", "latitude", "longitude", "maxDiscountCapPercent", "monthlyPrice", "name", "ownerId", "partnerDiscountPercent", "updatedAt", "welcomeDiscountPercent", "yearlyDiscountPercent", "yearlyPrice") SELECT "address", "createdAt", "id", "latitude", "longitude", "maxDiscountCapPercent", "monthlyPrice", "name", "ownerId", "partnerDiscountPercent", "updatedAt", "welcomeDiscountPercent", "yearlyDiscountPercent", "yearlyPrice" FROM "Gym";
DROP TABLE "Gym";
ALTER TABLE "new_Gym" RENAME TO "Gym";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "DiscountCode_gymId_code_key" ON "DiscountCode"("gymId", "code");
