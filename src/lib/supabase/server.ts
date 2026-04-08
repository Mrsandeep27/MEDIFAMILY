import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client with service_role key.
// Bypasses RLS — use ONLY in API routes, NEVER expose to client.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL is not set. Add it to .env.local and Vercel env."
  );
}

if (!serviceKey) {
  // Don't throw at module-load — Next.js will fail the entire build/runtime.
  // Instead, log a loud warning so any API call using supabaseAdmin will
  // fail with a clear error message.
  console.error(
    "[supabaseAdmin] SUPABASE_SERVICE_ROLE_KEY is missing — all admin DB calls will fail with 500. " +
      "Add it to .env.local (local) and Vercel Environment Variables (production)."
  );
}

export const supabaseAdmin = createClient(
  url,
  serviceKey || "missing-service-role-key"
);

export const isSupabaseAdminConfigured = !!serviceKey;
