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
      <div className="min-h-screen bg-background flex flex-col">
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
