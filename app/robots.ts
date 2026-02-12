import type { MetadataRoute } from "next";
import { getOptionalEnv } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    getOptionalEnv("NEXT_PUBLIC_APP_URL") ||
    getOptionalEnv("NEXTAUTH_URL") ||
    "http://localhost:3000";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/api"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
