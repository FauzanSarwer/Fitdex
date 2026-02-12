import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { buildGymSlug } from "@/lib/utils";
import { getBaseUrl } from "@/lib/site";
import { normalizeCityName } from "@/lib/seo/cities";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();

  const homepage: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];

  try {
    const [gyms, cityRows] = await Promise.all([
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
      }),
      prisma.gym.findMany({
        where: {
          suspendedAt: null,
          verificationStatus: { not: "REJECTED" },
          city: { not: null },
        },
        select: { city: true, updatedAt: true },
        distinct: ["city"],
      }),
    ]);

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

    return [...homepage, ...cityRoutes, ...gymRoutes];
  } catch {
    return homepage;
  }
}
