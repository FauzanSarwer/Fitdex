#!/usr/bin/env node#!/usr/bin/env node











})();  process.exit(0);  console.log('weightLog count:', weightLogCount);  console.log('gymSession count:', gymSessionCount);  const weightLogCount = await prisma.weightLog.count();  const gymSessionCount = await prisma.gymSession.count();(async () => {const prisma = new PrismaClient();const { PrismaClient } = require('@prisma/client');// Script to count rows in gymSession and weightLog before/after migration// Script to count rows in gymSession and weightLog before/after migration
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const gymSessionCount = await prisma.gymSession.count();
  const weightLogCount = await prisma.weightLog.count();
  console.log('gymSession count:', gymSessionCount);
  console.log('weightLog count:', weightLogCount);
  process.exit(0);
})();
