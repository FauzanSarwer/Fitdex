"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { isOwner } from "@/lib/permissions";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export function Footer() {
  const { data: session, status } = useSession();
  const showOwnerCta = status !== "loading" && !session;
  const showOwnerExplore = status === "authenticated" && isOwner(session);
  const showPricing = status === "authenticated" && isOwner(session);

  return (
    <footer className="mt-auto border-t border-white/10 bg-white/5 backdrop-blur">
      <div className="container mx-auto px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid gap-8 md:grid-cols-[1.2fr_1fr_1fr] md:items-start"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 shadow-glow-sm">
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
              <div className="text-sm text-muted-foreground">District of Gyms</div>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Discover</div>
            <div className="flex flex-col gap-2">
              <Link href="/explore" className="text-muted-foreground hover:text-foreground transition-colors">
                Explore gyms
              </Link>
              {showPricing && (
                <Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">
                  Membership pricing
                </Link>
              )}
              {showOwnerExplore && (
                <Link href="/dashboard/owner/explore" className="text-muted-foreground hover:text-foreground transition-colors">
                  Owner Explore
                </Link>
              )}
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Trust</div>
            <div className="flex flex-col gap-2">
              <Link href="/owners" className="text-muted-foreground hover:text-foreground transition-colors">
                For gym owners
              </Link>
              <Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                Privacy policy
              </Link>
              <Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
                Terms of service
              </Link>
            </div>
            {showOwnerCta && (
              <Button asChild size="sm" className="mt-2 bg-gradient-to-r from-primary to-accent shadow-glow">
                <Link href="/owners">List your gym</Link>
              </Button>
            )}
          </div>
        </motion.div>
        <div className="mt-8 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Fitdex. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
