"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type PageTransitionProps = {
  children: React.ReactNode;
};

const EXIT_MS = 220;

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastPathRef = useRef(pathname);
  const [renderedChildren, setRenderedChildren] = useState(children);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    if (lastPathRef.current === pathname) {
      return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setRenderedChildren(children);
      lastPathRef.current = pathname;
      node.style.transition = "none";
      node.style.opacity = "1";
      node.style.transform = "translate3d(0, 0, 0)";
      return;
    }

    let cancelled = false;
    node.style.willChange = "opacity, transform";
    node.style.transition = `opacity ${EXIT_MS}ms ease, transform ${EXIT_MS}ms ease`;
    node.style.opacity = "0";
    node.style.transform = "translate3d(0, -10px, 0)";

    const swapTimer = window.setTimeout(() => {
      if (cancelled) return;

      setRenderedChildren(children);
      window.requestAnimationFrame(() => {
        if (cancelled || !containerRef.current) return;
        containerRef.current.style.transition = "none";
        containerRef.current.style.opacity = "0";
        containerRef.current.style.transform = "translate3d(0, 40px, 0)";

        window.requestAnimationFrame(() => {
          if (cancelled || !containerRef.current) return;
          containerRef.current.style.transition = "opacity 500ms cubic-bezier(0.22,1,0.36,1), transform 500ms cubic-bezier(0.22,1,0.36,1)";
          containerRef.current.style.opacity = "1";
          containerRef.current.style.transform = "translate3d(0, 0, 0)";
          window.setTimeout(() => {
            if (containerRef.current) {
              containerRef.current.style.willChange = "auto";
            }
          }, 560);
        });
      });
    }, EXIT_MS);

    lastPathRef.current = pathname;

    return () => {
      cancelled = true;
      window.clearTimeout(swapTimer);
    };
  }, [children, pathname]);

  return <div ref={containerRef}>{renderedChildren}</div>;
}
