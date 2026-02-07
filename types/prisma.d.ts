import type { Prisma, PrismaClient } from "@prisma/client";

declare module "@prisma/client" {
  interface PrismaClient {
    emailVerificationToken: Prisma.EmailVerificationTokenDelegate<any>;
    ownerSubscription: Prisma.OwnerSubscriptionDelegate<any>;
  }
}
