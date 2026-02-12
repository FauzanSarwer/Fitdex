import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SpeedInsights } from "@vercel/speed-insights/next";
import React, { Suspense } from "react";

export const metadata: Metadata = {
  title: "Fitdex — District of Gyms",
  description: "Premium gym discovery and duo accountability in Delhi",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Preconnects for performance */}
        <link rel="preconnect" href="https://checkout.razorpay.com" />
        <link rel="preconnect" href="https://cdnjs.cloudflare.com" />
        <link rel="preconnect" href="https://tile.openstreetmap.org" />
        {/* SEO & Social Meta */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#18181b" />
        <meta property="og:title" content="Fitdex — District of Gyms" />
        <meta property="og:description" content="Premium gym discovery and duo accountability in Delhi" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/fitdex-og.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Fitdex — District of Gyms" />
        <meta name="twitter:description" content="Premium gym discovery and duo accountability in Delhi" />
        <meta name="twitter:image" content="/fitdex-og.png" />
      </head>
      <body className="font-sans min-h-screen bg-background antialiased">
        {/* Defensive: Providers should never break layout */}
        <Providers>
          {/* Error boundary and fallback for robustness */}
          <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading...</div>}>
            {children}
          </Suspense>
        </Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}
