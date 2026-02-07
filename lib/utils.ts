import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(paise: number): string {
  const safe = Number.isFinite(paise) ? paise : 0;
  return `₹${(safe / 100).toLocaleString("en-IN")}`;
}

export function slugifyName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildGymSlug(name: string, id: string): string {
  const slug = slugifyName(name || "gym");
  return `${slug || "gym"}--${id}`;
}

export function parseGymIdFromSlug(slug: string): string {
  if (!slug) return slug;
  const parts = slug.split("--");
  return parts.length > 1 ? parts[parts.length - 1] : slug;
}
