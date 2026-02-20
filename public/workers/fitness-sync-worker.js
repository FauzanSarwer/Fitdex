let intervalMs = 10000;
let timer = null;

function clearTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

function scheduleNext(delayMs) {
  clearTimer();
  timer = setTimeout(() => {
    self.postMessage({ type: "tick" });
    scheduleNext(intervalMs);
  }, Math.max(250, delayMs));
}

self.onmessage = (event) => {
  const message = event.data || {};
  if (message.type === "start") {
    if (typeof message.intervalMs === "number" && Number.isFinite(message.intervalMs)) {
      intervalMs = Math.max(1000, Math.floor(message.intervalMs));
    }
    scheduleNext(intervalMs);
    return;
  }

  if (message.type === "reschedule") {
    const nextDelay = typeof message.delayMs === "number" ? message.delayMs : intervalMs;
    scheduleNext(nextDelay);
    return;
  }

  if (message.type === "stop") {
    clearTimer();
  }
};
