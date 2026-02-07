import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { LocationGate } from "@/components/layout/location-gate";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LocationGate>
      <div className="relative min-h-screen bg-background flex flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-48 right-0 h-96 w-96 rounded-full bg-primary/20 blur-[140px]" />
          <div className="absolute top-1/3 -left-24 h-[420px] w-[420px] rounded-full bg-accent/20 blur-[160px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_60%)]" />
        </div>
        <Header />
        <main className="pt-16 flex-1">
          <Suspense
            fallback={
              <div className="container mx-auto px-4 py-10">
                <Skeleton className="h-64 rounded-3xl mb-6" />
                <Skeleton className="h-40 rounded-3xl" />
              </div>
            }
          >
            {children}
          </Suspense>
        </main>
        <Footer />
      </div>
    </LocationGate>
  );
}
