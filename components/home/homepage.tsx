"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowDown, BadgePercent, Building2, Calculator, ShieldCheck, Sparkles } from "lucide-react";
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

  useEffect(() => {
    if (typeof window === "undefined") return;

    const heroSection = heroSectionRef.current;
    const wordmark = heroWordmarkShellRef.current;
    const streakLayer = heroStreakLayerRef.current;
    const starsLayer = heroStarsLayerRef.current;
    const aura = heroAuraRef.current;
    const heroContent = heroContentRef.current;

    if (!heroSection || !wordmark || !streakLayer || !starsLayer || !aura || !heroContent) return;

    const reduceMotionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    const introEase = "cubic-bezier(0.22,1,0.36,1)";
    const introTimers: number[] = [];
    const streakAnimations: Animation[] = [];

    let introDestroyed = false;
    let parallaxRafId = 0;
    const origin = { x: 0, y: 0 };

    const clearChildren = (node: HTMLElement) => {
      while (node.firstChild) {
        node.removeChild(node.firstChild);
      }
    };

    const syncOriginPoint = () => {
      const heroRect = heroSection.getBoundingClientRect();
      const wordmarkRect = wordmark.getBoundingClientRect();
      origin.x = wordmarkRect.left + wordmarkRect.width * 0.5 - heroRect.left;
      origin.y = wordmarkRect.top + wordmarkRect.height * 0.5 - heroRect.top;
      aura.style.left = `${origin.x.toFixed(2)}px`;
      aura.style.top = `${origin.y.toFixed(2)}px`;
    };

    const createStar = (x: number, y: number, mode: "entry" | "ambient" | "static") => {
      const star = document.createElement("span");
      const size = 1.6 + Math.random() * 3.3;
      const baseOpacity = mode === "entry" ? 0.16 + Math.random() * 0.08 : 0.08 + Math.random() * 0.08;
      const peakOpacity = Math.min(baseOpacity + 0.12 + Math.random() * 0.12, 0.42);

      star.className = "fitdex-hero-star";
      star.style.left = `calc(${origin.x.toFixed(2)}px + ${x.toFixed(2)}px)`;
      star.style.top = `calc(${origin.y.toFixed(2)}px + ${y.toFixed(2)}px)`;
      star.style.width = `${size.toFixed(2)}px`;
      star.style.height = `${size.toFixed(2)}px`;
      star.style.setProperty("--fitdex-star-min", baseOpacity.toFixed(3));
      star.style.setProperty("--fitdex-star-max", peakOpacity.toFixed(3));
      star.style.setProperty("--fitdex-star-duration", `${(7 + Math.random() * 5).toFixed(2)}s`);
      star.style.setProperty("--fitdex-star-delay", `${(Math.random() * 4).toFixed(2)}s`);
      starsLayer.appendChild(star);

      if (mode === "static") {
        star.style.opacity = baseOpacity.toFixed(3);
        return;
      }

      if (mode === "ambient") {
        star.style.opacity = baseOpacity.toFixed(3);
        star.classList.add("fitdex-hero-star-twinkle");
        return;
      }

      star.style.opacity = "0";
      star.style.transform = "translate3d(-50%, -50%, 0) scale(0.46)";
      star.style.filter = "blur(4px)";
      star.style.transition = `opacity 620ms ${introEase}, transform 620ms ${introEase}, filter 620ms ${introEase}`;
      const revealTimer = window.setTimeout(() => {
        if (introDestroyed) return;
        star.style.opacity = baseOpacity.toFixed(3);
        star.style.transform = "translate3d(-50%, -50%, 0) scale(1)";
        star.style.filter = "blur(0px)";
      }, 16);
      introTimers.push(revealTimer);
      const twinkleTimer = window.setTimeout(() => {
        if (introDestroyed) return;
        star.style.transition = "none";
        star.classList.add("fitdex-hero-star-twinkle");
      }, 660);
      introTimers.push(twinkleTimer);
    };

    const seedStarField = (count: number, mode: "ambient" | "static") => {
      const maxRadius = Math.min(window.innerWidth * 0.45, 470);
      for (let index = 0; index < count; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 120 + Math.random() * maxRadius;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * (radius * 0.56);
        createStar(x, y, mode);
      }
    };

    const applyStaticHero = () => {
      syncOriginPoint();
      clearChildren(streakLayer);
      clearChildren(starsLayer);
      wordmark.style.transition = "none";
      wordmark.style.opacity = "1";
      wordmark.style.filter = "blur(0px)";
      wordmark.style.transform = "translate3d(0, 0, 0) scale(1)";
      wordmark.style.willChange = "auto";
      aura.classList.remove("fitdex-hero-aura-active");
      aura.style.opacity = "0.16";
      aura.style.filter = "blur(32px)";
      aura.style.backgroundPosition = "50% 50%";
      aura.style.transform = "translate3d(-50%, -50%, 0) scale(1)";
      starsLayer.style.transform = "translate3d(0, 0, 0)";
      heroContent.style.transform = "translate3d(0, 0, 0)";
      seedStarField(12, "static");
    };

    const runParallax = () => {
      parallaxRafId = 0;
      if (reduceMotionMedia.matches) return;
      const travel = clamp(window.scrollY, 0, window.innerHeight * 1.12);
      const starsY = travel * 0.055;
      const auraY = travel * 0.09;
      const auraScale = 1 + Math.min(travel / (window.innerHeight * 32), 0.035);
      starsLayer.style.transform = `translate3d(0, ${starsY.toFixed(2)}px, 0)`;
      aura.style.transform = `translate3d(-50%, calc(-50% + ${auraY.toFixed(2)}px), 0) scale(${auraScale.toFixed(3)})`;
      heroContent.style.transform = "translate3d(0, 0, 0)";
    };

    const requestParallaxFrame = () => {
      if (parallaxRafId) return;
      parallaxRafId = window.requestAnimationFrame(runParallax);
    };

    if (reduceMotionMedia.matches) {
      applyStaticHero();
      return;
    }

    syncOriginPoint();
    clearChildren(streakLayer);
    clearChildren(starsLayer);

    wordmark.style.opacity = "0";
    wordmark.style.filter = "blur(10px)";
    wordmark.style.transform = "translate3d(0, 0, 0) scale(0.96)";
    wordmark.style.willChange = "transform, opacity, filter";
    wordmark.style.transition = "none";

    aura.classList.remove("fitdex-hero-aura-active");
    aura.style.opacity = "0";
    aura.style.filter = "blur(36px)";
    aura.style.backgroundPosition = "50% 50%";
    aura.style.transform = "translate3d(-50%, -50%, 0) scale(0.94)";

    const wordmarkRevealTimer = window.setTimeout(() => {
      if (introDestroyed) return;
      wordmark.style.transition = `opacity 1200ms ${introEase}, transform 1200ms ${introEase}, filter 1200ms ${introEase}`;
      wordmark.style.opacity = "1";
      wordmark.style.filter = "blur(0px)";
      wordmark.style.transform = "translate3d(0, 0, 0) scale(1)";
    }, 16);
    introTimers.push(wordmarkRevealTimer);

    const releaseWordmarkWillChange = window.setTimeout(() => {
      if (introDestroyed) return;
      wordmark.style.willChange = "auto";
    }, 1420);
    introTimers.push(releaseWordmarkWillChange);

    const streakCount = 8;
    const baseRadius = Math.min(window.innerWidth * 0.28, 320);
    let finishedStreaks = 0;

    const activateCalmState = () => {
      aura.classList.add("fitdex-hero-aura-active");
      seedStarField(10, "ambient");
    };

    for (let index = 0; index < streakCount; index += 1) {
      const streak = document.createElement("span");
      const length = 118 + Math.random() * 112;
      const thickness = 1 + Math.random() * 0.8;
      const angle = (360 / streakCount) * index + (Math.random() * 24 - 12);
      const radians = (angle * Math.PI) / 180;
      const distance = baseRadius + Math.random() * 170;
      const dx = Math.cos(radians) * distance;
      const dy = Math.sin(radians) * distance * 0.62;
      const perpX = -Math.sin(radians);
      const perpY = Math.cos(radians);
      const curve = (12 + Math.random() * 20) * (index % 2 === 0 ? 1 : -1);
      const bendX = dx * 0.56 + perpX * curve;
      const bendY = dy * 0.56 + perpY * curve;
      const endX = dx + perpX * curve * 0.78;
      const endY = dy + perpY * curve * 0.78;
      const duration = 900 + Math.random() * 300;
      const delay = 280 + index * 58 + Math.random() * 120;

      const streakGradient =
        index % 3 === 0
          ? "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(129,140,248,0.9) 42%, rgba(56,189,248,0.62) 74%, rgba(255,255,255,0) 100%)"
          : index % 3 === 1
            ? "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(56,189,248,0.9) 40%, rgba(99,102,241,0.6) 72%, rgba(255,255,255,0) 100%)"
            : "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(217,70,239,0.82) 38%, rgba(129,140,248,0.58) 72%, rgba(255,255,255,0) 100%)";

      streak.className = "fitdex-hero-streak";
      streak.style.left = `${origin.x.toFixed(2)}px`;
      streak.style.top = `${origin.y.toFixed(2)}px`;
      streak.style.width = `${length.toFixed(2)}px`;
      streak.style.height = `${thickness.toFixed(2)}px`;
      streak.style.backgroundImage = streakGradient;
      streakLayer.appendChild(streak);

      const streakAnimation = streak.animate(
        [
          {
            transform: `translate3d(0px, 0px, 0) rotate(${angle.toFixed(2)}deg) scaleX(0.2)`,
            opacity: 0,
            filter: "blur(1.8px)",
          },
          {
            offset: 0.2,
            transform: `translate3d(${(dx * 0.2).toFixed(2)}px, ${(dy * 0.2).toFixed(2)}px, 0) rotate(${(angle + curve * 0.02).toFixed(2)}deg) scaleX(0.68)`,
            opacity: 0.94,
            filter: "blur(0.6px)",
          },
          {
            offset: 0.62,
            transform: `translate3d(${bendX.toFixed(2)}px, ${bendY.toFixed(2)}px, 0) rotate(${(angle + curve * 0.14).toFixed(2)}deg) scaleX(1.02)`,
            opacity: 0.52,
            filter: "blur(1px)",
          },
          {
            transform: `translate3d(${endX.toFixed(2)}px, ${endY.toFixed(2)}px, 0) rotate(${(angle + curve * 0.2).toFixed(2)}deg) scaleX(1.06)`,
            opacity: 0,
            filter: "blur(1.8px)",
          },
        ],
        {
          duration,
          delay,
          easing: introEase,
          fill: "forwards",
        }
      );

      streakAnimations.push(streakAnimation);
      streakAnimation.onfinish = () => {
        streak.remove();
        if (introDestroyed) return;
        createStar(endX, endY, "entry");
        finishedStreaks += 1;
        if (finishedStreaks === streakCount) {
          const auraTimer = window.setTimeout(() => {
            if (introDestroyed) return;
            activateCalmState();
          }, 120);
          introTimers.push(auraTimer);
        }
      };
      streakAnimation.oncancel = () => {
        streak.remove();
      };
    }

    window.addEventListener("scroll", requestParallaxFrame, { passive: true });
    const handleResize = () => {
      syncOriginPoint();
      requestParallaxFrame();
    };
    window.addEventListener("resize", handleResize, { passive: true });
    requestParallaxFrame();

    const handleMotionChange = (event: MediaQueryListEvent) => {
      if (!event.matches) return;
      introDestroyed = true;
      streakAnimations.forEach((animation) => animation.cancel());
      introTimers.forEach((timer) => window.clearTimeout(timer));
      if (parallaxRafId) {
        window.cancelAnimationFrame(parallaxRafId);
        parallaxRafId = 0;
      }
      window.removeEventListener("scroll", requestParallaxFrame);
      window.removeEventListener("resize", handleResize);
      applyStaticHero();
    };

    reduceMotionMedia.addEventListener("change", handleMotionChange);

    return () => {
      introDestroyed = true;
      introTimers.forEach((timer) => window.clearTimeout(timer));
      streakAnimations.forEach((animation) => animation.cancel());
      reduceMotionMedia.removeEventListener("change", handleMotionChange);
      window.removeEventListener("scroll", requestParallaxFrame);
      window.removeEventListener("resize", handleResize);
      if (parallaxRafId) {
        window.cancelAnimationFrame(parallaxRafId);
      }
      wordmark.style.willChange = "auto";
      clearChildren(streakLayer);
      clearChildren(starsLayer);
    };
  }, []);

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
          className="absolute inset-0"
          style={{ transform: "translate3d(0, 0, 0) scale(1.06)" }}
        >
          <Image
            src="/hero-bg.jpg"
            alt="Modern fitness studio"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center blur-[1.2px]"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/60 to-background/95" />
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[12%] top-[18%] h-28 w-28 rounded-full bg-primary/18 blur-3xl" />
          <div className="absolute right-[18%] top-[26%] h-24 w-24 rounded-full bg-accent/16 blur-3xl" />
          <div className="absolute bottom-[18%] left-[45%] h-20 w-20 rounded-full bg-white/12 blur-3xl" />
        </div>
        <div ref={heroStarsLayerRef} aria-hidden="true" className="fitdex-hero-stars pointer-events-none absolute inset-0 z-[2] overflow-hidden" />
        <div ref={heroStreakLayerRef} aria-hidden="true" className="fitdex-hero-streaks pointer-events-none absolute inset-0 z-[3] overflow-hidden" />
        <div
          ref={heroAuraRef}
          aria-hidden="true"
          className="fitdex-hero-aura pointer-events-none absolute left-1/2 top-1/2 z-[2] h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 opacity-0"
        />
        <div
          ref={heroContentRef}
          className="relative z-[5] mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col items-center justify-center px-4 text-center sm:px-6 lg:px-8"
        >
          <div className="space-y-6">
            <h1 ref={heroHeadingRef} className="relative mx-auto flex w-full justify-center text-6xl font-semibold leading-[0.94] text-white sm:text-7xl">
              <span
                ref={heroWordmarkShellRef}
                className="group/wordmark relative mx-auto inline-flex cursor-pointer select-none items-center justify-center overflow-hidden rounded-[0.08em] px-[0.025em] text-center align-middle tracking-[-0.048em] opacity-100 transform-gpu transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.03]"
                style={{ transform: "translate3d(0, 0, 0) scale(1)" }}
              >
                <span
                  className="relative z-[3] inline-flex items-center justify-center font-semibold text-white opacity-100 transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/wordmark:opacity-[0.98]"
                  style={{
                    textShadow: "0 1px 2px rgba(0,0,0,0.16), 0 0 34px rgba(235,241,255,0.14)",
                  }}
                >
                  {wordmarkLetters.map((letter, index) => (
                    <span key={`main-${index}`} className={wordmarkLetterClassName}>
                      {letter}
                    </span>
                  ))}
                </span>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-[1] rounded-[0.16em] bg-white/10 opacity-0 transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/wordmark:opacity-100"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-[2] inline-flex items-center justify-center opacity-0 transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/wordmark:opacity-100"
                >
                  <span className="inline-flex items-center justify-center transform-gpu -translate-x-[118%] transition-transform duration-[540ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/wordmark:translate-x-[118%]">
                    {wordmarkLetters.map((letter, index) => (
                      <span
                        key={`sweep-${index}`}
                        className={`${wordmarkLetterClassName} bg-[linear-gradient(110deg,rgba(255,255,255,0)_20%,rgba(255,255,255,0.9)_50%,rgba(255,255,255,0)_80%)] bg-[length:180%_100%] bg-[position:50%_50%] bg-clip-text text-transparent`}
                      >
                        {letter}
                      </span>
                    ))}
                  </span>
                </span>
              </span>
            </h1>
            <p ref={heroSubRef} className="mx-auto max-w-2xl text-base text-white/80 sm:text-xl">
              Find The Best Gyms Near You At The Best Prices
            </p>
            <Button
              asChild
              size="lg"
              className="min-w-36 rounded-xl border border-white/15 text-white motion-accent-button"
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
            className="absolute bottom-10 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white transition hover:bg-white/20"
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

      <section className="relative mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <div
          className="pointer-events-none absolute right-[8%] top-12 h-44 w-44 rounded-full opacity-[0.12]"
          style={{ backgroundImage: accents.violet.softGlow, filter: "blur(64px)" }}
        />
        <Reveal>
          <div
            ref={calculatorPanelRef}
            className="overflow-hidden rounded-3xl border border-white/10 p-6 shadow-[0_14px_40px_rgba(0,0,0,0.22)] sm:p-8"
            data-accent-color={accentRgb.violet}
            style={{
              backgroundImage: `linear-gradient(120deg, rgba(17,24,39,0.78) 0%, rgba(31,41,55,0.58) 42%, rgba(88,28,135,0.28) 100%), ${accents.violet.gradient}`,
              backgroundSize: "220% 100%",
              backgroundPosition: "0% 50%",
            }}
            onPointerEnter={() => {
              calculatorHovering.current = true;
            }}
            onPointerMove={(event) => {
              const node = calculatorPanelRef.current;
              if (!node) return;
              const rect = node.getBoundingClientRect();
              const px = (event.clientX - rect.left) / rect.width - 0.5;
              const py = (event.clientY - rect.top) / rect.height - 0.5;
              calculatorTiltTarget.current.x = px * 8;
              calculatorTiltTarget.current.y = -py * 8;
            }}
            onPointerLeave={() => {
              calculatorHovering.current = false;
              calculatorTiltTarget.current.x = 0;
              calculatorTiltTarget.current.y = 0;
            }}
          >
            <div ref={calculatorCardRef} className="grid gap-8 md:grid-cols-[1.3fr_0.7fr] md:items-center">
              <div className="space-y-4">
                <h3
                  ref={(node) => {
                    headingRefs.current[1] = node;
                  }}
                  className="motion-heading-highlight text-3xl font-semibold"
                  data-accent-color={accentRgb.violet}
                >
                  Health Calculator
                </h3>
                <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                  Get a quick score, calorie baseline, and practical next steps to stay on track.
                </p>
                <Button asChild className="rounded-xl px-6 motion-accent-button border border-white/15 text-white">
                  <Link
                    href="/ai-health-calculator"
                    data-accent-color={accentRgb.fuchsia}
                    style={{ backgroundImage: "linear-gradient(120deg, rgba(139,92,246,0.92) 0%, rgba(217,70,239,0.86) 100%)" }}
                  >
                    Try calculator
                  </Link>
                </Button>
              </div>
              <div className="relative mx-auto h-36 w-36 rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-inner shadow-black/20">
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
          className="pointer-events-none absolute left-[18%] top-[-4%] h-52 w-52 rounded-full opacity-[0.1]"
          style={{ backgroundImage: accents.amber.softGlow, filter: "blur(72px)" }}
        />
        <div
          className="pointer-events-none absolute right-[12%] bottom-[18%] h-52 w-52 rounded-full opacity-[0.08]"
          style={{ backgroundImage: accents.rose.softGlow, filter: "blur(80px)" }}
        />
        <Reveal>
          <h2
            ref={(node) => {
              partnerHeadingRef.current = node;
              headingRefs.current[2] = node;
            }}
            className="motion-heading-highlight mb-5 text-3xl font-semibold sm:text-4xl"
            data-accent-color={accentRgb.amber}
          >
            Become a partner with Fitdex
          </h2>
          <div
            className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 transition-[transform,filter,opacity] duration-500 hover:-translate-y-1 [filter:drop-shadow(0_18px_32px_rgba(0,0,0,0.2))] hover:[filter:drop-shadow(0_30px_48px_rgba(0,0,0,0.28))] sm:p-8"
            data-accent-color={accentRgb.rose}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.16]"
              style={{
                backgroundImage: "linear-gradient(120deg, rgba(245,158,11,0.2) 0%, rgba(244,63,94,0.14) 100%)",
                filter: "blur(42px)",
              }}
            />
            <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <ul className="space-y-2 text-sm text-muted-foreground sm:text-base">
                <li>Get quality leads from nearby members actively searching.</li>
                <li>Showcase your plans, offers, and amenities with full control.</li>
                <li>Grow visibility with transparent listings and verified trust.</li>
              </ul>
              <Button asChild size="lg" className="rounded-xl px-7 motion-accent-button border border-white/15 text-white">
                <Link
                  ref={partnerCtaRef}
                  href="/owners"
                  data-accent-color={accentRgb.amber}
                  style={{ backgroundImage: accents.amber.gradient }}
                  onPointerEnter={() => {
                    partnerHovering.current = true;
                  }}
                  onPointerMove={(event) => {
                    const node = partnerCtaRef.current;
                    if (!node) return;
                    const rect = node.getBoundingClientRect();
                    const px = (event.clientX - rect.left) / rect.width - 0.5;
                    const py = (event.clientY - rect.top) / rect.height - 0.5;
                    partnerMagnetTarget.current.x = px * 14;
                    partnerMagnetTarget.current.y = py * 12;
                  }}
                  onPointerLeave={() => {
                    partnerHovering.current = false;
                    partnerMagnetTarget.current.x = 0;
                    partnerMagnetTarget.current.y = 0;
                  }}
                >
                  Know more
                  <Calculator className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>
      <style jsx global>{`
        .fitdex-hero .fitdex-hero-stars,
        .fitdex-hero .fitdex-hero-streaks {
          contain: layout paint;
          transform: translate3d(0, 0, 0);
          will-change: transform;
        }

        .fitdex-hero .fitdex-hero-streak {
          position: absolute;
          left: 50%;
          top: 50%;
          border-radius: 999px;
          transform-origin: 0% 50%;
          filter: blur(1px);
          mix-blend-mode: screen;
          opacity: 0;
          pointer-events: none;
          will-change: transform, opacity, filter;
        }

        .fitdex-hero .fitdex-hero-star {
          position: absolute;
          border-radius: 999px;
          transform: translate3d(-50%, -50%, 0) scale(1);
          background-image: radial-gradient(
            circle at center,
            rgba(255, 255, 255, 0.96) 0%,
            rgba(186, 230, 253, 0.78) 48%,
            rgba(129, 140, 248, 0) 100%
          );
          box-shadow: 0 0 14px rgba(129, 140, 248, 0.32);
          pointer-events: none;
          will-change: opacity, transform;
        }

        .fitdex-hero .fitdex-hero-star-twinkle {
          animation: fitdexHeroStarTwinkle var(--fitdex-star-duration, 8.4s) ease-in-out var(--fitdex-star-delay, 0s) infinite;
        }

        .fitdex-hero .fitdex-hero-aura {
          background-image:
            radial-gradient(circle at 50% 48%, rgba(129, 140, 248, 0.27) 0%, rgba(56, 189, 248, 0.14) 34%, rgba(59, 130, 246, 0.06) 52%, rgba(59, 130, 246, 0) 74%),
            radial-gradient(circle at 48% 58%, rgba(217, 70, 239, 0.12) 0%, rgba(217, 70, 239, 0) 66%);
          background-position: 50% 50%;
          background-size: 132% 132%;
          filter: blur(34px);
          transition: opacity 900ms cubic-bezier(0.22, 1, 0.36, 1), filter 900ms cubic-bezier(0.22, 1, 0.36, 1);
          will-change: transform, opacity, filter, background-position;
        }

        .fitdex-hero .fitdex-hero-aura-active {
          opacity: 0.26;
          animation: fitdexHeroAuraBreath 9.6s ease-in-out infinite;
        }

        @keyframes fitdexHeroStarTwinkle {
          0%,
          100% {
            opacity: var(--fitdex-star-min, 0.1);
          }
          50% {
            opacity: var(--fitdex-star-max, 0.3);
          }
        }

        @keyframes fitdexHeroAuraBreath {
          0%,
          100% {
            opacity: 0.2;
            filter: blur(34px);
            background-position: 48% 52%;
          }
          50% {
            opacity: 0.3;
            filter: blur(30px);
            background-position: 52% 48%;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .fitdex-hero .fitdex-hero-star-twinkle,
          .fitdex-hero .fitdex-hero-aura-active {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
