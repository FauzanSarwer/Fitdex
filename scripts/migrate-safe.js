const { execSync } = require("child_process");
const { PrismaClient } = require("@prisma/client");

const LEGACY_ENUM_MIGRATION = "20260208153438_add_gym_image_urls";
const MIGRATE_CMD = "npx prisma migrate deploy --schema=db/schema.prisma";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function resolveMigration(name, status) {
  execSync(
    `npx prisma migrate resolve --schema=db/schema.prisma --${status} ${name}`,
    { stdio: "inherit" }
  );
}

async function resolveFailedMigration(prisma) {
  const failed = await prisma.$queryRaw`
    SELECT migration_name
    FROM _prisma_migrations
    WHERE finished_at IS NULL
      AND rolled_back_at IS NULL
    ORDER BY started_at ASC
  `;

  if (!Array.isArray(failed) || failed.length === 0) return;

  for (const row of failed) {
    const name = row?.migration_name;
    if (typeof name !== "string" || !name) continue;

    if (name === LEGACY_ENUM_MIGRATION) {
      const enumExists = await prisma.$queryRaw`
        SELECT 1 FROM pg_type WHERE typname = 'GymTier' LIMIT 1
      `;
      if (Array.isArray(enumExists) && enumExists.length > 0) {
        resolveMigration(name, "applied");
        continue;
      }
    }

    // Reset failed records so migrate deploy can replay them cleanly.
    resolveMigration(name, "rolled-back");
  }
}

function isLockTimeout(errorOutput) {
  return (
    errorOutput.includes("P1002") ||
    errorOutput.toLowerCase().includes("advisory lock") ||
    errorOutput.toLowerCase().includes("lock timeout")
  );
}

function isDatabaseUnavailable(errorOutput) {
  const value = (errorOutput ?? "").toLowerCase();
  return value.includes("can't reach database server") || value.includes("prismaclientinitializationerror");
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
    try {
      await resolveFailedMigration(prisma);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isDatabaseUnavailable(message)) {
        console.warn("[migrate-safe] Database unavailable. Skipping migration step for this build.");
        return;
      }
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }

  try {
    await runMigrateDeployWithRetry(3);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isDatabaseUnavailable(message)) {
      console.warn("[migrate-safe] Database unavailable. Skipping migration deploy for this build.");
      return;
    }
    throw error;
  }
}

main().catch((error) => {
  console.error("[migrate-safe]", error);
  process.exit(1);
});
