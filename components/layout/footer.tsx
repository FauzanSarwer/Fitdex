"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const SEO_CITY_LINKS = [
  { label: "Gyms in Delhi", href: "/gyms-in-delhi" },
  { label: "Gyms in Gurugram", href: "/gyms-in-gurugram" },
  { label: "Gyms in Noida", href: "/gyms-in-noida" },
  { label: "Gyms in Mumbai", href: "/gyms-in-mumbai" },
  { label: "Gyms in Pune", href: "/gyms-in-pune" },
  { label: "Gyms in Bangalore", href: "/gyms-in-bangalore" },
  { label: "Gyms in Hyderabad", href: "/gyms-in-hyderabad" },
  { label: "Gyms in Jaipur", href: "/gyms-in-jaipur" },
  { label: "Gyms in Kolkata", href: "/gyms-in-kolkata" },
  { label: "Gyms in Lucknow", href: "/gyms-in-lucknow" },
];

export function Footer() {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith("/dashboard");

  return (
    <footer className={cn("mt-auto border-t border-border/60 bg-card/40 backdrop-blur", isDashboard && "md:pl-56")}>
      <div className="mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid gap-8 lg:grid-cols-[1.2fr_0.9fr_0.9fr_1.4fr] lg:items-start"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card shadow-glow-sm">
              <Image
                src="/fitdex-logo.png"
                alt="Fitdex"
                width={28}
                height={28}
                className="h-7 w-7"
              />
            </div>
            <div>
              <div className="text-lg font-semibold">Fitdex</div>
              <div className="text-sm text-muted-foreground">Find the right gym, faster.</div>
            </div>
          </div>
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
                  key={city.href}
                  href={city.href}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {city.label}
                </Link>
              ))}
            </div>
          </div>
        </motion.div>
        <div className="mt-8 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Fitdex. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
