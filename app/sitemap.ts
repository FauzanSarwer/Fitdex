import type { MetadataRoute } from "next";
import { getOptionalEnv } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl =
    getOptionalEnv("NEXT_PUBLIC_APP_URL") ||
    getOptionalEnv("NEXTAUTH_URL") ||
    "http://localhost:3000";

  const routes = ["/", "/explore", "/auth/login", "/auth/register"];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: route === "/" ? 1 : 0.7,
  }));
}
