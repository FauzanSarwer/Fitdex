import type { Session } from "next-auth";

export function isOwner(session: Session | null): boolean {
  return !!(session?.user && (session.user as { role?: string }).role === "OWNER");
}

export function isAdmin(session: Session | null): boolean {
  return !!(session?.user && (session.user as { role?: string }).role === "ADMIN");
}

export function isUser(session: Session | null): boolean {
  return !!(session?.user && (session.user as { role?: string }).role === "USER");
}

export function requireUser(session: Session | null): boolean {
  return !!session?.user && (session.user as { role?: string }).role === "USER";
}

export function requireOwner(session: Session | null): boolean {
  return !!session?.user && (session.user as { role?: string }).role === "OWNER";
}

export function getUserId(session: Session | null): string | null {
  return (session?.user as { id?: string })?.id ?? null;
}
