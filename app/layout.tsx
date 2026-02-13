import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SpeedInsights } from "@vercel/speed-insights/next";
import React, { Suspense } from "react";
import { organizationSchema } from "@/lib/seo/schema";
import { rootMetadata } from "@/lib/seo/config";
import { Inter, Poppins } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const poppins = Poppins({
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = rootMetadata;

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
    <html lang="en" className={`dark ${inter.variable} ${poppins.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen bg-background antialiased font-poppins">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema()) }}
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
