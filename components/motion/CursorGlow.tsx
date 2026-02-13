"use client";

import { useEffect, useRef } from "react";

const lerp = (from: number, to: number, alpha: number) => from + (to - from) * alpha;

export function CursorGlow() {
  const glowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    if (reduceMotion || coarsePointer || window.innerWidth < 900) return;

    const glow = glowRef.current;
    if (!glow) return;

    let rafId = 0;
    let visible = false;
    let frame = 0;

    const current = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const target = { ...current };
    let color = "99, 102, 241";

    const pickNearestAccent = (x: number, y: number) => {
      const candidates = Array.from(document.querySelectorAll<HTMLElement>("[data-accent-color]"));
      if (candidates.length === 0) return;

      let nearest: HTMLElement | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (const node of candidates) {
        const rect = node.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        if (rect.bottom < 0 || rect.top > window.innerHeight) continue;

        const cx = rect.left + rect.width * 0.5;
        const cy = rect.top + rect.height * 0.5;
        const dx = cx - x;
        const dy = cy - y;
        const distance = dx * dx + dy * dy;

        if (distance < bestDistance) {
          bestDistance = distance;
          nearest = node;
        }
      }

      if (nearest) {
        const accent = nearest.getAttribute("data-accent-color");
        if (accent) {
          color = accent;
        }
      }
    };

    const update = () => {
      current.x = lerp(current.x, target.x, 0.14);
      current.y = lerp(current.y, target.y, 0.14);

      glow.style.transform = `translate3d(${(current.x - 160).toFixed(2)}px, ${(current.y - 160).toFixed(2)}px, 0)`;
      glow.style.opacity = visible ? "1" : "0";
      glow.style.background = `radial-gradient(circle at center, rgba(${color}, 0.28) 0%, rgba(${color}, 0.1) 38%, rgba(${color}, 0) 72%)`;

      frame += 1;
      if (frame % 6 === 0) {
        pickNearestAccent(current.x, current.y);
      }

      rafId = window.requestAnimationFrame(update);
    };

    const onMouseMove = (event: MouseEvent) => {
      target.x = event.clientX;
      target.y = event.clientY;
      visible = true;
      glow.style.willChange = "transform, opacity, background-position";
    };

    const onMouseLeave = () => {
      visible = false;
      window.setTimeout(() => {
        if (!visible && glow) {
          glow.style.willChange = "auto";
        }
      }, 220);
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mouseleave", onMouseLeave, { passive: true });
    rafId = window.requestAnimationFrame(update);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  return (
    <div
      ref={glowRef}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-40 h-80 w-80 opacity-0"
      style={{ filter: "blur(28px)", transform: "translate3d(-9999px, -9999px, 0)" }}
    />
  );
}
