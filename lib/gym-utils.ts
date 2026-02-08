export type GymTier = "CORE" | "SUPPORTING" | "EDGE";

export function getGymTierRank(tier?: string | null): number {
  const normalized = (tier ?? "SUPPORTING").toUpperCase();
  if (normalized === "CORE") return 0;
  if (normalized === "SUPPORTING") return 1;
  return 2;
}

export function isGymFeatured(gym: {
  isFeatured?: boolean | null;
  featuredStartAt?: Date | string | null;
  featuredEndAt?: Date | string | null;
  featuredUntil?: Date | string | null;
}): boolean {
  const now = Date.now();
  const start = gym.featuredStartAt ? new Date(gym.featuredStartAt).getTime() : null;
  const end = gym.featuredEndAt ? new Date(gym.featuredEndAt).getTime() : null;
  if (start != null && end != null) {
    if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
    return now >= start && now <= end;
  }
  if (gym.featuredUntil) {
    const until = new Date(gym.featuredUntil).getTime();
    if (!Number.isFinite(until)) return false;
    return until > now;
  }
  return false;
}

export function normalizeAmenities(value?: string | string[] | null): string[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : value.split(",");
  const normalized = list
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/\s+/g, " "));
  return Array.from(new Set(normalized));
}
