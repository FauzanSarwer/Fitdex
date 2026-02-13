import { Header } from "@/components/layout/header";
import { LocationGate } from "@/components/layout/location-gate";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { BackgroundBeams } from "@/components/motion/BackgroundBeams";
import { CursorGlow } from "@/components/motion/CursorGlow";
import { PageTransition } from "@/components/motion/PageTransition";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LocationGate>
      <div className="relative min-h-screen bg-background flex flex-col overflow-hidden">
        <BackgroundBeams />
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-48 right-0 h-96 w-96 rounded-full bg-primary/15 blur-[140px]" />
          <div className="absolute top-1/3 -left-24 h-[420px] w-[420px] rounded-full bg-accent/15 blur-[160px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_60%)] dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_60%)]" />
        </div>
        <Header />
        <CursorGlow />
        <main className="pt-16 flex-1">
          <Suspense
            fallback={
              <div className="container mx-auto px-4 py-10">
                <Skeleton className="h-64 rounded-3xl mb-6" />
                <Skeleton className="h-40 rounded-3xl" />
              </div>
            }
          >
            <PageTransition>{children}</PageTransition>
          </Suspense>
        </main>
      </div>
    </LocationGate>
  );
}
