import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

type RateLimitEntry = {
  count: number;
  reset: number;
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 120;

const securityHeaders: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(self), camera=(), microphone=()",
};

const OWNER_ROLES = new Set(["OWNER", "ADMIN"]);

function getClientIp(req: NextRequest) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }

  return req.ip ?? "unknown";
}

function applyRateLimit(req: NextRequest) {
  try {
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
  } catch {
    return null;
  }
}

function applySecurityHeaders(response: NextResponse) {
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  return response;
}

export default async function middleware(req: NextRequest) {
  try {
    if (req.nextUrl.pathname.startsWith("/api")) {
      const rateLimitResponse = applyRateLimit(req);
      if (rateLimitResponse) {
        return applySecurityHeaders(rateLimitResponse);
      }
      return applySecurityHeaders(NextResponse.next());
    }

    const pathname = req.nextUrl.pathname;
    if (pathname.startsWith("/dashboard")) {
      const token = await getToken({ req });
      if (!token) {
        const callbackUrl = `${pathname}${req.nextUrl.search}`;
        const loginUrl = new URL("/auth/login", req.url);
        loginUrl.searchParams.set("callbackUrl", callbackUrl || "/dashboard");
        return applySecurityHeaders(NextResponse.redirect(loginUrl));
      }

      const role = (token as { role?: string }).role;
      const isOwner = !!role && OWNER_ROLES.has(role);

      if (pathname === "/dashboard" || pathname === "/dashboard/") {
        const target = isOwner ? "/dashboard/owner" : "/dashboard/user";
        return applySecurityHeaders(NextResponse.redirect(new URL(target, req.url)));
      }

      if (pathname.startsWith("/dashboard/admin") && role !== "ADMIN") {
        const target = isOwner ? "/dashboard/owner" : "/dashboard/user";
        return applySecurityHeaders(NextResponse.redirect(new URL(target, req.url)));
      }

      if (pathname.startsWith("/dashboard/owner") && !isOwner) {
        return applySecurityHeaders(NextResponse.redirect(new URL("/dashboard/user", req.url)));
      }

      if (pathname.startsWith("/dashboard/user") && isOwner) {
        return applySecurityHeaders(NextResponse.redirect(new URL("/dashboard/owner", req.url)));
      }

      return applySecurityHeaders(NextResponse.next());
    }

    return applySecurityHeaders(NextResponse.next());
  } catch {
    return applySecurityHeaders(NextResponse.next());
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"]
};
