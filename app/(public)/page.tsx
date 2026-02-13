import type { Metadata } from "next";
import { buildHomeMetadata } from "@/lib/seo/config";
import { HomePageView } from "@/components/home/homepage";

export async function generateMetadata(): Promise<Metadata> {
  return buildHomeMetadata();
}

export default function HomePage() {
  return <HomePageView />;
}
