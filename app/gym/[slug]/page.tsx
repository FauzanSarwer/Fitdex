import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildGymSlug, formatPrice, parseGymIdFromSlug } from "@/lib/utils";
import { cityLabel, normalizeCityName } from "@/lib/seo/cities";
import { SITE_NAME } from "@/lib/site";
import { GymCard, type GymCardData } from "@/components/gyms/gym-card";
import { buildPageMetadata } from "@/lib/seo/config";
import { breadcrumbSchema, faqSchema } from "@/lib/seo/schema";

export const revalidate = 300;

type Params = { slug: string };

async function getGymBySlug(slug: string) {
  const gymId = parseGymIdFromSlug(slug);
  if (!gymId) return null;

  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: {
      id: true,
      name: true,
      address: true,
      city: true,
      verificationStatus: true,
      monthlyPrice: true,
      yearlyPrice: true,
      coverImageUrl: true,
      imageUrls: true,
      amenities: true,
    },
  });

  return gym;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const gym = await getGymBySlug(params.slug);
  if (!gym) {
    return {
      title: `Gym Not Found | ${SITE_NAME}`,
      robots: { index: false, follow: false },
    };
  }

  const city = gym.city?.trim() ? cityLabel(normalizeCityName(gym.city)) : "India";
  const canonicalPath = `/gym/${buildGymSlug(gym.name, gym.id)}`;

  return buildPageMetadata({
    title: `${gym.name} Gym in ${city} – Membership, Amenities & Pricing`,
    description: `Explore ${gym.name} in ${city}. Check membership pricing, amenities, and gym details before joining.`,
    path: canonicalPath,
    city,
  });
}

export default async function GymDetailPage({ params }: { params: Params }) {
  const gym = await getGymBySlug(params.slug);
  if (!gym) notFound();

  const expectedSlug = buildGymSlug(gym.name, gym.id);
  if (params.slug !== expectedSlug) {
    redirect(`/gym/${expectedSlug}`);
  }

  const citySlug = gym.city?.trim() ? normalizeCityName(gym.city) : "";
  const city = citySlug ? cityLabel(citySlug) : "India";
  const amenities = (gym.amenities ?? []).filter(Boolean);
  const heroImage = gym.imageUrls?.[0] || gym.coverImageUrl || "/placeholder-gym.svg";

  const relatedRaw = gym.city
    ? await prisma.gym.findMany({
        where: {
          id: { not: gym.id },
          city: gym.city,
          verificationStatus: { not: "REJECTED" },
          suspendedAt: null,
        },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          name: true,
          city: true,
          address: true,
          monthlyPrice: true,
          amenities: true,
          coverImageUrl: true,
          imageUrls: true,
        },
      })
    : [];

  const relatedGyms: GymCardData[] = relatedRaw.map((item) => ({
    id: item.id,
    slug: buildGymSlug(item.name, item.id),
    name: item.name,
    city: item.city,
    address: item.address,
    monthlyPrice: item.monthlyPrice,
    rating: null,
    amenities: item.amenities,
    imageUrl: item.imageUrls?.[0] || item.coverImageUrl,
  }));

  const localBusinessJsonLd = {
    "@context": "https://schema.org",
    "@type": "HealthClub",
    name: gym.name,
    image: heroImage,
    address: {
      "@type": "PostalAddress",
      addressLocality: city,
      streetAddress: gym.address,
      addressCountry: "IN",
    },
    priceRange: `From ${formatPrice(gym.monthlyPrice)}`,
  };

  const breadcrumbs = breadcrumbSchema([
    { name: "Home", path: "/" },
    { name: `${city} Gyms`, path: citySlug ? `/gyms-in-${citySlug}` : "/" },
    { name: gym.name, path: `/gym/${expectedSlug}` },
  ]);

  const gymFaqSchema = faqSchema([
    {
      question: `What is the monthly membership price at ${gym.name}?`,
      answer: `Memberships at ${gym.name} start from ${formatPrice(gym.monthlyPrice)} per month.`,
    },
    {
      question: `What amenities are available at ${gym.name}?`,
      answer: amenities.length > 0 ? amenities.join(", ") : "Amenities are being updated for this gym.",
    },
  ]);

  return (
    <main className="container mx-auto px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(gymFaqSchema) }} />

      <article className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">{gym.name}</h1>
          <p className="text-sm text-muted-foreground">{gym.address || city}</p>
          {citySlug && (
            <Link href={`/gyms-in-${citySlug}`} className="text-sm text-primary hover:underline">
              View all gyms in {city}
            </Link>
          )}
        </header>

        <div className="relative aspect-[16/7] w-full overflow-hidden rounded-2xl bg-white/5">
          <Image
            src={heroImage}
            alt={`${gym.name} gym in ${city}`}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 1200px"
            className="object-cover"
          />
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-xs uppercase tracking-wide text-muted-foreground">Monthly</h2>
            <p className="mt-1 text-2xl font-semibold">{formatPrice(gym.monthlyPrice)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-xs uppercase tracking-wide text-muted-foreground">Yearly</h2>
            <p className="mt-1 text-2xl font-semibold">{formatPrice(gym.yearlyPrice)}</p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Amenities</h2>
          {amenities.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {amenities.map((amenity) => (
                <div key={amenity} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
                  <h3>{amenity}</h3>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Amenities not listed yet.</p>
          )}
        </section>

        <div>
          {gym.verificationStatus === "VERIFIED" ? (
            <Link
              href={`/dashboard/user/join/${gym.id}`}
              className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Get Membership at {gym.name}
            </Link>
          ) : (
            <span className="inline-flex rounded-lg border border-white/10 px-4 py-2 text-sm text-muted-foreground">
              Membership unavailable until verification completes
            </span>
          )}
        </div>

        {relatedGyms.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Related gyms in {city}</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {relatedGyms.map((related) => (
                <GymCard key={related.id} gym={related} />
              ))}
            </div>
          </section>
        )}
      </article>
    </main>
  );
}
