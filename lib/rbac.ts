import type { Session } from "next-auth";
import { z } from "zod";
import { getSessionUser } from "./session-user";

export const AppRoleSchema = z.enum(["SUPER_ADMIN", "GYM_ADMIN", "USER"]);
export type AppRole = z.infer<typeof AppRoleSchema>;

export function normalizeAppRole(role?: string | null): AppRole | null {
  if (!role) return null;
  if (role === "SUPER_ADMIN" || role === "ADMIN") return "SUPER_ADMIN";
  if (role === "GYM_ADMIN" || role === "OWNER") return "GYM_ADMIN";
  if (role === "USER") return "USER";
  return null;
}

export function getSessionRole(session: Session | null): AppRole | null {
  const user = getSessionUser(session);
  return normalizeAppRole(user?.role);
}

export function hasAnyRole(session: Session | null, roles: AppRole[]): boolean {
  const role = getSessionRole(session);
  return role != null && roles.includes(role);
}
