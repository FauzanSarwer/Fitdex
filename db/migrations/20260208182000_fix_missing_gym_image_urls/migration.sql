-- Ensure Gym.imageUrls exists in production databases
ALTER TABLE "Gym"
ADD COLUMN IF NOT EXISTS "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
