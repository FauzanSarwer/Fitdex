import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { withAuth, type NextRequestWithAuth } from "next-auth/middleware";

type RateLimitEntry = {
  count: number;
  reset: number;
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 120;

const authMiddleware = withAuth({
  callbacks: {
    authorized: ({ token }) => !!token,
  },
  pages: { signIn: "/auth/login" },
});

function getClientIp(req: NextRequest) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }

  return req.ip ?? "unknown";
}

function applyRateLimit(req: NextRequest) {
  const key = `${getClientIp(req)}:${req.nextUrl.pathname}`;
  const now = Date.now();
  const store = (globalThis as typeof globalThis & {
    __gymduoRateLimit__?: Map<string, RateLimitEntry>;
  });

  if (!store.__gymduoRateLimit__) {
    store.__gymduoRateLimit__ = new Map();
  }

  const bucket = store.__gymduoRateLimit__.get(key);
  if (!bucket || now > bucket.reset) {
    store.__gymduoRateLimit__.set(key, {
      count: 1,
      reset: now + RATE_LIMIT_WINDOW_MS,
    });
    return null;
  }

  if (bucket.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((bucket.reset - now) / 1000);
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": retryAfter.toString(),
        },
      }
    );
  }

  bucket.count += 1;
  store.__gymduoRateLimit__.set(key, bucket);
  return null;
}

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  if (req.nextUrl.pathname.startsWith("/api")) {
    const rateLimitResponse = applyRateLimit(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    return NextResponse.next();
  }

  return authMiddleware(req as NextRequestWithAuth, event);
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"]
};
