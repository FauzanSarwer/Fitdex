"use client";

import { useEffect, useRef } from "react";
import { accents } from "@/lib/theme/accents";

export function BackgroundBeams() {
  const beamRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    let rafId = 0;

    const update = (time: number) => {
      const t = time * 0.00008;
      beamRefs.current.forEach((beam, index) => {
        if (!beam) return;
        const shift = ((t * (index + 1)) % 1) * 280;
        beam.style.backgroundPosition = `${shift.toFixed(2)}% 50%`;
      });
      rafId = window.requestAnimationFrame(update);
    };

    rafId = window.requestAnimationFrame(update);
    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div
        ref={(node) => {
          beamRefs.current[0] = node;
        }}
        className="absolute -top-24 left-[14%] h-[380px] w-[460px] opacity-[0.08]"
        style={{
          backgroundImage: accents.cyan.gradient,
          backgroundSize: "220% 220%",
          filter: "blur(90px)",
          transform: "translate3d(0, 0, 0) rotate(-14deg)",
        }}
      />
      <div
        ref={(node) => {
          beamRefs.current[1] = node;
        }}
        className="absolute top-[26%] -right-24 h-[420px] w-[520px] opacity-[0.07]"
        style={{
          backgroundImage: accents.violet.gradient,
          backgroundSize: "230% 230%",
          filter: "blur(96px)",
          transform: "translate3d(0, 0, 0) rotate(16deg)",
        }}
      />
      <div
        ref={(node) => {
          beamRefs.current[2] = node;
        }}
        className="absolute bottom-[-160px] left-[30%] h-[360px] w-[560px] opacity-[0.06]"
        style={{
          backgroundImage: accents.rose.gradient,
          backgroundSize: "250% 250%",
          filter: "blur(104px)",
          transform: "translate3d(0, 0, 0) rotate(-8deg)",
        }}
      />
    </div>
  );
}
