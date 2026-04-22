-- Admin user overrides table — per-user AI quota, member cap, and plan label
-- Run in Supabase SQL Editor once. Safe to run multiple times (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS public.user_overrides (
  user_id         TEXT PRIMARY KEY,
  email           TEXT,
  ai_quota_limit  INTEGER,          -- NULL=default, -1=unlimited, else custom number
  member_cap      INTEGER,          -- NULL=default(6), -1=unlimited, else custom number
  plan            TEXT,             -- free | plus | family | care_home | pilot
  note            TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by      TEXT
);

CREATE INDEX IF NOT EXISTS user_overrides_email_idx ON public.user_overrides(email);

-- Prevent random reads — only service role can access (admin API uses it)
ALTER TABLE public.user_overrides ENABLE ROW LEVEL SECURITY;
-- No policies added intentionally: service role bypasses RLS, regular users cannot read.
