type IdleDeadlineLike = {
  didTimeout: boolean;
  timeRemaining: () => number;
};

type IdleRequestCallbackLike = (deadline: IdleDeadlineLike) => void;

type IdleWindow = Window & {
  requestIdleCallback?: (callback: IdleRequestCallbackLike) => number;
  cancelIdleCallback?: (id: number) => void;
};

export function runWhenIdle(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  const idleWindow = window as IdleWindow;

  if (typeof idleWindow.requestIdleCallback === "function") {
    const id = idleWindow.requestIdleCallback(() => callback());
    return () => {
      if (typeof idleWindow.cancelIdleCallback === "function") {
        idleWindow.cancelIdleCallback(id);
      }
    };
  }

  const timeoutId = window.setTimeout(callback, 0);
  return () => {
    window.clearTimeout(timeoutId);
  };
}
