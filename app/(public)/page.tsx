"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { MapPin, Users, CreditCard, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 pointer-events-none" />
      <section className="relative container mx-auto px-4 py-24 md:py-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto text-center"
        >
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/80">
            Your district of gyms.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto">
            Discover gyms near you in Delhi NCR. Join with a partner, get real discounts, and stay accountable.
          </p>
          <div className="mt-10 flex flex-wrap gap-4 justify-center">
            <Button asChild size="lg" className="text-base">
              <Link href="/explore">
                Explore gyms
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-base">
              <Link href="/pricing">Pricing</Link>
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto"
        >
          {[
            {
              icon: MapPin,
              title: "Map-based discovery",
              desc: "See gyms near you on the map. Delhi NCR only.",
            },
            {
              icon: Users,
              title: "Duo accountability",
              desc: "Invite a partner. Stack discounts and show up together.",
            },
            {
              icon: CreditCard,
              title: "Real payments",
              desc: "Pay with Razorpay. Secure and instant activation.",
            },
          ].map((item, i) => (
            <div
              key={i}
              className="glass-card p-6 rounded-2xl border border-white/10"
            >
              <item.icon className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold text-foreground">{item.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{item.desc}</p>
            </div>
          ))}
        </motion.div>
      </section>
    </div>
  );
}
