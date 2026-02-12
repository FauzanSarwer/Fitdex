import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SpeedInsights } from "@vercel/speed-insights/next";
import React, { Suspense } from "react";
import { SITE_NAME, SITE_DESCRIPTION, getBaseUrl } from "@/lib/site";

const BASE_URL = getBaseUrl();

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: `${SITE_NAME} – Find Gyms Near You in India`,
  description: SITE_DESCRIPTION,
  openGraph: {
    title: `${SITE_NAME} – Find Gyms Near You in India`,
    description: SITE_DESCRIPTION,
    url: BASE_URL,
    siteName: SITE_NAME,
    images: [
      {
        url: `${BASE_URL}/fitdex-og.png`,
        width: 1200,
        height: 630,
        alt: SITE_NAME,
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} – Find Gyms Near You in India`,
    description: SITE_DESCRIPTION,
    images: [`${BASE_URL}/fitdex-og.png`],
  },
  alternates: {
    canonical: `${BASE_URL}/`,
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: BASE_URL,
  logo: `${BASE_URL}/fitdex-logo.png`,
};

const themeInitScript = `
(() => {
  try {
    const stored = localStorage.getItem("fitdex-theme");
    const theme = stored === "light" ? "light" : "dark";
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  } catch (_error) {
    document.documentElement.classList.add("dark");
  }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-sans min-h-screen bg-background antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <Providers>
          <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading...</div>}>
            {children}
          </Suspense>
        </Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}
