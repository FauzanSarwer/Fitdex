"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { MapPin, Users, CreditCard, ArrowRight, ShieldCheck, Sparkles, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-accent/15 pointer-events-none" />
      <div className="absolute -top-20 right-10 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute -bottom-24 left-10 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
      <section className="relative container mx-auto px-4 py-24 md:py-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto text-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs text-muted-foreground">
            Premium gyms. Smarter savings.
          </div>
          <h1 className="mt-6 text-4xl md:text-6xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-white/90 to-white/70">
            Your district of gyms.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto">
            Discover gyms near you in Delhi NCR. Join with a partner, unlock stacked discounts, and stay accountable.
          </p>
          <div className="mt-10 flex flex-wrap gap-4 justify-center">
            <Button asChild size="lg" className="text-base">
              <Link href="/explore">
                Explore gyms
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-base">
              <Link href="/auth/register">Create account</Link>
            </Button>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Verified gyms
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Duo discounts
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" />
              Premium support
            </div>
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
              className="glass-card p-6 rounded-2xl border border-white/10 hover:border-primary/30 transition-all duration-300 hover:-translate-y-1"
            >
              <item.icon className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold text-foreground">{item.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{item.desc}</p>
            </div>
          ))}
        </motion.div>
      </section>

      <section className="relative container mx-auto px-4 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid gap-6 lg:grid-cols-3"
        >
          {[
            { label: "Gyms onboarded", value: "120+" },
            { label: "Active members", value: "6,500+" },
            { label: "Avg. monthly savings", value: "₹850" },
          ].map((stat) => (
            <div key={stat.label} className="glass-card rounded-2xl border border-white/10 p-6">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-3xl font-bold mt-2">{stat.value}</p>
            </div>
          ))}
        </motion.div>
      </section>

      <section className="container mx-auto px-4 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-5xl mx-auto"
        >
          <h2 className="text-2xl md:text-3xl font-semibold text-center">How it works</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              {
                title: "Discover",
                desc: "Browse verified gyms near you with transparent pricing and reviews.",
              },
              {
                title: "Pair up",
                desc: "Invite a partner to unlock stacked discounts and stay consistent.",
              },
              {
                title: "Activate",
                desc: "Pay securely and get instant access to your membership.",
              },
            ].map((step, idx) => (
              <div key={step.title} className="glass-card rounded-2xl border border-white/10 p-6">
                <div className="text-xs uppercase tracking-widest text-primary">Step {idx + 1}</div>
                <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 flex justify-center">
            <Button asChild size="lg">
              <Link href="/explore">Start exploring</Link>
            </Button>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
