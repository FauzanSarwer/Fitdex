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
import { hashOtp, normalizePhoneNumber, timingSafeEqual } from "@/lib/otp";
const prismaAny = prisma as any;

const googleClientId = getOptionalEnv("GOOGLE_CLIENT_ID");
const googleClientSecret = getOptionalEnv("GOOGLE_CLIENT_SECRET");
const adminEmails = (getOptionalEnv("ADMIN_EMAILS") ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

function isAdminEmail(email?: string | null) {
  if (!email) return false;
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
    CredentialsProvider({
      id: "phone-otp",
      name: "phone-otp",
      credentials: {
        phoneNumber: { label: "Phone", type: "text" },
        otp: { label: "OTP", type: "text" },
      },
      async authorize(credentials) {
        const PhoneSchema = z.object({
          phoneNumber: z.string().min(8),
          otp: z.string().min(4).max(6),
        });
        const parsed = PhoneSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const phoneNumber = normalizePhoneNumber(parsed.data.phoneNumber);
        if (!phoneNumber) return null;

        const record = await prismaAny.phoneOtp.findUnique({ where: { phoneNumber } });
        if (!record) return null;
        if (record.attempts >= 5) {
          await prismaAny.phoneOtp.delete({ where: { phoneNumber } }).catch(() => undefined);
          return null;
        }
        if (record.expiresAt.getTime() < Date.now()) {
          await prismaAny.phoneOtp.delete({ where: { phoneNumber } }).catch(() => undefined);
          return null;
        }
        const expected = record.codeHash;
        const actual = hashOtp(parsed.data.otp.trim());
        if (!timingSafeEqual(expected, actual)) {
          await prismaAny.phoneOtp.update({
            where: { phoneNumber },
            data: { attempts: record.attempts + 1 },
          });
          return null;
        }

        await prismaAny.phoneOtp.delete({ where: { phoneNumber } }).catch(() => undefined);
        const user = await prisma.user.findFirst({ where: { phoneNumber } });
        if (!user) return null;
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
      const adminEmail = user?.email ?? token.email;
      if (isAdminEmail(adminEmail)) {
        if (token.role !== "ADMIN" && adminEmail) {
          try {
            await prisma.user.update({
              where: { email: adminEmail.toLowerCase() },
              data: { role: "ADMIN" },
            });
          } catch {}
        }
        token.role = "ADMIN";
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
      if (user?.email && isAdminEmail(user.email)) {
        try {
          await prisma.user.update({
            where: { email: user.email.toLowerCase() },
            data: { role: "ADMIN" },
          });
        } catch {}
      }
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
