"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { isOwner } from "@/lib/permissions";
import { Dumbbell } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Footer() {
  const { data: session, status } = useSession();
  const showOwnerCta = status !== "loading" && !session;
  const showOwnerExplore = status === "authenticated" && isOwner(session);

  return (
    <footer className="mt-auto border-t border-white/10 bg-white/5 backdrop-blur">
      <div className="container mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-glow-sm">
              <Dumbbell className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-lg font-semibold">GYMDUO</div>
              <div className="text-sm text-muted-foreground">District of Gyms</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <Link href="/explore" className="text-muted-foreground hover:text-foreground transition-colors">
              Explore
            </Link>
            <Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
            {showOwnerExplore && (
              <Link href="/dashboard/owner/explore" className="text-muted-foreground hover:text-foreground transition-colors">
                Owner Explore
              </Link>
            )}
            {showOwnerCta && (
              <Button asChild size="sm" className="bg-gradient-to-r from-primary to-accent shadow-glow">
                <Link href="/owners">Gym Owner?</Link>
              </Button>
            )}
          </div>
        </motion.div>
        <div className="mt-8 text-xs text-muted-foreground">
          © {new Date().getFullYear()} GymDuo. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
