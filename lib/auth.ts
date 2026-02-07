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

const googleClientId = getOptionalEnv("GOOGLE_CLIENT_ID");
const googleClientSecret = getOptionalEnv("GOOGLE_CLIENT_SECRET");
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
          }),
        ]
      : []),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Strict contract for credentials
        const CredsSchema = z.object({
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
        token.role = (user as { role?: "USER" | "OWNER" | "ADMIN" }).role;
        if (user.email) {
          const u = await prisma.user.findUnique({
            where: { email: user.email },
            select: { emailVerified: true },
          });
          token.emailVerified = !!u?.emailVerified;
        }
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
        if (u?.role) token.role = u.role as "USER" | "OWNER" | "ADMIN";
        if (u?.emailVerified != null) token.emailVerified = !!u.emailVerified;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? token.sub!;
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { emailVerified?: boolean }).emailVerified =
          typeof token.emailVerified === "boolean" ? token.emailVerified : false;
      }
      // Enforce contract
      const parsed = SessionUserSchema.safeParse(session.user);
      if (!parsed.success) throw new Error("Session user contract violated");
      return session;
    },
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const existing = await prisma.user.findUnique({
          where: { email: user.email },
        });
        if (existing && !existing.role) {
          await prisma.user.update({
            where: { id: existing.id },
            data: { role: "USER" },
          });
        }
        if (existing && !existing.emailVerified) {
          await prisma.user.update({
            where: { id: existing.id },
            data: { emailVerified: new Date() },
          });
        }
      }
      if (account?.provider === "credentials" && user?.email) {
        const existing = await prisma.user.findUnique({
          where: { email: user.email },
          select: { id: true, email: true, emailVerified: true },
        });
        if (existing && !existing.emailVerified) {
          const links = await createEmailVerificationLinks(existing.id, existing.email);
          await sendVerificationEmail(existing.email, links.verifyUrl, links.deleteUrl);
        }
      }
      return true;
    },
  },
};
