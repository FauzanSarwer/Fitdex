import type { Metadata } from "next";
import { getBaseUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export const SEO_DEFAULT_CITY = "India";
export const SEO_COUNTRY_CODE = "IN";
export const SEO_LOCALE = "en_IN";

const DEFAULT_OG_IMAGE = "/fitdex-og.png";

type MetadataInput = {
  title: string;
  description: string;
  path: string;
  city?: string;
  noIndex?: boolean;
};

function toAbsoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const base = getBaseUrl();
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildPageMetadata(input: MetadataInput): Metadata {
  const canonical = toAbsoluteUrl(input.path);
  const ogImage = toAbsoluteUrl(DEFAULT_OG_IMAGE);
  const geoCity = input.city?.trim();

  return {
    title: input.title,
    description: input.description,
    alternates: { canonical },
    robots: input.noIndex
      ? { index: false, follow: false, nocache: true }
      : { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: SEO_LOCALE,
      url: canonical,
      title: input.title,
      description: input.description,
      siteName: SITE_NAME,
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${SITE_NAME} preview` }],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [ogImage],
    },
    other: {
      "geo.region": `${SEO_COUNTRY_CODE}${geoCity ? `-${geoCity.toUpperCase()}` : ""}`,
      "geo.placename": geoCity ?? SEO_DEFAULT_CITY,
      "og:locale": SEO_LOCALE,
    },
  };
}

export const rootMetadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  title: {
    default: `${SITE_NAME} – Find Gyms Near You in India`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ["gyms in india", "gym memberships", "fitness marketplace", "fitdex"],
  category: "fitness",
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
};

export function buildHomeMetadata(): Metadata {
  return buildPageMetadata({
    title: `${SITE_NAME} – Find Gyms Near You in India`,
    description: SITE_DESCRIPTION,
    path: "/",
    city: "India",
  });
}
