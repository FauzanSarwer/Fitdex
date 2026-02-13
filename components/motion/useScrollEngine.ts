"use client";

import { useEffect, useRef } from "react";

type ScrollListener = () => void;

type ScrollEngineStore = {
  scrollProgress: { current: number };
  scrollVelocity: { current: number };
  subscribe: (listener: ScrollListener) => () => void;
};

let store: ScrollEngineStore | null = null;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const createScrollEngineStore = (): ScrollEngineStore => {
  const scrollProgress = { current: 0 };
  const scrollVelocity = { current: 0 };
  const listeners = new Set<ScrollListener>();

  let frameId = 0;
  let ticking = false;
  let lastScrollY = 0;
  let lastTimestamp = 0;

  const runListeners = () => {
    listeners.forEach((listener) => listener());
  };

  const update = (timestamp: number) => {
    ticking = false;
    frameId = 0;

    const root = document.scrollingElement ?? document.documentElement;
    const scrollY = window.scrollY;
    const maxScroll = Math.max(root.scrollHeight - window.innerHeight, 1);
    const dt = Math.max(timestamp - lastTimestamp, 16);

    scrollProgress.current = clamp01(scrollY / maxScroll);
    scrollVelocity.current = (scrollY - lastScrollY) / (dt / 1000);

    lastScrollY = scrollY;
    lastTimestamp = timestamp;
    runListeners();
  };

  const requestTick = () => {
    if (ticking) return;
    ticking = true;
    frameId = window.requestAnimationFrame(update);
  };

  const onScroll = () => requestTick();

  lastScrollY = window.scrollY;
  lastTimestamp = performance.now();
  requestTick();

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });

  return {
    scrollProgress,
    scrollVelocity,
    subscribe(listener: ScrollListener) {
      listeners.add(listener);
      listener();

      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && frameId) {
          window.cancelAnimationFrame(frameId);
          frameId = 0;
          ticking = false;
        }
      };
    },
  };
};

const getScrollEngineStore = (): ScrollEngineStore | null => {
  if (typeof window === "undefined") return null;
  if (!store) {
    store = createScrollEngineStore();
  }
  return store;
};

export function useScrollEngine() {
  const scrollProgress = useRef(0);
  const scrollVelocity = useRef(0);

  useEffect(() => {
    const engine = getScrollEngineStore();
    if (!engine) return;

    const unsubscribe = engine.subscribe(() => {
      scrollProgress.current = engine.scrollProgress.current;
      scrollVelocity.current = engine.scrollVelocity.current;
    });

    return unsubscribe;
  }, []);

  return { scrollProgress, scrollVelocity };
}
