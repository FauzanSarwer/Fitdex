import type { Session } from "next-auth";
import { getSessionUser } from "./session-user";

export function isOwner(session: Session | null): boolean {
  const user = getSessionUser(session);
  return user?.role === "OWNER" || user?.role === "ADMIN";
}

export function isAdmin(session: Session | null): boolean {
  const user = getSessionUser(session);
  return user?.role === "ADMIN";
}

export function isUser(session: Session | null): boolean {
  const user = getSessionUser(session);
  return user?.role === "USER";
}

export function requireUser(session: Session | null): boolean {
  const user = getSessionUser(session);
  return !!user && (user.role === "USER" || user.role === "ADMIN");
}

export function requireOwner(session: Session | null): boolean {
  const user = getSessionUser(session);
  return !!user && (user.role === "OWNER" || user.role === "ADMIN");
}

export function requireAdmin(session: Session | null): boolean {
  const user = getSessionUser(session);
  return !!user && user.role === "ADMIN";
}

export function getUserId(session: Session | null): string | null {
  const user = getSessionUser(session);
  return user?.id ?? null;
}
