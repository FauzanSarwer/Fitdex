export const SITE_NAME = "Fitdex";
export const SITE_DESCRIPTION = "Find verified gyms across India, compare plans, and choose the membership that fits your goals.";

const DEFAULT_HOST = "fitd3x.vercel.app";

function normalizeHost(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
}

export function getBaseUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_URL ??
    DEFAULT_HOST;

  const host = normalizeHost(configured);
  return `https://${host}`;
}
