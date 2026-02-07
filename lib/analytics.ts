type AnalyticsPayload = {
  event: string;
  path?: string;
  meta?: Record<string, unknown>;
};

export function trackEvent(payload: AnalyticsPayload) {
  if (typeof window === "undefined") {
    return;
  }

  const body = JSON.stringify({
    ...payload,
    timestamp: new Date().toISOString(),
  });

  const url = "/api/analytics";

  if (navigator.sendBeacon) {
    const ok = navigator.sendBeacon(url, body);
    if (ok) return;
  }

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}
