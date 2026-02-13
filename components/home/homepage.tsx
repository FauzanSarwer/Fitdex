"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { motion } from "framer-motion";
import { ArrowDown, BadgePercent, Building2, Calculator, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const featureCards = [
  {
    title: "Honest pricing",
    body: "See clear monthly plans before you step into a gym.",
    icon: BadgePercent,
    tone: "from-emerald-500/20 to-emerald-400/5",
  },
  {
    title: "Verified listings",
    body: "Only real gyms with complete details and active listings.",
    icon: ShieldCheck,
    tone: "from-sky-500/20 to-sky-400/5",
  },
  {
    title: "All in one place",
    body: "Compare location, timings, amenities, and offers quickly.",
    icon: Building2,
    tone: "from-indigo-500/20 to-indigo-400/5",
  },
  {
    title: "Built for people",
    body: "Simple search, smooth discovery, and no confusing flow.",
    icon: Sparkles,
    tone: "from-orange-500/20 to-orange-400/5",
  },
];

export function HomePageView(): JSX.Element {
  const nextSectionRef = useRef<HTMLElement | null>(null);

  return (
    <div className="w-full">
      <section className="relative isolate min-h-[calc(100vh-4rem)] overflow-hidden">
        <Image
          src="/home-hero-gym-bg.svg"
          alt="Modern fitness studio"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center blur-[1.2px]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/60 to-background/95" />
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[12%] top-[18%] h-28 w-28 rounded-full bg-primary/18 blur-3xl" />
          <div className="absolute right-[18%] top-[26%] h-24 w-24 rounded-full bg-accent/16 blur-3xl" />
          <div className="absolute bottom-[18%] left-[45%] h-20 w-20 rounded-full bg-white/12 blur-3xl" />
        </div>
        <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col items-center justify-center px-4 text-center sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="space-y-6"
          >
            <h1 className="text-6xl font-semibold tracking-[0.08em] text-white sm:text-7xl">
              <span className="bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent">
                Fitdex
              </span>
            </h1>
            <p className="mx-auto max-w-2xl text-base text-white/80 sm:text-xl">
              Find The Best Gyms Near You At The Best Prices
            </p>
            <Button asChild size="lg" className="min-w-36 rounded-xl bg-white text-black hover:bg-white/90">
              <Link href="/explore">Explore</Link>
            </Button>
          </motion.div>
          <button
            type="button"
            onClick={() => nextSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            aria-label="Scroll down"
            className="absolute bottom-10 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white transition hover:bg-white/20"
          >
            <ArrowDown className="h-5 w-5 animate-home-arrow" />
          </button>
        </div>
      </section>

      <section
        ref={nextSectionRef}
        className="mx-auto w-full max-w-6xl px-4 py-20 text-center sm:px-6 lg:px-8"
      >
        <motion.h2
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-20% 0px" }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="mx-auto max-w-4xl text-3xl font-semibold sm:text-5xl"
        >
          All Top Gyms In Your City At One Place
        </motion.h2>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-2">
          {featureCards.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-15% 0px" }}
                transition={{ duration: 0.5, delay: index * 0.08, ease: "easeOut" }}
              >
                <Card className="h-full border-white/10 bg-white/[0.04] shadow-[0_20px_45px_rgba(0,0,0,0.18)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_55px_rgba(0,0,0,0.28)]">
                  <CardHeader className="space-y-3">
                    <div
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${feature.tone}`}
                    >
                      <Icon className="h-5 w-5 text-foreground" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground sm:text-base">{feature.body}</p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15% 0px" }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-card to-card/40 p-6 shadow-[0_14px_40px_rgba(0,0,0,0.22)] sm:p-8"
        >
          <div className="grid gap-8 md:grid-cols-[1.3fr_0.7fr] md:items-center">
            <div className="space-y-4">
              <h3 className="text-3xl font-semibold">Health Calculator</h3>
              <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                Get a quick score, calorie baseline, and practical next steps to stay on track.
              </p>
              <Button asChild className="rounded-xl px-6">
                <Link href="/ai-health-calculator">Try calculator</Link>
              </Button>
            </div>
            <div className="relative mx-auto h-36 w-36 rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-inner shadow-black/20">
              <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-primary/20 blur-2xl" />
              <div className="absolute -bottom-4 -left-4 h-16 w-16 rounded-full bg-accent/20 blur-2xl" />
              <Image src="/icon.png" alt="Fitdex calculator" fill sizes="144px" className="rounded-2xl object-cover" />
            </div>
          </div>
        </motion.div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
        <h2 className="mb-5 text-3xl font-semibold sm:text-4xl">Become a partner with Fitdex</h2>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15% 0px" }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.22)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_26px_60px_rgba(0,0,0,0.3)] sm:p-8"
        >
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <ul className="space-y-2 text-sm text-muted-foreground sm:text-base">
              <li>Get quality leads from nearby members actively searching.</li>
              <li>Showcase your plans, offers, and amenities with full control.</li>
              <li>Grow visibility with transparent listings and verified trust.</li>
            </ul>
            <Button asChild size="lg" className="rounded-xl px-7">
              <Link href="/owners">
                Know more
                <Calculator className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
