import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { logServerError } from "./logger";

export type AuditEvent = {
  actorId: string;
  gymId?: string | null;
  type: string;
  action: string;
  metadata?: Record<string, unknown> | null;
};

export async function writeAuditLog(event: AuditEvent): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: event.actorId,
        gymId: event.gymId ?? null,
        type: event.type,
        action: event.action,
        metadata: event.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (error) {
    logServerError(error as Error, {
      scope: "audit-log/write",
      actorId: event.actorId,
      gymId: event.gymId ?? null,
      type: event.type,
      action: event.action,
    });
  }
}
