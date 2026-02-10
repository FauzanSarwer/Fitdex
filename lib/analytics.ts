type AnalyticsPayload = {
  event: string;
  path?: string;
  meta?: Record<string, unknown>;
};

const ANALYTICS_ENDPOINT = "/api/analytics";

function validateAnalyticsPayload(payload: AnalyticsPayload): boolean {
  return typeof payload.event === "string" && payload.event.trim().length > 0;
}

export function trackEvent(payload: AnalyticsPayload) {
  if (typeof window === "undefined") {
    console.warn("Analytics tracking is disabled on the server.");
    return;
  }

  if (!validateAnalyticsPayload(payload)) {
    console.error("Invalid analytics payload", payload);
    return;
  }

  const body = JSON.stringify({
    ...payload,
    timestamp: new Date().toISOString(),
  });

  if (navigator.sendBeacon) {
    const ok = navigator.sendBeacon(ANALYTICS_ENDPOINT, body);
    if (ok) return;
  }

  fetch(ANALYTICS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch((error) => {
    console.error("Failed to send analytics event", error);
  });
}
