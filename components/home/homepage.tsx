"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, BadgePercent, Building2, Calculator, ShieldCheck, Sparkles } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { useScrollEngine } from "@/components/motion/useScrollEngine";
import { WebGLHero } from "@/components/hero/WebGLHero";
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
  const calculatorCardRef = useRef<HTMLDivElement | null>(null);
  const calculatorPanelRef = useRef<HTMLDivElement | null>(null);
  const calculatorImageRef = useRef<HTMLDivElement | null>(null);
  const partnerHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const partnerCtaRef = useRef<HTMLAnchorElement | null>(null);

  const headingRefs = useRef<Array<HTMLHeadingElement | null>>([]);
  const featureCardRefs = useRef<Array<HTMLDivElement | null>>([]);

  const calculatorTiltTarget = useRef({ x: 0, y: 0 });
  const calculatorTiltCurrent = useRef({ x: 0, y: 0 });
  const calculatorHovering = useRef(false);

  const partnerMagnetTarget = useRef({ x: 0, y: 0 });
  const partnerMagnetCurrent = useRef({ x: 0, y: 0 });
  const partnerHovering = useRef(false);

  const { scrollProgress, scrollVelocity } = useScrollEngine();
  const [sceneReady, setSceneReady] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [introDone, setIntroDone] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(media.matches);
    const handler = () => setReduceMotion(media.matches);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    // If motion is reduced, show everything immediately
    if (reduceMotion) {
      setIntroDone(true);
      return;
    }

    // Otherwise wait for scene to be ready, then wait 3200ms
    if (sceneReady) {
      const t = setTimeout(() => setIntroDone(true), 3200);
      return () => clearTimeout(t);
    }
  }, [reduceMotion, sceneReady]);


  // Standard Scroll Effects for other sections
  useEffect(() => {
    // ... existing scroll logic ... 
    // I am not replacing the big scroll effect block, just inserting ABOVE slightly?
    // Wait, replace_file_content replaces the BLOCK.
    // I need to be careful not to delete the big scroll effect block if I target lines overlapping it.
    // My previous edit replaced lines 83-102.
    // Now I want to replace lines 83-102 again (or slightly more) to encompass new state.
    // The previous edit ended at line 92 + whitespace.
    // The "Standard Scroll Effects" starts at line 105.
    // I will target the same block area.
  }, []); // Wait, I cannot use "useEffect" as replacement content if I don't implement the body.

  // Actually I'll use a precise target.




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

      if (calculatorPanelRef.current && !reduceMotion) {
        const sweep = (animationTime * 0.008 + scrollProgress.current * 90) % 220;
        calculatorPanelRef.current.style.backgroundPosition = `${sweep.toFixed(2)}% 50%`;
      }

      if (calculatorImageRef.current && !reduceMotion) {
        const rotate = scrollProgress.current * 24;
        calculatorImageRef.current.style.transform = `translate3d(0, 0, 0) rotate(${rotate.toFixed(2)}deg)`;
      }

      calculatorTiltCurrent.current.x = lerp(calculatorTiltCurrent.current.x, calculatorTiltTarget.current.x, 0.14);
      calculatorTiltCurrent.current.y = lerp(calculatorTiltCurrent.current.y, calculatorTiltTarget.current.y, 0.14);
      if (calculatorCardRef.current) {
        const scale = calculatorHovering.current ? 1.012 : 1;
        calculatorCardRef.current.style.transform = `translate3d(0, 0, 0) rotateX(${calculatorTiltCurrent.current.y.toFixed(2)}deg) rotateY(${calculatorTiltCurrent.current.x.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      }

      partnerMagnetCurrent.current.x = lerp(partnerMagnetCurrent.current.x, partnerMagnetTarget.current.x, 0.2);
      partnerMagnetCurrent.current.y = lerp(partnerMagnetCurrent.current.y, partnerMagnetTarget.current.y, 0.2);
      if (partnerCtaRef.current && !reduceMotion) {
        const scale = partnerHovering.current ? 1.02 : 1;
        partnerCtaRef.current.style.transform = `translate3d(${partnerMagnetCurrent.current.x.toFixed(2)}px, ${partnerMagnetCurrent.current.y.toFixed(2)}px, 0) scale(${scale.toFixed(3)})`;
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

  // Viewport/Feature Cards Observer
  useEffect(() => {
    if (typeof window === "undefined") return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cards = featureCardRefs.current.filter((card): card is HTMLDivElement => !!card);

    if (cards.length === 0) return;

    if (reduceMotion) {
      cards.forEach((card) => {
        card.style.opacity = "1";
        card.style.transform = "translate3d(0, 0, 0) scale(1)";
        card.style.filter = "none";
      });
      return;
    }

    cards.forEach((card) => {
      card.style.opacity = "0";
      card.style.transform = "translate3d(0, 52px, 0) scale(0.95)";
      card.style.filter = "blur(7px)";
    });

    const timeoutIds: number[] = [];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const node = entry.target as HTMLDivElement;
          const index = Number(node.dataset.index ?? "0");
          const delay = index * 180;
          node.style.willChange = "transform, opacity, filter";
          const timeoutId = window.setTimeout(() => {
            node.style.transition = "opacity 900ms cubic-bezier(0.22,1,0.36,1), transform 900ms cubic-bezier(0.22,1,0.36,1), filter 900ms cubic-bezier(0.22,1,0.36,1)";
            node.style.opacity = "1";
            node.style.transform = "translate3d(0, 0, 0) scale(1)";
            node.style.filter = "blur(0px)";
            window.setTimeout(() => {
              node.style.willChange = "auto";
            }, 980);
          }, delay);
          timeoutIds.push(timeoutId);
          observer.unobserve(node);
        });
      },
      {
        threshold: 0.2,
        rootMargin: "0px 0px -8% 0px",
      }
    );

    cards.forEach((card) => observer.observe(card));
    return () => {
      observer.disconnect();
      timeoutIds.forEach((id) => window.clearTimeout(id));
    };
  }, []);

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
        {/* WebGL Hero Background & Content */}
        {!reduceMotion && (
          <div className={`absolute inset-0 z-0 transition-opacity duration-1000 ${sceneReady ? 'opacity-100' : 'opacity-0'}`}>
            <WebGLHero onSceneReady={() => setSceneReady(true)} />
          </div>
        )}

        {/* Static Fallback / Background layers (Reduced opacity or hidden if WebGL loads) */}
        <div
          ref={heroBgRef}
          className="absolute inset-0 -z-10"
          style={{ transform: "translate3d(0, 0, 0) scale(1.06)" }}
        >
          {/* Keep image for potential fallback or underlying texture if transparent */}
          <Image
            src="/hero-bg.jpg"
            alt="Modern fitness studio"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center blur-[1.2px] opacity-20"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/60 to-background/95 -z-10" />

        {/* DOM Content Overlay */}
        <div
          ref={heroContentRef}
          className="relative z-[5] mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col items-center justify-center px-4 text-center sm:px-6 lg:px-8"
          style={{ pointerEvents: 'none' }} // Let clicks pass through to WebGL where appropriate, but buttons need pointer-events-auto
        >
          <div className="space-y-6" style={{ pointerEvents: 'auto' }}>
            <h1 ref={heroHeadingRef} className="relative mx-auto flex w-full justify-center text-6xl font-semibold leading-[0.94] text-white sm:text-7xl">
              <span className="sr-only">Fitdex</span>
              {/* Visual 3D Text is in WebGLHero */}
              <span
                aria-hidden="true"
                className={`font-inter font-bold tracking-tight transition-opacity duration-500 ${sceneReady ? 'opacity-0' : 'opacity-100'}`}
                style={{ fontFamily: 'var(--font-inter)' }}
              >
                Fitdex
              </span>
            </h1>
            <p ref={heroSubRef} className={`mx-auto max-w-2xl text-base text-white/80 sm:text-xl transition-opacity duration-1000 ${introDone ? 'opacity-100' : 'opacity-0'}`}>
              Find The Best Gyms Near You At The Best Prices
            </p>
            <Button
              asChild
              size="lg"
              className={`min-w-36 rounded-xl border border-white/15 text-white motion-accent-button transition-opacity duration-1000 ${introDone ? 'opacity-100' : 'opacity-0'}`}
            >
              <Link
                ref={heroCtaRef}
                href="/explore"
                data-accent-color={accentRgb.indigo}
                style={{ backgroundImage: accents.indigo.gradient }}
              >
                Explore
              </Link>
            </Button>
          </div>
          <button
            type="button"
            onClick={() => nextSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            aria-label="Scroll down"
            className={`absolute bottom-10 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white transition-all duration-1000 hover:bg-white/20 ${introDone ? 'opacity-100' : 'opacity-0'}`}
            style={{ pointerEvents: 'auto' }}
          >
            <span ref={heroArrowRef} className="inline-flex">
              <ArrowDown className="h-5 w-5" />
            </span>
          </button>
        </div>
      </section>

      <section
        ref={(node) => {
          nextSectionRef.current = node;
          flowSectionRef.current = node;
        }}
        className="relative mx-auto w-full max-w-6xl px-4 py-20 text-center sm:px-6 lg:px-8"
      >
        <div
          className="pointer-events-none absolute inset-x-[22%] top-[-10%] h-44 opacity-[0.11]"
          style={{ backgroundImage: accents.indigo.softGlow, filter: "blur(60px)" }}
        />
        <Reveal>
          <h2
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
                ref={(node) => {
                  featureCardRefs.current[index] = node;
                }}
                data-index={index}
              >
                <Card
                  className="group relative h-full overflow-hidden border-white/10 bg-white/[0.04] transition-[transform,filter,opacity] duration-500 hover:-translate-y-[14px] hover:scale-[1.035] [filter:drop-shadow(0_16px_28px_rgba(0,0,0,0.18))] hover:[filter:drop-shadow(0_30px_48px_rgba(0,0,0,0.3))]"
                  data-accent-color={accentRgb[feature.accent]}
                >
                  <div
                    className="motion-border-sweep pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                    style={{
                      backgroundImage: accent.borderGlow,
                      backgroundSize: "220% 100%",
                    }}
                  />
                  <div
                    className="pointer-events-none absolute -top-14 left-1/2 h-36 w-36 -translate-x-1/2 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                    style={{ backgroundImage: accent.softGlow, filter: "blur(34px)" }}
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
    </div>
  );
}
