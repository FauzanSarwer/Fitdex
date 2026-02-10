import { sendEmail } from "@/lib/mailer";
import { getOptionalEnv } from "@/lib/env";

const appName = getOptionalEnv("NEXT_PUBLIC_APP_NAME") || "Fitdex";
const EMAIL_STYLES = {
  fontFamily: "font-family:Arial,sans-serif;line-height:1.6;color:#111",
  button: "padding:10px 16px;border-radius:8px;display:inline-block;text-decoration:none;color:#fff",
};

function validateEmailInputs(email: string, url: string, urlType: string) {
  if (!email) return { ok: false as const, error: `Missing recipient email for ${urlType}` };
  if (!url) return { ok: false as const, error: `Missing ${urlType} URL` };
  return { ok: true as const };
}

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  const validation = validateEmailInputs(email, resetUrl, "reset");
  if (!validation.ok) return validation;

  const subject = `${appName} password reset`;
  const html = `
    <div style="${EMAIL_STYLES.fontFamily}">
      <h2 style="margin:0 0 12px">Reset your ${appName} password</h2>
      <p>We received a request to reset your password. Click the button below to continue.</p>
      <p style="margin:24px 0">
        <a href="${resetUrl}" style="background:#6D28D9;${EMAIL_STYLES.button}">Reset password</a>
      </p>
      <p>If you did not request this, you can safely ignore this email.</p>
    </div>
  `;
  const text = `Reset your ${appName} password: ${resetUrl}`;
  return sendEmail({ to: email, subject, html, text });
}

export async function sendVerificationEmail(email: string, verifyUrl: string, deleteUrl: string) {
  const validation = validateEmailInputs(email, verifyUrl, "verification");
  if (!validation.ok) return validation;

  if (!deleteUrl) return { ok: false as const, error: "Missing delete URL" };

  const subject = `Verify your ${appName} email`;
  const html = `
    <div style="${EMAIL_STYLES.fontFamily}">
      <h2 style="margin:0 0 12px">Verify your ${appName} email</h2>
      <p>Thanks for signing up. Please verify your email to unlock full access.</p>
      <p style="margin:24px 0">
        <a href="${verifyUrl}" style="background:#16A34A;${EMAIL_STYLES.button}">Verify email</a>
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
