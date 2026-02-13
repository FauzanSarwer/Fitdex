"use client";

import { useEffect, useRef, type ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

const REVEAL_EASE = "cubic-bezier(0.22,1,0.36,1)";

export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const node = ref.current;
    if (!node) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      node.style.opacity = "1";
      node.style.transform = "translate3d(0, 0, 0) scale(1)";
      node.style.filter = "none";
      node.style.transition = "none";
      node.style.willChange = "auto";
      return;
    }

    node.style.opacity = "0";
    node.style.transform = "translate3d(0, 80px, 0) scale(0.96)";
    node.style.filter = "blur(10px)";

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) return;

        node.style.willChange = "transform, opacity, filter";
        window.requestAnimationFrame(() => {
          node.style.transition = `opacity 900ms ${REVEAL_EASE} ${delay}ms, transform 900ms ${REVEAL_EASE} ${delay}ms, filter 900ms ${REVEAL_EASE} ${delay}ms`;
          node.style.opacity = "1";
          node.style.transform = "translate3d(0, 0, 0) scale(1)";
          node.style.filter = "blur(0px)";
        });

        window.setTimeout(() => {
          if (node) {
            node.style.willChange = "auto";
          }
        }, 960 + delay);

        observer.disconnect();
      },
      {
        threshold: 0.2,
        rootMargin: "0px 0px -8% 0px",
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
