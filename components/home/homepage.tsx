"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BadgePercent, Building2, Calculator, ChevronDown, ShieldCheck, Sparkles } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { useScrollEngine } from "@/components/motion/useScrollEngine";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { accentRgb, accents, type AccentName } from "@/lib/theme/accents";

const lerp = (from: number, to: number, alpha: number) => from + (to - from) * alpha;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const easeOutCubic = (value: number) => 1 - (1 - value) ** 3;
const wordmarkLetters = ["F", "i", "t", "d", "e", "x"] as const;
const wordmarkLetterClassName = "inline-block ml-[-0.05em] first:ml-0";

const featureCards: Array<{
  title: string;
  body: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: AccentName;
}> = [
    {
      title: "Honest pricing",
      body: "See clear monthly plans before you step into a gym.",
      icon: BadgePercent,
      accent: "cyan",
    },
    {
      title: "Verified listings",
      body: "Only real gyms with complete details and active listings.",
      icon: ShieldCheck,
      accent: "indigo",
    },
    {
      title: "All in one place",
      body: "Compare location, timings, amenities, and offers quickly.",
      icon: Building2,
      accent: "violet",
    },
    {
      title: "Built for people",
      body: "Simple search, smooth discovery, and no confusing flow.",
      icon: Sparkles,
      accent: "rose",
    },
  ];

export function HomePageView(): JSX.Element {
  const nextSectionRef = useRef<HTMLElement | null>(null);
  const heroSectionRef = useRef<HTMLElement | null>(null);
  const heroBgRef = useRef<HTMLDivElement | null>(null);
  const heroHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const heroWordmarkShellRef = useRef<HTMLSpanElement | null>(null);
  const heroStarsLayerRef = useRef<HTMLDivElement | null>(null);
  const heroStreakLayerRef = useRef<HTMLDivElement | null>(null);
  const heroAuraRef = useRef<HTMLDivElement | null>(null);
  const heroContentRef = useRef<HTMLDivElement | null>(null);
  const heroSubRef = useRef<HTMLParagraphElement | null>(null);
  const heroCtaRef = useRef<HTMLAnchorElement | null>(null);
  const heroArrowRef = useRef<HTMLSpanElement | null>(null);
  const flowSectionRef = useRef<HTMLElement | null>(null);
  const calculatorPanelRef = useRef<HTMLDivElement | null>(null);
  const calculatorImageRef = useRef<HTMLDivElement | null>(null);
  const calculatorGlowRef = useRef<HTMLDivElement | null>(null);
  const partnerHeadingRef = useRef<HTMLHeadingElement | null>(null);

  const headingRefs = useRef<Array<HTMLHeadingElement | null>>([]);

  const { scrollProgress, scrollVelocity } = useScrollEngine();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [introDone, setIntroDone] = useState(false);

  const scrollToTopGyms = () => {
    const section = nextSectionRef.current;
    if (!section) return;

    const header = document.querySelector("header");
    const headerHeight = header instanceof HTMLElement ? header.getBoundingClientRect().height : 0;
    const heading = headingRefs.current[0] ?? document.getElementById("fitdex-top-gyms-heading");
    if (!(heading instanceof HTMLElement)) return;
    const headingOffset = Number.parseFloat(window.getComputedStyle(heading).scrollMarginTop || "0");
    const baseOffset = headerHeight + headingOffset + 100;
    const targetTop = heading.getBoundingClientRect().top + window.scrollY - baseOffset;
    window.scrollTo({ top: Math.max(targetTop, 0), behavior: "smooth" });
  };

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(media.matches);
    const handler = () => setReduceMotion(media.matches);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      setIntroDone(true);
      return;
    }

    const t = setTimeout(() => setIntroDone(true), 350);
    return () => clearTimeout(t);
  }, [reduceMotion]);

  // Standard Scroll Effects for other sections
  useEffect(() => {
    if (typeof window === "undefined") return;

    const reduceMotionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarsePointerMedia = window.matchMedia("(pointer: coarse)");
    let reduceMotion = reduceMotionMedia.matches;
    let mobileFallback = coarsePointerMedia.matches || window.innerWidth < 900;

    const flowSection = flowSectionRef.current;

    if (flowSection && reduceMotion) {
      flowSection.style.opacity = "1";
      flowSection.style.transform = "translate3d(0, 0, 0) scale(1)";
    }

    const syncMotionPreferences = () => {
      reduceMotion = reduceMotionMedia.matches;
      mobileFallback = coarsePointerMedia.matches || window.innerWidth < 900;
    };

    reduceMotionMedia.addEventListener("change", syncMotionPreferences);
    coarsePointerMedia.addEventListener("change", syncMotionPreferences);
    window.addEventListener("resize", syncMotionPreferences, { passive: true });

    let rafId = 0;
    let wasScrolling = false;
    let settling = false;
    let settleStart = 0;
    let timeScale = 1;
    let sceneTime = performance.now();
    let lastFrameTime = sceneTime;
    const initialIntroProgress = Math.min(window.scrollY / (window.innerHeight * 0.88), 1);
    let flowYCurrent = 140 * (1 - initialIntroProgress);
    let flowScaleCurrent = 0.94 + initialIntroProgress * 0.06;
    let flowOpacityCurrent = 0.36 + initialIntroProgress * 0.64;

    const update = (time: number) => {
      const dt = clamp(time - lastFrameTime, 8, 34);
      lastFrameTime = time;

      const scrollY = window.scrollY;
      const introProgress = Math.min(scrollY / (window.innerHeight * 0.88), 1);
      const simpleMotion = reduceMotion || mobileFallback;

      if (!simpleMotion) {
        const scrollSpeed = Math.abs(scrollVelocity.current);
        const scrollNorm = clamp(scrollSpeed / 1800, 0, 1);
        const scrollActive = scrollSpeed > 10;
        const targetTimeScale = scrollActive ? 0.9 + scrollNorm * 0.34 : 1;

        if (!scrollActive && wasScrolling) {
          settling = true;
          settleStart = time;
        }
        wasScrolling = scrollActive;
        timeScale = lerp(timeScale, targetTimeScale, scrollActive ? 0.14 : 0.08);
      } else {
        wasScrolling = false;
        settling = false;
        timeScale = 1;
      }

      sceneTime += dt * timeScale;
      const animationTime = simpleMotion ? time : sceneTime;

      let settleFactor = 0;
      if (settling) {
        const settleProgress = clamp((time - settleStart) / 520, 0, 1);
        settleFactor = 1 - easeOutCubic(settleProgress);
        if (settleProgress >= 1) {
          settling = false;
        }
      }

      if (flowSectionRef.current && !reduceMotion) {
        const targetY = 140 * (1 - introProgress);
        const targetScale = 0.94 + introProgress * 0.06;
        const targetOpacity = 0.36 + introProgress * 0.64;
        const flowLerp = simpleMotion ? 0.16 : clamp((0.09 + timeScale * 0.04) * (dt / 16), 0.08, 0.24);

        flowYCurrent = lerp(flowYCurrent, targetY, flowLerp);
        flowScaleCurrent = lerp(flowScaleCurrent, targetScale, flowLerp);
        flowOpacityCurrent = lerp(flowOpacityCurrent, targetOpacity, flowLerp);

        const settleDepthCorrection = settleFactor * 3.4;
        flowSectionRef.current.style.transform = `translate3d(0, ${(flowYCurrent - settleDepthCorrection).toFixed(2)}px, 0) scale(${flowScaleCurrent.toFixed(3)})`;
        flowSectionRef.current.style.opacity = flowOpacityCurrent.toFixed(3);
      }

      if (calculatorImageRef.current && !reduceMotion) {
        const driftY = Math.sin(animationTime * 0.00095) * 3.2;
        const rotate = Math.sin(animationTime * 0.00105) * 2.6;
        calculatorImageRef.current.style.transform = `translate3d(0, ${driftY.toFixed(2)}px, 0) rotate(${rotate.toFixed(2)}deg)`;
      }

      if (calculatorGlowRef.current && !reduceMotion) {
        const pulse = 0.2 + ((Math.sin(animationTime * 0.00135) + 1) * 0.5) * 0.22;
        const spin = Math.sin(animationTime * 0.00115) * 14;
        const glowScale = 1 + ((Math.sin(animationTime * 0.00145) + 1) * 0.5) * 0.08;
        calculatorGlowRef.current.style.opacity = pulse.toFixed(3);
        calculatorGlowRef.current.style.transform = `rotate(${spin.toFixed(2)}deg) scale(${glowScale.toFixed(3)})`;
      }

      headingRefs.current.forEach((heading) => {
        if (!heading) return;
        if (reduceMotion) {
          heading.style.transform = "translate3d(0, 0, 0) scale(1)";
          return;
        }
        const rect = heading.getBoundingClientRect();
        const center = rect.top + rect.height * 0.5;
        const distance = Math.abs(center - window.innerHeight * 0.42);
        const influence = 1 - Math.min(distance / (window.innerHeight * 0.9), 1);
        const scale = 0.96 + influence * 0.04;
        heading.style.transform = `translate3d(0, 0, 0) scale(${scale.toFixed(3)})`;
      });

      rafId = window.requestAnimationFrame(update);
    };

    rafId = window.requestAnimationFrame(update);
    return () => {
      window.removeEventListener("resize", syncMotionPreferences);
      reduceMotionMedia.removeEventListener("change", syncMotionPreferences);
      coarsePointerMedia.removeEventListener("change", syncMotionPreferences);
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [scrollProgress, scrollVelocity]);

  // Partner Heading Observer
  useEffect(() => {
    if (typeof window === "undefined") return;

    const heading = partnerHeadingRef.current;
    if (!heading) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      heading.style.opacity = "1";
      heading.style.clipPath = "inset(0 0 0 0)";
      return;
    }

    heading.style.opacity = "0";
    heading.style.clipPath = "inset(0 0 100% 0)";
    heading.style.willChange = "clip-path, opacity";

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) return;

        heading.style.transition = "clip-path 950ms cubic-bezier(0.22,1,0.36,1), opacity 700ms cubic-bezier(0.22,1,0.36,1)";
        heading.style.opacity = "1";
        heading.style.clipPath = "inset(0 0 0 0)";
        window.setTimeout(() => {
          if (heading) heading.style.willChange = "auto";
        }, 980);
        observer.disconnect();
      },
      {
        threshold: 0.35,
      }
    );

    observer.observe(heading);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="w-full">
      <section ref={heroSectionRef} className="fitdex-hero relative isolate min-h-[calc(100vh-4rem)] overflow-hidden">
        <div
          ref={heroBgRef}
          className="absolute inset-0 -z-10"
          style={{ transform: "translate3d(0, 0, 0) scale(1.06)" }}
        >
          <Image
            src="/hero-bg.jpg"
            alt="Modern fitness studio"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center blur-[1.6px] brightness-[0.68] opacity-55"
          />
        </div>
        <div className="absolute inset-0 bg-black/20 -z-10" />
        <div
          className="absolute inset-0 -z-10 opacity-40"
          style={{
            background:
              "radial-gradient(circle at 18% 18%, rgba(56,189,248,0.32), rgba(56,189,248,0) 58%), radial-gradient(circle at 82% 22%, rgba(139,92,246,0.28), rgba(139,92,246,0) 54%)",
          }}
        />
        <div
          className="absolute inset-0 -z-10"
          style={{
            background: "linear-gradient(180deg, rgba(0,0,0,0.16) 0%, rgba(0,0,0,0.28) 52%, hsl(var(--background)) 100%)",
          }}
        />

        {/* DOM Content Overlay */}
        <div
          ref={heroContentRef}
          className="relative z-[5] mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col items-center justify-center px-4 text-center sm:px-6 lg:px-8"
          style={{ pointerEvents: "none" }}
        >
          <div className="space-y-6" style={{ pointerEvents: "auto" }}>
            <h1
              ref={heroHeadingRef}
              className="relative mx-auto flex w-full justify-center text-[clamp(3.1rem,10vw,6.8rem)] font-semibold leading-[0.9] text-white"
            >
              <span className="sr-only">Fitdex</span>
              <span
                ref={heroWordmarkShellRef}
                aria-hidden="true"
                className="fitdex-hero-wordmark fitdex-hero-wordmark-enter opacity-100"
                style={{ fontFamily: "var(--font-inter)" }}
              >
                <span className="fitdex-hero-wordmark-text" data-text="itdex">
                  {wordmarkLetters.map((letter, idx) => (
                    <span
                      key={`${letter}-${idx}`}
                      className={`${wordmarkLetterClassName} fitdex-hero-letter ${idx === 0 ? "fitdex-hero-letter-logo" : ""}`}
                    >
                      {idx === 0 ? (
                        <span className="fitdex-hero-logo-f" aria-hidden="true" />
                      ) : (
                        letter
                      )}
                    </span>
                  ))}
                </span>
                <span className="fitdex-hero-wordmark-sweep" />
              </span>
            </h1>
            <p ref={heroSubRef} className={`fitdex-hero-subtext mx-auto max-w-2xl text-base text-white/80 sm:text-xl transition-opacity duration-1000 ${introDone ? 'opacity-100' : 'opacity-0'}`}>
              Find The Best Gyms Near You At The Best Prices
            </p>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className={`fitdex-hero-explore-btn min-w-36 rounded-xl text-white transition-opacity duration-1000 ${introDone ? "opacity-100" : "opacity-0"}`}
            >
              <Link
                ref={heroCtaRef}
                href="/explore"
                data-accent-color={accentRgb.indigo}
              >
                Explore
              </Link>
            </Button>
          </div>
          <button
            type="button"
            onClick={scrollToTopGyms}
            aria-label="Scroll down"
            className={`absolute bottom-10 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white transition-all duration-1000 hover:bg-white/20 ${introDone ? 'opacity-100' : 'opacity-0'}`}
            style={{ pointerEvents: "auto" }}
          >
            <span ref={heroArrowRef} className="inline-flex animate-home-arrow">
              <ChevronDown className="h-5 w-5" />
            </span>
          </button>
        </div>
      </section>

      <section
        ref={(node) => {
          nextSectionRef.current = node;
          flowSectionRef.current = node;
        }}
        className="relative mx-auto -mt-px w-full max-w-6xl scroll-mt-28 px-4 py-20 text-center sm:px-6 lg:px-8"
      >
        <div
          className="pointer-events-none absolute inset-x-[22%] top-[-10%] h-44 opacity-[0.11]"
          style={{ backgroundImage: accents.indigo.softGlow, filter: "blur(60px)" }}
        />
        <Reveal>
          <h2
            id="fitdex-top-gyms-heading"
            ref={(node) => {
              headingRefs.current[0] = node;
            }}
            className="motion-heading-highlight mx-auto max-w-4xl text-3xl font-semibold sm:text-5xl"
            data-accent-color={accentRgb.indigo}
          >
            All Top Gyms In Your City At One Place
          </h2>
        </Reveal>
      </section>

      <section className="relative mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <div
          className="pointer-events-none absolute left-[10%] top-10 h-40 w-40 rounded-full opacity-[0.1]"
          style={{ backgroundImage: accents.cyan.softGlow, filter: "blur(56px)" }}
        />
        <div className="grid gap-5 md:grid-cols-2">
          {featureCards.map((feature, index) => {
            const Icon = feature.icon;
            const accent = accents[feature.accent];
            return (
              <div
                key={feature.title}
                data-index={index}
              >
                <Card
                  className="fitdex-feature-card group relative h-full overflow-hidden border-white/10 bg-white/[0.04] shadow-[0_16px_28px_rgba(2,8,20,0.18)] transition-[transform,box-shadow,border-color] duration-700 hover:delay-100 hover:-translate-y-2 hover:shadow-[0_24px_40px_rgba(2,8,20,0.26)]"
                  data-accent-color={accentRgb[feature.accent]}
                  style={{
                    transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
                    ["--reveal-delay" as string]: `${index * 120}ms`,
                  }}
                >
                  <div
                    className="motion-border-sweep pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-500 group-hover:delay-100 group-hover:opacity-100"
                    style={{
                      backgroundImage: accent.borderGlow,
                      backgroundSize: "220% 100%",
                    }}
                  />
                  <CardHeader className="space-y-3">
                    <div
                      className="inline-flex h-11 w-11 items-center justify-center rounded-xl"
                      style={{ backgroundImage: accent.gradient }}
                    >
                      <Icon className="h-5 w-5 text-foreground" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground sm:text-base">{feature.body}</p>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </section>

      <section className="relative mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <div
          className="pointer-events-none absolute right-[8%] top-12 h-44 w-44 rounded-full opacity-[0.12]"
          style={{ backgroundImage: accents.violet.softGlow, filter: "blur(64px)" }}
        />
        <Reveal>
          <div
            ref={calculatorPanelRef}
            className="card-bevel relative overflow-hidden rounded-3xl border border-white/10 p-6 shadow-[0_14px_40px_rgba(0,0,0,0.22)] sm:p-8"
            data-accent-color={accentRgb.violet}
            style={{
              backgroundImage: `linear-gradient(120deg, rgba(17,24,39,0.78) 0%, rgba(31,41,55,0.58) 42%, rgba(88,28,135,0.28) 100%), ${accents.violet.gradient}`,
              backgroundSize: "100% 100%",
            }}
          >
            <div className="grid gap-8 md:grid-cols-[1.3fr_0.7fr] md:items-center">
              <div className="space-y-4">
                <h3
                  ref={(node) => {
                    headingRefs.current[1] = node;
                  }}
                  className="motion-heading-highlight text-3xl font-semibold"
                  data-accent-color={accentRgb.violet}
                >
                  AI Health Calculator
                </h3>
                <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                  Get an AI-powered health score, calorie baseline, and practical next steps to stay on track.
                </p>
                <Button
                  asChild
                  variant="ghost"
                  className="rounded-xl px-6 motion-accent-button motion-accent-button-calc border border-white/15 text-white hover:bg-transparent"
                >
                  <Link
                    href="/ai-health-calculator"
                    data-accent-color={accentRgb.fuchsia}
                    style={{ backgroundImage: "linear-gradient(120deg, rgba(139,92,246,0.92) 0%, rgba(217,70,239,0.86) 100%)" }}
                  >
                    Try AI calculator
                  </Link>
                </Button>
              </div>
              <div className="relative mx-auto h-36 w-36 rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-inner shadow-black/20">
                <div ref={calculatorGlowRef} className="absolute inset-3 rounded-2xl bg-violet-500/30 blur-2xl opacity-20" />
                <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-primary/20 blur-2xl" />
                <div className="absolute -bottom-4 -left-4 h-16 w-16 rounded-full bg-accent/20 blur-2xl" />
                <div ref={calculatorImageRef} className="relative h-full w-full">
                  <Image src="/icon.png" alt="Fitdex calculator" fill sizes="144px" className="rounded-2xl object-cover" />
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="relative mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
        <div
          className="pointer-events-none absolute left-[18%] top-[-4%] h-52 w-52 rounded-full opacity-[0.07]"
          style={{ backgroundImage: accents.indigo.softGlow, filter: "blur(72px)" }}
        />
        <div
          className="pointer-events-none absolute right-[12%] bottom-[18%] h-52 w-52 rounded-full opacity-[0.07]"
          style={{ backgroundImage: accents.cyan.softGlow, filter: "blur(80px)" }}
        />
        <Reveal>
            <h2
              ref={(node) => {
                partnerHeadingRef.current = node;
                headingRefs.current[2] = node;
              }}
              className="motion-heading-highlight-partner mb-5 text-3xl font-semibold sm:text-4xl"
              data-accent-color={accentRgb.violet}
              data-text="Become a partner with Fitdex"
            >
              Become a partner with Fitdex
            </h2>
          <div
            className="card-bevel relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 [filter:drop-shadow(0_18px_32px_rgba(0,0,0,0.2))] sm:p-8"
            data-accent-color={accentRgb.indigo}
            style={{
              backgroundImage:
                "linear-gradient(122deg, rgba(15,23,42,0.86) 0%, rgba(30,41,59,0.74) 52%, rgba(51,65,85,0.62) 100%), linear-gradient(138deg, rgba(148,163,184,0.16) 0%, rgba(56,189,248,0.1) 100%)",
              backgroundSize: "100% 100%",
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.12]"
              style={{
                backgroundImage: "linear-gradient(140deg, rgba(148,163,184,0.18) 0%, rgba(56,189,248,0.08) 72%)",
                filter: "blur(48px)",
              }}
            />
            <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <ul className="space-y-2 text-sm text-muted-foreground sm:text-base">
                <li>Get quality leads from nearby members actively searching.</li>
                <li>Showcase your plans, offers, and amenities with full control.</li>
                <li>Grow visibility with transparent listings and verified trust.</li>
              </ul>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="rounded-xl px-7 motion-accent-button motion-accent-button-partner border border-white/15 text-white hover:bg-transparent"
              >
                <Link
                  href="/owners"
                  data-accent-color={accentRgb.amber}
                  style={{ backgroundImage: accents.amber.gradient }}
                >
                  Know more
                  <Calculator className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
