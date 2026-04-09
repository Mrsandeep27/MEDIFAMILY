import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

/**
 * Admin gate (server-side only)
 * ──────────────────────────────
 * Checks the bearer token, then verifies the user's email is in the
 * ADMIN_EMAILS env var (comma-separated). No DB role table needed.
 *
 * Set in .env.local:
 *   ADMIN_EMAILS=you@example.com,partner@example.com
 */
const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface AdminUser {
  id: string;
  email: string;
}

function getAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS || "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export async function requireAdmin(request: NextRequest): Promise<{ ok: true; user: AdminUser } | { ok: false; status: number; error: string }> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  const { data, error } = await supabaseAuth.auth.getUser(authHeader.slice(7));
  if (error || !data?.user?.email) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  const adminEmails = getAdminEmails();
  if (adminEmails.size === 0) {
    return { ok: false, status: 503, error: "ADMIN_EMAILS not configured on server" };
  }
  if (!adminEmails.has(data.user.email.toLowerCase())) {
    return { ok: false, status: 403, error: "Forbidden — not an admin" };
  }
  return {
    ok: true,
    user: { id: data.user.id, email: data.user.email },
  };
}

/** Browser-safe check using a public list of admin emails. */
export function isAdminEmail(email: string | null | undefined, adminEmailsCsv: string | undefined): boolean {
  if (!email || !adminEmailsCsv) return false;
  return adminEmailsCsv
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}
