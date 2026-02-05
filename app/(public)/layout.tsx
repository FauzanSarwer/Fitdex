import { Header } from "@/components/layout/header";
import { LocationGate } from "@/components/layout/location-gate";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LocationGate>
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-16">{children}</main>
      </div>
    </LocationGate>
  );
}
