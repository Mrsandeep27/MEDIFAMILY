-- Care Home module: extend members + add incidents + care_home_shares.
-- Run in Supabase SQL editor or via Management API.
--
-- Idempotent — uses IF NOT EXISTS / DROP IF EXISTS so re-running is safe.

-- 1. Extend members with care-home fields
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS is_resident      boolean,
  ADD COLUMN IF NOT EXISTS room_no          text,
  ADD COLUMN IF NOT EXISTS admission_date   date,
  ADD COLUMN IF NOT EXISTS discharged_at    timestamptz,
  ADD COLUMN IF NOT EXISTS discharge_reason text;

-- Helpful indexes for /residents and /round queries
CREATE INDEX IF NOT EXISTS members_user_resident_idx
  ON public.members (user_id) WHERE is_resident IS TRUE;

CREATE INDEX IF NOT EXISTS members_user_active_resident_idx
  ON public.members (user_id) WHERE is_resident IS TRUE AND discharged_at IS NULL;

-- 2. Incidents table — caretaker-logged events for residents
CREATE TABLE IF NOT EXISTS public.incidents (
  id              uuid        PRIMARY KEY,
  member_id       uuid        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  type            text        NOT NULL,  -- 'fall' | 'illness' | 'hospital' | 'other'
  occurred_at     timestamptz NOT NULL,
  notes           text        NOT NULL DEFAULT '',
  action_taken    text        NOT NULL DEFAULT '',
  caretaker_id    uuid        NOT NULL,
  is_deleted      boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS incidents_member_id_idx
  ON public.incidents (member_id) WHERE is_deleted IS FALSE;

CREATE INDEX IF NOT EXISTS incidents_occurred_at_idx
  ON public.incidents (member_id, occurred_at DESC) WHERE is_deleted IS FALSE;

-- 3. Care Home shares — phone-OTP-gated read-only links for family
CREATE TABLE IF NOT EXISTS public.care_home_shares (
  id                 uuid        PRIMARY KEY,
  member_id          uuid        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  token              text        NOT NULL UNIQUE,
  authorized_phone   text        NOT NULL,
  expires_at         timestamptz,
  revoked_at         timestamptz,
  last_accessed_at   timestamptz,
  created_by         uuid        NOT NULL,
  is_deleted         boolean     NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS care_home_shares_token_idx
  ON public.care_home_shares (token);

CREATE INDEX IF NOT EXISTS care_home_shares_member_id_idx
  ON public.care_home_shares (member_id) WHERE is_deleted IS FALSE;

-- 4. Trigger: bump updated_at on row changes (parity with other tables)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS incidents_set_updated_at ON public.incidents;
CREATE TRIGGER incidents_set_updated_at
  BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS care_home_shares_set_updated_at ON public.care_home_shares;
CREATE TRIGGER care_home_shares_set_updated_at
  BEFORE UPDATE ON public.care_home_shares
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
