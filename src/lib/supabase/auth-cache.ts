import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

/**
 * Module-level auth cache shared across ALL API routes.
 *
 * Every endpoint that authenticates a request (sync, check-onboarding,
 * ai-doctor, feedback, etc.) calls `getUserFromRequest` here. The first
 * call for a given access token hits GoTrue; subsequent calls within
 * AUTH_CACHE_TTL_MS return the cached result with zero network I/O.
 *
 * Typical active tab makes many API calls per minute (syncs, check-
 * onboarding, OCR extract, etc.). Without shared caching, each one
 * was a separate GoTrue round-trip — accounting for the bulk of auth
 * request volume. With this cache, a token is verified at most once
 * every 30 seconds regardless of how many endpoints hit it.
 */

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CachedUser {
  userId: string;
  email: string;
  expires: number;
}

const authCache = new Map<string, CachedUser>();
const AUTH_CACHE_TTL_MS = 30_000; // 30 seconds

// Keep memory bounded — evict expired entries once cache grows
function pruneAuthCache(): void {
  if (authCache.size < 500) return;
  const now = Date.now();
  for (const [k, v] of authCache) {
    if (v.expires < now) authCache.delete(k);
  }
}

/** Extract the Bearer token from either the Authorization header or
 *  a Supabase auth cookie. Returns null if no token is present. */
function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  const cookies = request.headers.get("cookie") || "";
  const match = cookies.match(/sb-[^=]+-auth-token[^=]*=([^;]+)/);
  if (match) {
    try {
      const parsed = JSON.parse(decodeURIComponent(match[1]));
      const token = Array.isArray(parsed) ? parsed[0] : parsed?.access_token;
      if (typeof token === "string") return token;
    } catch {
      // malformed cookie — treat as no auth
    }
  }

  return null;
}

/** Get the authenticated user for an API request. Returns null if the
 *  token is missing, expired, or invalid. Uses a 30s module-level cache
 *  to avoid redundant GoTrue calls across endpoints. */
export async function getUserFromRequest(
  request: NextRequest
): Promise<{ userId: string; email: string } | null> {
  const token = extractToken(request);
  if (!token) return null;

  // Fast path — cached
  const cached = authCache.get(token);
  if (cached && cached.expires > Date.now()) {
    return { userId: cached.userId, email: cached.email };
  }

  // Slow path — verify with GoTrue
  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data.user) {
    // Negative result — don't cache so refreshed tokens aren't rejected
    return null;
  }

  const entry: CachedUser = {
    userId: data.user.id,
    email: data.user.email || "",
    expires: Date.now() + AUTH_CACHE_TTL_MS,
  };
  authCache.set(token, entry);
  pruneAuthCache();

  return { userId: entry.userId, email: entry.email };
}
