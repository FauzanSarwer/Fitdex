import { sendEmail } from "@/lib/mailer";
import { getOptionalEnv } from "@/lib/env";

const appName = getOptionalEnv("NEXT_PUBLIC_APP_NAME") || "Fitdex";

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  if (!resetUrl) return { ok: false as const, error: "Missing reset URL" };
  const subject = `${appName} password reset`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <h2 style="margin:0 0 12px">Reset your ${appName} password</h2>
      <p>We received a request to reset your password. Click the button below to continue.</p>
      <p style="margin:24px 0">
        <a href="${resetUrl}" style="background:#6D28D9;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;display:inline-block">Reset password</a>
      </p>
      <p>If you did not request this, you can safely ignore this email.</p>
    </div>
  `;
  const text = `Reset your ${appName} password: ${resetUrl}`;
  return sendEmail({ to: email, subject, html, text });
}

export async function sendVerificationEmail(email: string, verifyUrl: string, deleteUrl: string) {
  if (!verifyUrl) return { ok: false as const, error: "Missing verification URL" };
  const subject = `Verify your ${appName} email`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <h2 style="margin:0 0 12px">Verify your ${appName} email</h2>
      <p>Thanks for signing up. Please verify your email to unlock full access.</p>
      <p style="margin:24px 0">
        <a href="${verifyUrl}" style="background:#16A34A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;display:inline-block">Verify email</a>
      </p>
      <p style="margin-top:20px">Not you? You can delete this account:</p>
      <p><a href="${deleteUrl}" style="color:#DC2626">Delete my account</a></p>
    </div>
  `;
  const text = `Verify your ${appName} email: ${verifyUrl}\n\nNot you? Delete account: ${deleteUrl}`;
  return sendEmail({ to: email, subject, html, text });
}

export async function sendOwnerRenewalReminderEmail(email: string, gymName: string, daysLeft: number) {
  const subject = `${appName} subscription expiring in ${daysLeft} days`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <h2 style="margin:0 0 12px">${appName} plan expiring soon</h2>
      <p>Your ${gymName} subscription expires in ${daysLeft} days. Renew early to avoid listing downtime.</p>
      <p style="margin:24px 0">
        <a href="${process.env.NEXTAUTH_URL ?? ""}/dashboard/owner/subscription" style="background:#6D28D9;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;display:inline-block">Manage subscription</a>
      </p>
    </div>
  `;
  const text = `Your ${gymName} subscription expires in ${daysLeft} days. Manage subscription at ${process.env.NEXTAUTH_URL ?? ""}/dashboard/owner/subscription`;
  return sendEmail({ to: email, subject, html, text });
}
