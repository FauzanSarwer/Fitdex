"use client";

import { type ReactNode } from "react";
import { Reveal } from "@/components/motion/Reveal";

type ScrollRevealProps = {
  children: ReactNode;
  className?: string;
  delayMs?: number;
};

export function ScrollReveal({ children, className, delayMs = 0 }: ScrollRevealProps) {
  return (
    <Reveal className={className} delay={delayMs}>
      {children}
    </Reveal>
  );
}
