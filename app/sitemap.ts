import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { buildGymSlug } from "@/lib/utils";
import { getBaseUrl } from "@/lib/site";
import { normalizeCityName } from "@/lib/seo/cities";

const CHUNK_SIZE = 5000;
export const dynamic = "force-static";

async function safeDbCall<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export async function generateSitemaps() {
  const totalGyms = await safeDbCall(
    () =>
      prisma.gym.count({
        where: {
          suspendedAt: null,
          verificationStatus: { not: "REJECTED" },
        },
      }),
    0
  );

  const chunks = Math.max(1, Math.ceil(totalGyms / CHUNK_SIZE));
  return Array.from({ length: chunks }, (_, id) => ({ id }));
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();

  const staticRoutes: MetadataRoute.Sitemap =
    id === 0
      ? [
          {
            url: `${baseUrl}/`,
            lastModified: new Date(),
            changeFrequency: "daily",
            priority: 1,
          },
          {
            url: `${baseUrl}/gyms-in-delhi`,
            lastModified: new Date(),
            changeFrequency: "daily",
            priority: 0.9,
          },
          {
            url: `${baseUrl}/gyms-in-noida`,
            lastModified: new Date(),
            changeFrequency: "daily",
            priority: 0.9,
          },
          {
            url: `${baseUrl}/gyms-in-gurgaon`,
            lastModified: new Date(),
            changeFrequency: "daily",
            priority: 0.9,
          },
        ]
      : [];

  const gyms = await safeDbCall(
    () =>
      prisma.gym.findMany({
        where: {
          suspendedAt: null,
          verificationStatus: { not: "REJECTED" },
        },
        select: {
          id: true,
          name: true,
          updatedAt: true,
        },
        orderBy: { id: "asc" },
        skip: id * CHUNK_SIZE,
        take: CHUNK_SIZE,
      }),
    []
  );

  const cityRows =
    id === 0
      ? await safeDbCall(
          () =>
            prisma.gym.findMany({
              where: {
                suspendedAt: null,
                verificationStatus: { not: "REJECTED" },
                city: { not: null },
              },
              select: { city: true, updatedAt: true },
              distinct: ["city"],
            }),
          []
        )
      : [];

  const cityRoutes: MetadataRoute.Sitemap = cityRows
    .map((row) => {
      const citySlug = normalizeCityName(row.city ?? "");
      if (!citySlug) return null;
      return {
        url: `${baseUrl}/gyms-in-${citySlug}`,
        lastModified: row.updatedAt,
        changeFrequency: "daily" as const,
        priority: 0.8,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const gymRoutes: MetadataRoute.Sitemap = gyms.map((gym) => ({
    url: `${baseUrl}/gym/${buildGymSlug(gym.name, gym.id)}`,
    lastModified: gym.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...cityRoutes, ...gymRoutes];
}
