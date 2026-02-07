import type { Session } from "next-auth";
import { z } from "zod";

// Central contract for user session/role
export const SessionUserSchema = z.object({
  id: z.string(),
  email: z.string().email().optional().nullable(),
  name: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
  role: z.enum(["USER", "OWNER", "ADMIN"]).optional(),
});

export function getSessionUser(session: Session | null) {
  if (!session?.user) return null;
  const parsed = SessionUserSchema.safeParse(session.user);
  return parsed.success ? parsed.data : null;
}