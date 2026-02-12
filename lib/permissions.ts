import type { Session } from "next-auth";
import { getSessionUser } from "./session-user";

type Role = "USER" | "OWNER" | "ADMIN";

function hasRole(session: Session | null, roles: Role[]): boolean {
  const user = getSessionUser(session);
  const role = user?.role;
  return role != null && roles.includes(role);
}

export function isOwner(session: Session | null): boolean {
  return hasRole(session, ["OWNER", "ADMIN"]);
}

export function isAdmin(session: Session | null): boolean {
  return hasRole(session, ["ADMIN"]);
}

export function isUser(session: Session | null): boolean {
  return hasRole(session, ["USER"]);
}

export function requireUser(session: Session | null): boolean {
  return hasRole(session, ["USER", "ADMIN"]);
}

export function requireOwner(session: Session | null): boolean {
  return hasRole(session, ["OWNER", "ADMIN"]);
}

export function requireAdmin(session: Session | null): boolean {
  return hasRole(session, ["ADMIN"]);
}

export function getUserId(session: Session | null): string | null {
  const user = getSessionUser(session);
  return user?.id ?? null;
}
