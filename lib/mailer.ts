import nodemailer from "nodemailer";
import { getOptionalEnv } from "@/lib/env";
import { logServerError } from "@/lib/logger";

let cachedTransport: nodemailer.Transporter | null = null;

function getTransport() {
  if (cachedTransport) return cachedTransport;
  const host = getOptionalEnv("SMTP_HOST");
  const user = getOptionalEnv("SMTP_USER");
  const pass = getOptionalEnv("SMTP_PASS");
  const portRaw = getOptionalEnv("SMTP_PORT");
  if (!host || !user || !pass) return null;
  const port = Number(portRaw || 587);
  const secure = (getOptionalEnv("SMTP_SECURE") ?? "").toLowerCase() === "true" || port === 465;
  const requireTLS = (getOptionalEnv("SMTP_REQUIRE_TLS") ?? "").toLowerCase() === "true";
  const rejectUnauthorized = (getOptionalEnv("SMTP_TLS_REJECT_UNAUTHORIZED") ?? "true").toLowerCase() === "true";
  cachedTransport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    requireTLS,
    tls: { rejectUnauthorized },
  });
  return cachedTransport;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const transport = getTransport();
  const from = getOptionalEnv("EMAIL_FROM") || getOptionalEnv("SMTP_FROM");
  if (!transport || !from) {
    console.warn("[email] SMTP not configured; skipping send.");
    return { ok: false as const, error: "SMTP not configured" };
  }
  try {
    await transport.sendMail({
      from,
      to,
      subject,
      html,
      text,
    });
    return { ok: true as const };
  } catch (error) {
    logServerError(error as Error, { route: "smtp" });
    const message = error instanceof Error ? error.message : "Send failed";
    const response = (error as { response?: string })?.response;
    const code = (error as { code?: string })?.code;
    const detail = [message, response, code].filter(Boolean).join(" | ");
    return { ok: false as const, error: detail || "Send failed" };
  }
}
