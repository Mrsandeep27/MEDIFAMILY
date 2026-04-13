import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp, RATE_LIMITS } from "@/lib/security/rate-limit";

/** Map API path prefixes to rate limit configs */
function getRateLimitConfig(pathname: string) {
  if (pathname.startsWith("/api/auth/signup")) return RATE_LIMITS.signup;
  if (pathname.startsWith("/api/auth/")) return RATE_LIMITS.auth;
  if (pathname.startsWith("/api/abha")) return RATE_LIMITS.otp;
  if (pathname.startsWith("/api/ai-doctor")) return RATE_LIMITS.ai;
  if (pathname.startsWith("/api/extract")) return RATE_LIMITS.ai;
  if (pathname.startsWith("/api/lab-insights")) return RATE_LIMITS.ai;
  if (pathname.startsWith("/api/medicine-info")) return RATE_LIMITS.ai;
  if (pathname.startsWith("/api/visit-prep")) return RATE_LIMITS.ai;
  if (pathname.startsWith("/api/sync")) return RATE_LIMITS.sync;
  if (pathname.startsWith("/api/admin")) return RATE_LIMITS.admin;
  if (pathname.startsWith("/api/feedback")) return RATE_LIMITS.public;
  if (pathname.startsWith("/api/")) return RATE_LIMITS.general;
  return null;
}

// Security headers applied to all responses
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https:",
    "font-src 'self' data:",
    "connect-src 'self' blob: https://*.supabase.co https://generativelanguage.googleapis.com",
    "worker-src 'self' blob:",
    "media-src 'self' blob: data:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
};

function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Apply security headers to all responses (non-API routes too)
  if (!pathname.startsWith("/api/")) {
    return applySecurityHeaders(NextResponse.next());
  }

  const config = getRateLimitConfig(pathname);
  if (!config) return NextResponse.next();

  const ip = getClientIp(request);
  const key = `${ip}:${pathname}`;
  const result = rateLimit(key, config);

  if (!result.success) {
    const retryAfter = Math.ceil(result.retryAfterMs / 1000);
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(config.limit),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  const response = applySecurityHeaders(NextResponse.next());
  response.headers.set("X-RateLimit-Limit", String(config.limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  return response;
}

export const config = {
  matcher: [
    // Apply security headers + rate limiting to API routes
    "/api/:path*",
    // Apply security headers to all pages (exclude static files, _next, favicon)
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|icons/).*)",
  ],
};
