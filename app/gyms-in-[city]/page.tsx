import { notFound } from "next/navigation";
import { siteName, siteDescription, productionUrl } from "@/lib/site";
import { cities, City } from "@/lib/seo/cities";
import type { Metadata } from "next";

const placeholderGyms: Record<City, { name: string; address: string; rating: number }[]> = {
  delhi: [
    { name: "Delhi Fitness Hub", address: "Connaught Place, Delhi", rating: 4.8 },
    { name: "Iron Paradise Delhi", address: "South Extension, Delhi", rating: 4.6 },
    { name: "FitLife Delhi", address: "Dwarka, Delhi", rating: 4.5 },
  ],
  mumbai: [
    { name: "Mumbai Muscle Factory", address: "Andheri West, Mumbai", rating: 4.7 },
    { name: "FitZone Mumbai", address: "Bandra, Mumbai", rating: 4.5 },
    { name: "Powerhouse Mumbai", address: "Powai, Mumbai", rating: 4.6 },
  ],
  bangalore: [
    { name: "Bangalore Power Gym", address: "Koramangala, Bangalore", rating: 4.9 },
    { name: "FitLife Bangalore", address: "Indiranagar, Bangalore", rating: 4.6 },
    { name: "Muscle Garage Bangalore", address: "Whitefield, Bangalore", rating: 4.7 },
  ],
  hyderabad: [
    { name: "Hyderabad Fitness Studio", address: "Banjara Hills, Hyderabad", rating: 4.8 },
    { name: "Iron House Hyderabad", address: "Gachibowli, Hyderabad", rating: 4.5 },
    { name: "FitHub Hyderabad", address: "Kondapur, Hyderabad", rating: 4.6 },
  ],
  chennai: [
    { name: "Chennai Fit Club", address: "T Nagar, Chennai", rating: 4.7 },
    { name: "Muscle Zone Chennai", address: "Velachery, Chennai", rating: 4.5 },
    { name: "Power Gym Chennai", address: "Anna Nagar, Chennai", rating: 4.6 },
  ],
  pune: [
    { name: "Pune Fitness Arena", address: "Koregaon Park, Pune", rating: 4.8 },
    { name: "FitLife Pune", address: "Baner, Pune", rating: 4.6 },
    { name: "Muscle Garage Pune", address: "Hinjewadi, Pune", rating: 4.7 },
  ],
};

export function generateStaticParams() {
  return cities.map((city) => ({ city }));
}

export async function generateMetadata({ params }: { params: { city: City } }): Promise<Metadata> {
  const city = params.city;
  if (!cities.includes(city)) return {};
  const cityName = city.charAt(0).toUpperCase() + city.slice(1);
  return {
    title: `Best Gyms in ${cityName} | ${siteName}`,
    description: `Discover the best gyms in ${cityName} with ${siteName}. Compare gym memberships, facilities, and join top fitness centers near you. ${siteDescription}`,
    keywords: [
      `gyms in ${cityName}`,
      `best gyms ${cityName}`,
      "gyms near me",
      "gym membership India",
      siteName,
      "fitness centers",
    ],
    openGraph: {
      title: `Best Gyms in ${cityName} | ${siteName}`,
      description: `Find and join the best gyms in ${cityName}. Compare memberships and facilities with ${siteName}.`,
      url: `${productionUrl}/gyms-in-${city}`,
      siteName,
      images: [
        {
          url: `${productionUrl}/og-image.jpg`,
          width: 1200,
          height: 630,
          alt: `Gyms in ${cityName}`,
        },
      ],
      locale: "en_IN",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `Best Gyms in ${cityName} | ${siteName}`,
      description: `Discover gyms in ${cityName} and join the best fitness centers with ${siteName}.`,
      site: "@fitdex_in",
      images: [`${productionUrl}/og-image.jpg`],
    },
    alternates: {
      canonical: `${productionUrl}/gyms-in-${city}`,
    },
  };
}

export default function CityGymsPage({ params }: { params: { city: City } }) {
  const city = params.city as City;
  if (!cities.includes(city)) return notFound();
  const cityName = city.charAt(0).toUpperCase() + city.slice(1);
  const gyms = placeholderGyms[city];

  return (
    <main className="max-w-3xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-4">Best Gyms in {cityName} - {siteName}</h1>
      <h2 className="text-xl font-semibold mb-6">Discover & Join Top Fitness Centers Near You</h2>
      <section>
        {gyms.map((gym, idx) => (
          <article key={idx} className="mb-6 p-4 border rounded-lg shadow-sm bg-white">
            <h3 className="text-lg font-bold">{gym.name}</h3>
            <p className="text-sm text-gray-600">{gym.address}</p>
            <p className="text-sm text-yellow-500">Rating: {gym.rating}</p>
          </article>
        ))}
      </section>
      <nav className="mt-8">
        <h2 className="text-md font-semibold mb-2">Explore Gyms in Other Cities</h2>
        <ul className="flex flex-wrap gap-3">
          {cities.filter((c) => c !== city).map((c) => (
            <li key={c}>
              <a href={`/gyms-in-${c}`} className="text-blue-600 underline">{c.charAt(0).toUpperCase() + c.slice(1)}</a>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
