import type { Session } from "next-auth";
import { getSessionUser } from "./session-user";

type Role = "USER" | "OWNER" | "ADMIN" | "GYM_ADMIN" | "SUPER_ADMIN";

function normalizeRole(role?: string | null): Role | null {
  if (!role) return null;
  if (role === "ADMIN") return "SUPER_ADMIN";
  if (role === "OWNER") return "GYM_ADMIN";
  return role as Role;
}

function hasRole(session: Session | null, roles: Role[]): boolean {
  const user = getSessionUser(session);
  const role = normalizeRole(user?.role);
  return role != null && roles.includes(role);
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
