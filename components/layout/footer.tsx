import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

const SEO_CITY_LINKS = [
  { label: "Gyms in Delhi", city: "Delhi" },
  { label: "Gyms in Gurugram", city: "Gurugram" },
  { label: "Gyms in Noida", city: "Noida" },
  { label: "Gyms in Mumbai", city: "Mumbai" },
  { label: "Gyms in Pune", city: "Pune" },
  { label: "Gyms in Bangalore", city: "Bangalore" },
  { label: "Gyms in Hyderabad", city: "Hyderabad" },
  { label: "Gyms in Jaipur", city: "Jaipur" },
  { label: "Gyms in Kolkata", city: "Kolkata" },
  { label: "Gyms in Lucknow", city: "Lucknow" },
];

export function Footer({ className }: { className?: string }) {
  return (
    <footer className={cn("mt-auto border-t border-border/60 bg-card/40 backdrop-blur", className)}>
      <div className="mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.9fr_0.9fr_1.4fr] lg:items-start">
          <Link href="/" className="group flex items-center gap-3 transition-transform duration-300 hover:-translate-y-0.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card shadow-glow-sm transition-all duration-300 group-hover:bg-card/95 group-hover:shadow-[0_12px_26px_rgba(0,0,0,0.24)]">
              <Image
                src="/fitdex-logo.png"
                alt="Fitdex"
                width={28}
                height={28}
                className="h-7 w-7 object-contain rotate-0 skew-x-0 skew-y-0 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3"
              />
            </div>
            <div>
              <div className="text-lg font-semibold transition-all duration-300 group-hover:text-foreground group-hover:[text-shadow:0_0_16px_rgba(255,255,255,0.35)]">
                Fitdex
              </div>
              <div className="text-sm text-muted-foreground">Find the right gym, faster.</div>
            </div>
          </Link>
          <div className="space-y-3 text-sm">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Discover</div>
            <div className="flex flex-col gap-2">
              <Link href="/explore" className="text-muted-foreground hover:text-foreground transition-colors">
                Explore gyms
              </Link>
              <Link href="/ai-health-calculator" className="text-muted-foreground hover:text-foreground transition-colors">
                Health calculator
              </Link>
              <Link href="/owners" className="text-muted-foreground hover:text-foreground transition-colors">
                Become a partner
              </Link>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Trust</div>
            <div className="flex flex-col gap-2">
              <Link href="/owners" className="text-muted-foreground hover:text-foreground transition-colors">
                About
              </Link>
              <Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
                Terms
              </Link>
              <Link href="mailto:support@fitdex.in" className="text-muted-foreground hover:text-foreground transition-colors">
                Contact
              </Link>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Cities</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SEO_CITY_LINKS.map((city) => (
                <Link
                  key={city.city}
                  href={`/explore?city=${encodeURIComponent(city.city)}`}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {city.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-8 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Fitdex. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
