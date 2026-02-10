import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const CURRENCY_SYMBOL = "₹"; // Default currency symbol for price formatting
const DEFAULT_SLUG = "gym";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(paise: number): string {
  if (!Number.isFinite(paise)) {
    console.warn("Invalid value for paise in formatPrice:", paise);
    paise = 0;
  }
  return `${CURRENCY_SYMBOL}${(paise / 100).toLocaleString("en-IN")}`;
}

function sanitizeSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function slugifyName(value: string): string {
  if (typeof value !== "string" || !value.trim()) {
    console.warn("Invalid value for slugifyName:", value);
    return "";
  }
  return sanitizeSlug(value);
}

export function buildGymSlug(name: string, id: string): string {
  if (!name || !id) {
    console.warn("Invalid inputs for buildGymSlug:", { name, id });
    return `${DEFAULT_SLUG}--unknown`;
  }
  const slug = sanitizeSlug(name);
  return `${slug || DEFAULT_SLUG}--${id}`;
}

export function parseGymIdFromSlug(slug: string): string {
  if (typeof slug !== "string" || !slug.trim()) {
    console.warn("Invalid value for parseGymIdFromSlug:", slug);
    return "";
  }
  const parts = slug.split("--");
  return parts.length > 1 ? parts[parts.length - 1] : slug;
}
