import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildGymSlug } from "@/lib/utils";
import { GymCard, type GymCardData } from "@/components/gyms/gym-card";
import { cityLabel, normalizeCityName } from "@/lib/seo/cities";
import { getBaseUrl, SITE_NAME } from "@/lib/site";

type Params = { city: string };

function parseCitySlug(param: string | undefined): string {
  if (!param) return "";
  return normalizeCityName(param);
}

async function getGymsForCity(citySlug: string) {
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
    return [];
  }

  return prisma.gym.findMany({
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
  });
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
    return [];
  }

  return cities
    .map((entry) => parseCitySlug(entry.city ?? ""))
    .filter(Boolean)
    .map((city) => ({ city }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const citySlug = parseCitySlug(params?.city);
  if (!citySlug) {
    return {
      title: `City Gyms | ${SITE_NAME}`,
    };
  }
  const city = cityLabel(citySlug);
  const baseUrl = getBaseUrl();

  return {
    title: `${city} Gyms – Find the Best Fitness Centers | ${SITE_NAME}`,
    description: `Find verified gyms in ${city}. Compare amenities and membership plans on ${SITE_NAME}.`,
    alternates: {
      canonical: `${baseUrl}/gyms-in-${citySlug}`,
    },
  };
}

export const revalidate = 300;

export default async function CityGymsPage({ params }: { params: Params }) {
  const citySlug = parseCitySlug(params?.city);
  if (!citySlug) notFound();

  const gyms = await getGymsForCity(citySlug);

  const city = cityLabel(citySlug);

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

  if (gyms.length === 0) {
    return (
      <main className="container mx-auto px-4 py-8">
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
      <header className="mb-6 space-y-2">
        <h1 className="text-3xl font-bold">{city} Gyms</h1>
        <p className="text-sm text-muted-foreground">Browse verified gyms and compare memberships in {city}.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((gym) => (
          <GymCard key={gym.id} gym={gym} />
        ))}
      </section>

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
