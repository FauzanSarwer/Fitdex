const { execSync } = require("child_process");
const { PrismaClient } = require("@prisma/client");

const MIGRATION_NAME = "20260208153438_add_gym_image_urls";
const MIGRATE_CMD = "npx prisma migrate deploy --schema=db/schema.prisma";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function resolveFailedMigration(prisma) {
  const failed = await prisma.$queryRaw`
    SELECT migration_name
    FROM _prisma_migrations
    WHERE migration_name = ${MIGRATION_NAME}
      AND finished_at IS NULL
      AND rolled_back_at IS NULL
    LIMIT 1
  `;

  if (!Array.isArray(failed) || failed.length === 0) return;

  const enumExists = await prisma.$queryRaw`
    SELECT 1 FROM pg_type WHERE typname = 'GymTier' LIMIT 1
  `;

  if (Array.isArray(enumExists) && enumExists.length > 0) {
    execSync(
      `npx prisma migrate resolve --schema=db/schema.prisma --applied ${MIGRATION_NAME}`,
      { stdio: "inherit" }
    );
  }
}

function isLockTimeout(errorOutput) {
  return (
    errorOutput.includes("P1002") ||
    errorOutput.toLowerCase().includes("advisory lock") ||
    errorOutput.toLowerCase().includes("lock timeout")
  );
}

async function runMigrateDeployWithRetry(maxAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = require("child_process").spawnSync(MIGRATE_CMD, {
      shell: true,
      encoding: "utf8",
    });
    if (result.status === 0) return;

    const output = [result.stdout ?? "", result.stderr ?? ""].join("\n");
    lastError = new Error(output || `migrate deploy failed with code ${result.status}`);
    if (attempt < maxAttempts && isLockTimeout(output)) {
      const waitMs = 5000 * attempt;
      console.warn(`[migrate-safe] Advisory lock timeout. Retrying in ${waitMs}ms...`);
      await sleep(waitMs);
      continue;
    }
    throw lastError;
  }
  throw lastError;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    await resolveFailedMigration(prisma);
  } finally {
    await prisma.$disconnect();
  }

  await runMigrateDeployWithRetry(3);
}

main().catch((error) => {
  console.error("[migrate-safe]", error);
  process.exit(1);
});
