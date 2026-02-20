// Centralized rate limiting utility for Fitdex API routes
// Use this to prevent abuse and ensure fair usage

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "10 s"),
});

export const qrStaticIssueIpRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(120, "60 s"),
});

export const qrStaticIssueRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(40, "60 s"),
});

export const qrVerifyIpRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(120, "60 s"),
});

export const qrVerifyRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "60 s"),
});
