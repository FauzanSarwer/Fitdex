#!/usr/bin/env node
// Script to count rows in gymSession and weightLog before/after migration
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const gymSessionCount = await prisma.gymSession.count();
  const weightLogCount = await prisma.weightLog.count();
  console.log('gymSession count:', gymSessionCount);
  console.log('weightLog count:', weightLogCount);
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
