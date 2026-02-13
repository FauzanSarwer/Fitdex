import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildGymSlug } from "@/lib/utils";
import { GymCard, type GymCardData } from "@/components/gyms/gym-card";
import { cityLabel, normalizeCityName } from "@/lib/seo/cities";
import { SITE_NAME } from "@/lib/site";
import { buildPageMetadata } from "@/lib/seo/config";
import { breadcrumbSchema, faqSchema } from "@/lib/seo/schema";

type Params = { city: string };
type SearchParams = { page?: string };

const PAGE_SIZE = 24;
const PRIORITY_CITY_SLUGS = ["delhi", "noida", "gurgaon"];

function parseCitySlug(param: string | undefined): string {
  if (!param) return "";
  return normalizeCityName(param);
}

function parsePage(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

async function getGymsForCity(citySlug: string, page: number) {
  const cityRows = await prisma.gym.findMany({
    where: {
      suspendedAt: null,
      verificationStatus: { not: "REJECTED" },
      city: { not: null },
    },
    select: { city: true },
    distinct: ["city"],
  });

  const matchingCities = cityRows
    .map((row) => row.city)
    .filter((city): city is string => Boolean(city))
    .filter((city) => normalizeCityName(city) === citySlug);

  if (matchingCities.length === 0) {
    return { gyms: [], total: 0 };
  }

  const [gyms, total] = await Promise.all([
    prisma.gym.findMany({
      where: {
        suspendedAt: null,
        verificationStatus: { not: "REJECTED" },
        city: { in: matchingCities },
      },
      select: {
        id: true,
        name: true,
        city: true,
        address: true,
        monthlyPrice: true,
        amenities: true,
        coverImageUrl: true,
        imageUrls: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.gym.count({
      where: {
        suspendedAt: null,
        verificationStatus: { not: "REJECTED" },
        city: { in: matchingCities },
      },
    }),
  ]);

  return { gyms, total };
}

export async function generateStaticParams() {
  let cities: Array<{ city: string | null }> = [];
  try {
    cities = await prisma.gym.findMany({
      where: {
        suspendedAt: null,
        verificationStatus: { not: "REJECTED" },
        city: { not: null },
      },
      select: { city: true },
      distinct: ["city"],
    });
  } catch {
    return PRIORITY_CITY_SLUGS.map((city) => ({ city }));
  }

  const dbCities = cities.map((entry) => parseCitySlug(entry.city ?? "")).filter(Boolean);
  const unique = Array.from(new Set([...PRIORITY_CITY_SLUGS, ...dbCities]));
  return unique.map((city) => ({ city }));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const citySlug = parseCitySlug(params?.city);
  if (!citySlug) {
    return { title: `City Gyms | ${SITE_NAME}` };
  }

  const city = cityLabel(citySlug);
  const page = parsePage(searchParams?.page);
  const pageSuffix = page > 1 ? ` - Page ${page}` : "";

  return buildPageMetadata({
    title: `${city} Gyms${pageSuffix} – Compare Pricing & Amenities`,
    description: `Find verified gyms in ${city}. Compare memberships, amenities, and locations before joining.`,
    path: `/gyms-in-${citySlug}${page > 1 ? `?page=${page}` : ""}`,
    city,
  });
}

export const revalidate = 300;

export default async function CityGymsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const citySlug = parseCitySlug(params?.city);
  if (!citySlug) notFound();

  const page = parsePage(searchParams?.page);
  const { gyms, total } = await getGymsForCity(citySlug, page);

  const city = cityLabel(citySlug);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const cards: GymCardData[] = gyms.map((gym) => ({
    id: gym.id,
    slug: buildGymSlug(gym.name, gym.id),
    name: gym.name,
    city: gym.city,
    address: gym.address,
    monthlyPrice: gym.monthlyPrice,
    rating: null,
    amenities: gym.amenities,
    imageUrl: gym.imageUrls?.[0] || gym.coverImageUrl,
  }));

  const allCities = await prisma.gym.findMany({
    where: {
      suspendedAt: null,
      verificationStatus: { not: "REJECTED" },
      city: { not: null },
    },
    select: { city: true },
    distinct: ["city"],
  });

  const cityLinks = allCities
    .map((entry) => parseCitySlug(entry.city ?? ""))
    .filter((slug, index, arr) => slug && arr.indexOf(slug) === index && slug !== citySlug)
    .slice(0, 8);

  const breadcrumbs = breadcrumbSchema([
    { name: "Home", path: "/" },
    { name: `${city} Gyms`, path: `/gyms-in-${citySlug}` },
  ]);

  const cityFaqSchema = faqSchema([
    {
      question: `How do I choose the right gym in ${city}?`,
      answer: `Compare location, pricing, amenities, and available membership plans for gyms in ${city}.`,
    },
    {
      question: `Are gyms listed on ${SITE_NAME} verified?`,
      answer: `Gyms go through a verification process, and verified status is shown on listings where available.`,
    },
  ]);

  if (gyms.length === 0) {
    return (
      <main className="container mx-auto px-4 py-8">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
        <header className="mb-6 space-y-2">
          <h1 className="text-3xl font-bold">{city} Gyms</h1>
          <p className="text-sm text-muted-foreground">No gyms found in this city yet.</p>
        </header>
        {cityLinks.length > 0 && (
          <nav className="space-y-2" aria-label="Other cities">
            <h2 className="text-lg font-semibold">Try nearby cities</h2>
            <div className="flex flex-wrap gap-2">
              {cityLinks.map((slug) => (
                <Link
                  key={slug}
                  href={`/gyms-in-${slug}`}
                  className="rounded-full border border-white/10 px-3 py-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  {cityLabel(slug)}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(cityFaqSchema) }} />

      <header className="mb-6 space-y-2">
        <h1 className="text-3xl font-bold">{city} Gyms</h1>
        <p className="text-sm text-muted-foreground">Browse verified gyms and compare memberships in {city}.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((gym) => (
          <GymCard key={gym.id} gym={gym} />
        ))}
      </section>

      {(hasPrev || hasNext) && (
        <nav className="mt-8 flex items-center justify-between" aria-label="Pagination">
          {hasPrev ? (
            <Link rel="prev" href={`/gyms-in-${citySlug}?page=${page - 1}`} className="text-sm text-primary hover:underline">
              Previous page
            </Link>
          ) : (
            <span />
          )}
          {hasNext ? (
            <Link rel="next" href={`/gyms-in-${citySlug}?page=${page + 1}`} className="text-sm text-primary hover:underline">
              Next page
            </Link>
          ) : null}
        </nav>
      )}

      {cityLinks.length > 0 && (
        <nav className="mt-8 space-y-2" aria-label="Other cities">
          <h2 className="text-lg font-semibold">Explore other cities</h2>
          <div className="flex flex-wrap gap-2">
            {cityLinks.map((slug) => (
              <Link
                key={slug}
                href={`/gyms-in-${slug}`}
                className="rounded-full border border-white/10 px-3 py-1 text-sm text-muted-foreground hover:text-foreground"
              >
                {cityLabel(slug)}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </main>
  );
}
