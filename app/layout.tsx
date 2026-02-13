import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SpeedInsights } from "@vercel/speed-insights/next";
import React, { Suspense } from "react";
import localFont from "next/font/local";
import { organizationSchema } from "@/lib/seo/schema";
import { rootMetadata } from "@/lib/seo/config";
import { Footer } from "@/components/layout/footer";

const inter = localFont({
  src: "../public/fonts/inter-variable.woff2",
  variable: "--font-inter",
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
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${inter.className} min-h-screen bg-background antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema()) }}
        />
        <Providers>
          <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading...</div>}>
            {children}
          </Suspense>
          <Footer />
        </Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}
