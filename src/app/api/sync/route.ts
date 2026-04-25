import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/server";
import { getUserFromRequest } from "@/lib/supabase/auth-cache";

const ALLOWED_TABLES = [
  "members", "health_records", "medicines", "reminders",
  "reminder_logs", "share_links", "health_metrics",
];

// Postgres error codes that will never succeed on retry. Anything in this set
// is sent back in `permanentFailedIds` so the client can park the row as
// `conflict` instead of looping every sync cycle.
const PERMANENT_PG_CODES = new Set([
  "23503", // foreign_key_violation
  "23502", // not_null_violation
  "23514", // check_violation
  "22P02", // invalid_text_representation (bad UUID, etc.)
  "42703", // undefined_column
  "42501", // insufficient_privilege
]);

// Resolve the set of user_ids that THIS user can read/write through their
// family groups — themselves + every co-member of every family they belong
// to. Used by sync to share members + records across family devices.
//
// Family groups are opt-in: a user with no family memberships gets back just
// their own id, so non-family users see zero behaviour change.
async function getFamilyUserIds(userId: string): Promise<Set<string>> {
  const ids = new Set<string>([userId]);
  // 1. Find families this user belongs to.
  const { data: myMemberships } = await supabaseAdmin
    .from("family_members")
    .select("family_id")
    .eq("user_id", userId);
  const familyIds = (myMemberships || [])
    .map((r: { family_id: string }) => r.family_id)
    .filter(Boolean);
  if (familyIds.length === 0) return ids;
  // 2. Find every member (incl. self) of those families.
  const { data: peers } = await supabaseAdmin
    .from("family_members")
    .select("user_id")
    .in("family_id", familyIds);
  for (const p of peers || []) {
    if (p.user_id) ids.add(p.user_id);
  }
  return ids;
}

const ALLOWED_FIELDS: Record<string, Set<string>> = {
  members: new Set(["id", "name", "relation", "date_of_birth", "blood_group", "gender", "allergies", "chronic_conditions", "emergency_contact_name", "emergency_contact_phone", "avatar_url", "is_deleted", "created_at", "updated_at"]),
  health_records: new Set(["id", "member_id", "type", "title", "doctor_name", "hospital_name", "visit_date", "diagnosis", "notes", "image_urls", "raw_ocr_text", "ai_extracted", "tags", "is_deleted", "created_at", "updated_at"]),
  medicines: new Set(["id", "record_id", "member_id", "name", "dosage", "frequency", "duration", "before_food", "start_date", "end_date", "is_active", "is_deleted", "created_at", "updated_at"]),
  reminders: new Set(["id", "medicine_id", "member_id", "medicine_name", "member_name", "dosage", "before_food", "time", "days", "is_active", "is_deleted", "created_at", "updated_at"]),
  reminder_logs: new Set(["id", "reminder_id", "scheduled_at", "status", "acted_at", "is_deleted", "created_at", "updated_at"]),
  share_links: new Set(["id", "member_id", "created_by", "token", "record_ids", "expires_at", "is_active", "is_deleted", "created_at", "updated_at"]),
  health_metrics: new Set(["id", "member_id", "type", "value", "recorded_at", "notes", "is_deleted", "created_at", "updated_at"]),
};

function sanitizeItem(table: string, item: Record<string, unknown>): Record<string, unknown> {
  const allowed = ALLOWED_FIELDS[table];
  if (!allowed) return {};
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(item)) {
    if (allowed.has(key)) clean[key] = value;
  }
  return clean;
}

// Auth verification uses a shared 30s cache in @/lib/supabase/auth-cache,
// so repeated push+pull calls (and calls to other endpoints with the same
// token) coalesce into one GoTrue round-trip per 30s window.
const getUser = getUserFromRequest;

// Ensure a row exists in public.users for this auth user.
// members.user_id has a FK to public.users — without this, member upserts fail.
//
// Failure modes this guards against:
//   1. Row already exists for this id (re-sync) → fast-path return.
//   2. Race: two concurrent inserts → 23505 on id PK → row now exists, OK.
//   3. Email collision: a stale row (different id, same email) holds the
//      email. Insert with that email would 23505 on the email unique index,
//      and silently returning would leave NO row for this id → FK fail.
//      We fall back to inserting with a synthetic, guaranteed-unique email
//      (`<userId>@medifamily.local`) so the id row is created. The next
//      time the user logs in via Supabase Auth their real email is still
//      the source of truth — public.users.email is just a denormalised
//      cache for legacy non-Supabase auth and isn't used by the FK.
async function ensureUserRow(userId: string, email: string): Promise<void> {
  // Fast path — row already exists by id
  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (existing) return;

  const now = new Date().toISOString();
  const realEmail = email || `${userId}@medifamily.local`;
  const syntheticEmail = `${userId}@medifamily.local`;
  const name = email ? email.split("@")[0] : "User";

  // Try with real email first
  const { error } = await supabaseAdmin.from("users").insert({
    id: userId,
    email: realEmail,
    password_hash: "supabase-auth",
    name,
    created_at: now,
    updated_at: now,
  });
  if (!error) return;

  // 23505 + same id → race winner already created the row, we're done.
  if (error.code === "23505") {
    const { data: nowExists } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (nowExists) return;

    // Email collided with a different id's row. Retry with the synthetic
    // email so the id row gets created. (Skip if we already used it.)
    if (realEmail !== syntheticEmail) {
      const { error: retryErr } = await supabaseAdmin.from("users").insert({
        id: userId,
        email: syntheticEmail,
        password_hash: "supabase-auth",
        name,
        created_at: now,
        updated_at: now,
      });
      if (!retryErr) return;
      if (retryErr.code === "23505") {
        const { data: afterRetry } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("id", userId)
          .maybeSingle();
        if (afterRetry) return;
      }
      console.error("[ensureUserRow] retry failed:", retryErr.message, retryErr.details, retryErr.hint);
      throw new Error(`ensureUserRow retry: ${retryErr.message}`);
    }
  }

  console.error("[ensureUserRow] failed:", error.message, error.details, error.hint);
  throw new Error(`ensureUserRow: ${error.message}`);
}

// POST: Push — client sends { tables: { members: [...], health_records: [...] } }
export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseAdminConfigured) {
      return NextResponse.json(
        {
          error:
            "Server not configured: SUPABASE_SERVICE_ROLE_KEY is missing. Add it to .env.local (dev) or Vercel env (prod).",
        },
        { status: 503 }
      );
    }

    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure public.users row exists — members FK requires it
    await ensureUserRow(user.userId, user.email);

    const body = await request.json();
    const tablesPayload: Record<string, Record<string, unknown>[]> = body.tables || {};

    // Fallback: old format { table, items }
    if (body.table && body.items) {
      tablesPayload[body.table] = body.items;
    }

    // failedIds: per-item failures of any kind (transient + permanent)
    // permanentFailedIds: subset of failedIds that will NEVER succeed without
    //   user/admin action — auth/ownership errors, FK violations, malformed
    //   rows. Client parks these as `conflict` instead of looping forever.
    const results = {
      pushed: 0,
      errors: [] as string[],
      failedIds: [] as string[],
      permanentFailedIds: [] as string[],
    };

    // Get the set of user_ids this user can write on behalf of — themselves
    // + every family-mate. Empty family groups (the common case) reduce to
    // just [user.userId] so non-family users see no behaviour change.
    const familyUserIds = await getFamilyUserIds(user.userId);

    // Get all member IDs visible to this user via family-mate sharing.
    // Used for ownership validation on records, medicines, reminders, etc.
    const { data: userMembers } = await supabaseAdmin
      .from("members")
      .select("id")
      .in("user_id", [...familyUserIds]);
    const memberIds = new Set((userMembers || []).map((m: { id: string }) => m.id));

    // Pre-fetch user's reminder IDs for reminder_logs ownership validation
    let userReminderIds = new Set<string>();
    if (memberIds.size > 0 && tablesPayload["reminder_logs"]?.length) {
      const { data: userReminders } = await supabaseAdmin
        .from("reminders")
        .select("id")
        .in("member_id", [...memberIds]);
      userReminderIds = new Set((userReminders || []).map((r: { id: string }) => r.id));
    }

    // Process tables in fixed order (members first) — never trust client payload order
    for (const table of ALLOWED_TABLES) {
      const items = tablesPayload[table];
      if (!Array.isArray(items) || items.length === 0) continue;

      const sliced = items.slice(0, 100);

      // Pre-fetch existing records to prevent cross-user overwrites
      const itemIds = sliced
        .map((i) => i.id)
        .filter((id): id is string => typeof id === "string");

      const existingOwner = new Map<string, string>();
      if (itemIds.length > 0) {
        if (table === "members") {
          const { data: rows } = await supabaseAdmin.from("members").select("id, user_id").in("id", itemIds);
          for (const r of rows || []) existingOwner.set(r.id, r.user_id);
        } else if (table === "reminder_logs") {
          const { data: rows } = await supabaseAdmin.from("reminder_logs").select("id, reminder_id").in("id", itemIds);
          for (const r of rows || []) if (r.reminder_id) existingOwner.set(r.id, r.reminder_id);
        } else {
          const { data: rows } = await supabaseAdmin.from(table).select("id, member_id").in("id", itemIds);
          for (const r of rows || []) if (r.member_id) existingOwner.set(r.id, r.member_id);
        }
      }

      // Phase 1: Validate ownership — no inBatch bypass, DB-verified only
      const validItems: { data: Record<string, unknown>; id: string }[] = [];

      for (const item of sliced) {
        if (!item.id || typeof item.id !== "string") {
          results.errors.push("Item missing valid id");
          continue;
        }

        const data = sanitizeItem(table, item);
        data.id = item.id;

        if (table === "members") {
          // Block takeover: existing member must belong to this user OR a
          // family-mate (so co-managing spouses can edit each other's
          // members). Hard-fail otherwise — a family-stranger can't take
          // over a member just by knowing its id.
          const existingUserId = existingOwner.get(item.id);
          if (existingUserId && !familyUserIds.has(existingUserId)) {
            results.errors.push(`${item.id}: forbidden`);
            results.failedIds.push(item.id);
            results.permanentFailedIds.push(item.id);
            continue;
          }
          // Preserve original creator on edits so leaving the family
          // doesn't orphan the row. New members are created under the
          // current user.
          data.user_id = existingUserId || user.userId;
        } else if (table === "reminder_logs") {
          const rid = data.reminder_id as string;
          if (!rid || !userReminderIds.has(rid)) {
            results.errors.push(`${item.id}: unauthorized`);
            results.failedIds.push(item.id);
            results.permanentFailedIds.push(item.id);
            continue;
          }
          // Existing log must also reference user's reminder
          const existingRid = existingOwner.get(item.id);
          if (existingRid && !userReminderIds.has(existingRid)) {
            results.errors.push(`${item.id}: forbidden`);
            results.failedIds.push(item.id);
            results.permanentFailedIds.push(item.id);
            continue;
          }
        } else if ("member_id" in data && data.member_id) {
          if (!memberIds.has(data.member_id as string)) {
            results.errors.push(`${item.id}: unauthorized`);
            results.failedIds.push(item.id);
            results.permanentFailedIds.push(item.id);
            continue;
          }
          // Existing record must also belong to user's member
          const existingMid = existingOwner.get(item.id);
          if (existingMid && !memberIds.has(existingMid)) {
            results.errors.push(`${item.id}: forbidden`);
            results.failedIds.push(item.id);
            results.permanentFailedIds.push(item.id);
            continue;
          }
        }

        validItems.push({ data, id: item.id });
      }

      if (validItems.length === 0) continue;

      // Phase 2: Batch upsert — 1 DB call instead of N
      try {
        const batchData = validItems.map(v => v.data);
        const { error: batchError } = await supabaseAdmin
          .from(table)
          .upsert(batchData, { onConflict: "id" });

        if (!batchError) {
          results.pushed += validItems.length;
          if (table === "members") {
            for (const v of validItems) memberIds.add(v.data.id as string);
          }
        } else {
          // Batch failed (one bad row fails all) — fallback to per-item
          console.error(`Sync batch ${table} failed:`, batchError.message, batchError.details, batchError.hint);
          for (const { data, id } of validItems) {
            try {
              const { error } = await supabaseAdmin.from(table).upsert(data, { onConflict: "id" });
              if (error) {
                console.error(`Sync upsert ${table}/${id}:`, error.message, error.details, error.hint);
                results.errors.push(`${id}: ${error.message}`);
                results.failedIds.push(id);
                // PG error classes that will never recover via retry:
                //   23503 foreign_key_violation, 23502 not_null_violation,
                //   23514 check_violation, 22P02 invalid_text_representation,
                //   42703 undefined_column, 42501 insufficient_privilege.
                // Park them as conflict on the client so they stop looping.
                if (PERMANENT_PG_CODES.has(error.code)) {
                  results.permanentFailedIds.push(id);
                }
              } else {
                results.pushed++;
                if (table === "members") memberIds.add(data.id as string);
              }
            } catch (err) {
              console.error(`Sync upsert ${id}:`, err);
              results.errors.push(`${id}: sync failed`);
              results.failedIds.push(id);
            }
          }
        }
      } catch (err) {
        // Entire batch call failed (network, etc.) — mark all as failed
        for (const { id } of validItems) results.failedIds.push(id);
        console.error(`Sync batch ${table}:`, err);
        results.errors.push(`${table}: sync failed`);
      }

      // After reminders are upserted, rebuild userReminderIds for reminder_logs phase
      if (table === "reminders" && memberIds.size > 0) {
        const { data: allReminders } = await supabaseAdmin
          .from("reminders")
          .select("id")
          .in("member_id", [...memberIds]);
        userReminderIds = new Set((allReminders || []).map((r: { id: string }) => r.id));
      }
    }

    return NextResponse.json(results);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Sync push error:", message, err);
    return NextResponse.json(
      { error: "Sync push failed", detail: message },
      { status: 500 }
    );
  }
}

// GET: Pull — client sends ?tables={"members":"2000-01-01T00:00:00Z",...}
export async function GET(request: NextRequest) {
  try {
    if (!isSupabaseAdminConfigured) {
      return NextResponse.json(
        {
          error:
            "Server not configured: SUPABASE_SERVICE_ROLE_KEY is missing. Add it to .env.local (dev) or Vercel env (prod).",
        },
        { status: 503 }
      );
    }

    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tablesRaw = searchParams.get("tables");

    // Parse table→timestamp map
    let sinceMap: Record<string, string> = {};
    if (tablesRaw) {
      try { sinceMap = JSON.parse(tablesRaw); } catch { /* ignore */ }
    }

    // Fallback: old format ?table=members&since=...
    const singleTable = searchParams.get("table");
    if (singleTable && !tablesRaw) {
      sinceMap[singleTable] = searchParams.get("since") || "2000-01-01T00:00:00Z";
    }

    // Pull data for every user_id this user can see — themselves +
    // family-mates. For solo users this collapses to just [user.userId].
    const familyUserIds = [...(await getFamilyUserIds(user.userId))];

    // Member IDs spanning the user + every family-mate, used for child
    // tables (records, medicines, reminders, metrics, share_links).
    const { data: userMembers } = await supabaseAdmin
      .from("members")
      .select("id")
      .in("user_id", familyUserIds);
    const memberIds = (userMembers || []).map((m: { id: string }) => m.id);

    const data: Record<string, unknown[]> = {};

    for (const [table, since] of Object.entries(sinceMap)) {
      if (!ALLOWED_TABLES.includes(table)) continue;

      let query;
      if (table === "members") {
        query = supabaseAdmin.from("members")
          .select("*")
          .in("user_id", familyUserIds)
          .gt("updated_at", since);
      } else if (table === "reminder_logs") {
        if (memberIds.length === 0) { data[table] = []; continue; }
        // Get reminder IDs for this user's members
        const { data: reminders } = await supabaseAdmin
          .from("reminders")
          .select("id")
          .in("member_id", memberIds);
        const reminderIds = (reminders || []).map((r: { id: string }) => r.id);
        if (reminderIds.length === 0) { data[table] = []; continue; }
        query = supabaseAdmin.from("reminder_logs")
          .select("*")
          .in("reminder_id", reminderIds)
          .gt("updated_at", since);
      } else {
        if (memberIds.length === 0) { data[table] = []; continue; }
        query = supabaseAdmin.from(table)
          .select("*")
          .in("member_id", memberIds)
          .gt("updated_at", since);
      }

      const { data: rows, error } = await query
        .order("updated_at", { ascending: true })
        .limit(500);
      data[table] = error ? [] : (rows || []);
    }

    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Sync pull error:", message, err);
    return NextResponse.json(
      { error: "Sync pull failed", detail: message },
      { status: 500 }
    );
  }
}
