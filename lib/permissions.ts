import type { Session } from "next-auth";
import { prisma } from "./prisma";
import { getSessionUser } from "./session-user";
import { getSessionRole, type AppRole } from "./rbac";

function hasRole(session: Session | null, roles: AppRole[]): boolean {
  const role = getSessionRole(session);
  return role != null && roles.includes(role);
}

export function getAppRole(session: Session | null): AppRole | null {
  return getSessionRole(session);
}

export function isOwner(session: Session | null): boolean {
  return hasRole(session, ["GYM_ADMIN", "SUPER_ADMIN"]);
}

export function isAdmin(session: Session | null): boolean {
  return hasRole(session, ["SUPER_ADMIN"]);
}

export function isUser(session: Session | null): boolean {
  return hasRole(session, ["USER"]);
}

export function requireUser(session: Session | null): boolean {
  return hasRole(session, ["USER", "GYM_ADMIN", "SUPER_ADMIN"]);
}

export function requireOwner(session: Session | null): boolean {
  return hasRole(session, ["GYM_ADMIN", "SUPER_ADMIN"]);
}

export function requireAdmin(session: Session | null): boolean {
  return hasRole(session, ["SUPER_ADMIN"]);
}

export function requireGymAdmin(session: Session | null): boolean {
  return hasRole(session, ["GYM_ADMIN", "SUPER_ADMIN"]);
}

export function requireSuperAdmin(session: Session | null): boolean {
  return hasRole(session, ["SUPER_ADMIN"]);
}

export function getUserId(session: Session | null): string | null {
  const user = getSessionUser(session);
  return user?.id ?? null;
}

export type GymScopeResult = {
  ok: boolean;
  status: 200 | 401 | 403 | 404;
  role: AppRole | null;
  userId: string | null;
  gym: { id: string; ownerId: string } | null;
};

export async function ensureGymScope(session: Session | null, gymId: string): Promise<GymScopeResult> {
  const userId = getUserId(session);
  const role = getSessionRole(session);
  if (!userId || !role) {
    return { ok: false, status: 401, role: null, userId: null, gym: null };
  }

  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: { id: true, ownerId: true },
  });

  if (!gym) {
    return { ok: false, status: 404, role, userId, gym: null };
  }

  if (role === "SUPER_ADMIN" || gym.ownerId === userId) {
    return { ok: true, status: 200, role, userId, gym };
  }

  return { ok: false, status: 403, role, userId, gym };
}
