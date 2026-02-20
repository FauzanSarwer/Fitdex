import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { LocationGate } from "@/components/layout/location-gate";
import { BackgroundBeams } from "@/components/motion/BackgroundBeams";

export default function AuthLayout({
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
        <main className="pt-[var(--fitdex-header-offset,64px)] flex-1 flex items-center justify-center p-4">{children}</main>
        <Footer />
      </div>
    </LocationGate>
  );
}
