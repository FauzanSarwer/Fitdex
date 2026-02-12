const NON_ALPHANUMERIC = /[^a-z0-9\s-]/g;
const WHITESPACE = /\s+/g;
const DASHES = /-+/g;

export function normalizeCityName(city: string): string {
  if (typeof city !== "string") return "";
  return city
    .toLowerCase()
    .trim()
    .replace(NON_ALPHANUMERIC, "")
    .replace(WHITESPACE, "-")
    .replace(DASHES, "-")
    .replace(/^-|-$/g, "");
}

export function cityLabel(citySlug: string): string {
  return citySlug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
