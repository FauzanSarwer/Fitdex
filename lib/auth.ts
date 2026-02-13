import type { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "./prisma";
import { getOptionalEnv, getRequiredEnv } from "./env";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { SessionUserSchema } from "./session-user";
import { createEmailVerificationLinks } from "@/lib/email-verification";
import { sendVerificationEmail } from "@/lib/email";
import { logServerError } from "@/lib/logger";

// Define constants for roles and providers
const ROLES = { USER: "USER", OWNER: "OWNER", ADMIN: "ADMIN" } as const;
const PROVIDERS = { GOOGLE: "google", CREDENTIALS: "credentials" } as const;

// Utility function to update user role
async function updateUserRole(email: string, role: keyof typeof ROLES) {
  try {
    await prisma.user.update({
      where: { email: email.toLowerCase() },
      data: { role },
    });
  } catch (error) {
    logServerError(error as Error, { scope: "auth/updateUserRole", email, role });
  }
}

// Utility function to verify user email
async function verifyUserEmail(userId: string, email: string) {
  try {
    const links = await createEmailVerificationLinks(userId, email);
    await sendVerificationEmail(email, links.verifyUrl, links.deleteUrl);
  } catch (error) {
    logServerError(error as Error, { scope: "auth/verifyUserEmail", userId, email });
  }
}

const googleClientId = getOptionalEnv("GOOGLE_CLIENT_ID");
const googleClientSecret = getOptionalEnv("GOOGLE_CLIENT_SECRET");
const adminEmails = (getOptionalEnv("ADMIN_EMAILS") ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

function isAdminEmail(email?: string | null) {
  if (!email) return false;
  // Defensive: validate email format
  if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) return false;
  const normalized = email.trim().toLowerCase();
  return adminEmails.includes(normalized);
}
const passwordPepper = getRequiredEnv("PASSWORD_PEPPER", {
  allowEmptyInDev: true,
});
const nextAuthSecret = getRequiredEnv("NEXTAUTH_SECRET", { allowEmptyInDev: true });
const googleEnabled = !!googleClientId && !!googleClientSecret;

export const authOptions: NextAuthOptions = {
  secret: nextAuthSecret,
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/auth/login" },
  providers: [
    ...(googleEnabled
      ? [
          GoogleProvider({
            clientId: googleClientId,
            clientSecret: googleClientSecret,
            authorization: {
              params: {
                prompt: "select_account",
              },
            },
          }),
        ]
      : []),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        name: { label: "Name", type: "text" },
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Strict contract for credentials
        const CredsSchema = z.object({
          name: z.string().min(2).max(80).optional(),
          email: z.string().email(),
          password: z.string().min(6),
        });
        const parsed = CredsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase().trim();
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.password) return null;
        const ok = await bcrypt.compare(
          `${parsed.data.password}${passwordPepper}`,
          user.password
        );
        if (!ok) return null;
        if (!user.name && parsed.data.name) {
          try {
            const updated = await prisma.user.update({
              where: { id: user.id },
              data: { name: parsed.data.name.trim() },
            });
            return {
              id: updated.id,
              email: updated.email,
              name: updated.name,
              image: updated.image,
              role: updated.role,
            };
          } catch {}
        }
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        const target = new URL(url);
        if (target.origin === baseUrl) return url;
      } catch {}
      return baseUrl;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: keyof typeof ROLES }).role;
        if (user.email) {
          const u = await prisma.user.findUnique({
            where: { email: user.email },
            select: { emailVerified: true },
          });
          token.emailVerified = !!u?.emailVerified;
        }
      }
      const adminEmail = user?.email ?? token.email;
      if (isAdminEmail(adminEmail)) {
        if (token.role !== ROLES.ADMIN && adminEmail) {
          await updateUserRole(adminEmail, ROLES.ADMIN);
        }
        token.role = ROLES.ADMIN;
      }
      if (trigger === "update" && session) {
        token.name = session.name;
        if (session.role) token.role = session.role;
      }
      if (!token.role && token.sub) {
        const u = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { role: true, emailVerified: true },
        });
        if (u?.role) token.role = u.role as keyof typeof ROLES;
        if (u?.emailVerified != null) token.emailVerified = !!u.emailVerified;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? token.sub ?? session.user.id;
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { emailVerified?: boolean }).emailVerified =
          typeof token.emailVerified === "boolean" ? token.emailVerified : false;
      }
      // Enforce contract
      const parsed = SessionUserSchema.safeParse(session.user);
      if (!parsed.success) {
        logServerError(new Error("Session user contract violated"), {
          scope: "auth/session",
          issues: parsed.error.issues,
          tokenSub: token.sub,
          tokenId: token.id,
        });
        return session;
      }
      return session;
    },
    async signIn({ user, account }) {
      if (user?.email && isAdminEmail(user.email)) {
        await updateUserRole(user.email, ROLES.ADMIN);
      }
      if (account?.provider === PROVIDERS.GOOGLE && user.email) {
        const existing = await prisma.user.findUnique({
          where: { email: user.email },
        });
        if (existing && !existing.role) {
          await updateUserRole(existing.email, ROLES.USER);
        }
        if (existing && !existing.emailVerified) {
          await prisma.user.update({
            where: { id: existing.id },
            data: { emailVerified: new Date() },
          });
        }
      }
      if (account?.provider === PROVIDERS.CREDENTIALS && user?.email) {
        const existing = await prisma.user.findUnique({
          where: { email: user.email },
          select: { id: true, email: true, emailVerified: true },
        });
        if (existing && !existing.emailVerified) {
          await verifyUserEmail(existing.id, existing.email);
        }
      }
      return true;
    },
  },
};
