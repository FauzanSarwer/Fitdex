import type { Metadata } from "next";
import ExplorePage from "./explore/page";
import { getBaseUrl, SITE_NAME } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = getBaseUrl();
  return {
    title: `${SITE_NAME} – Find Gyms Near You in India`,
    alternates: {
      canonical: `${baseUrl}/`,
    },
  };
}

export default function HomePage() {
  return <ExplorePage />;
}
