import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(paise: number): string {
  const safe = Number.isFinite(paise) ? paise : 0;
  return `₹${(safe / 100).toLocaleString("en-IN")}`;
}
