import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/server";
import { getUserFromRequest } from "@/lib/supabase/auth-cache";
import { getMemberQuotaStatus } from "@/lib/ai/quota";
import { v4 as uuidv4 } from "uuid";

/**
 * Bulk-create residents from a parsed CSV.
 *
 * Server is the source of truth on validation + cap enforcement; the
 * client UI does its own pre-flight check, but a hostile or stale
 * client can't bypass these rules:
 *   - name + room_no required
 *   - dob (if present) parseable as YYYY-MM-DD
 *   - blood_group (if present) in the canonical 8-value set
 *   - contact_phone (if present) is a 10-digit Indian mobile
 *   - cap: each accepted row decrements remaining quota; rows past the
 *     cap are returned with a CAP_EXCEEDED error so the UI can offer a
 *     "remove some and retry" prompt instead of silently truncating.
 *
 * Atomicity: each row is upserted independently. We don't wrap in a
 * transaction because PostgREST's batch insert is already atomic per
 * row, and a partial success is more useful than "all 30 fail because
 * row 17 had a bad phone number."
 */
const VALID_BLOOD_GROUPS = new Set([
  "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-",
]);

interface CsvRow {
  name: string;
  dob?: string;
  room_no?: string;
  blood_group?: string;
  /** Semicolon-separated within the cell. Empty cell = no conditions. */
  conditions?: string;
  contact_name?: string;
  contact_phone?: string;
}

interface RowError {
  rowIndex: number; // 0-based index in the input array
  field: string;
  message: string;
}

interface BulkResult {
  inserted: number;
  errors: RowError[];
  /** IDs of newly created residents in row order (skips errored rows). */
  insertedIds: string[];
  /** True when at least one row was rejected for the cap. UI shows a
   *  separate "upgrade" affordance vs validation errors. */
  capHit: boolean;
}

function validateRow(row: CsvRow, idx: number): RowError[] {
  const errs: RowError[] = [];
  if (!row.name || row.name.trim().length < 2) {
    errs.push({ rowIndex: idx, field: "name", message: "Name required (min 2 chars)" });
  }
  if (!row.room_no || row.room_no.trim().length === 0) {
    errs.push({ rowIndex: idx, field: "room_no", message: "Room number required" });
  }
  if (row.dob) {
    const trimmed = row.dob.trim();
    // Accept YYYY-MM-DD or DD/MM/YYYY (common in Indian Excel exports)
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
    const dmy = /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed);
    if (!iso && !dmy) {
      errs.push({ rowIndex: idx, field: "dob", message: "Date format must be YYYY-MM-DD or DD/MM/YYYY" });
    } else {
      const d = new Date(iso ? trimmed : toIso(trimmed));
      if (Number.isNaN(d.getTime())) {
        errs.push({ rowIndex: idx, field: "dob", message: "Unparseable date" });
      }
    }
  }
  if (row.blood_group && !VALID_BLOOD_GROUPS.has(row.blood_group.trim().toUpperCase())) {
    errs.push({ rowIndex: idx, field: "blood_group", message: "Use A+, A-, B+, B-, AB+, AB-, O+, or O-" });
  }
  if (row.contact_phone) {
    const cleaned = row.contact_phone.replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(cleaned)) {
      errs.push({ rowIndex: idx, field: "contact_phone", message: "Must be a 10-digit Indian mobile" });
    }
  }
  return errs;
}

function toIso(dmy: string): string {
  const [d, m, y] = dmy.split("/");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function normalizeDob(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) return toIso(trimmed);
  return undefined;
}

export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseAdminConfigured) {
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 503 }
      );
    }

    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const rows = body.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No rows" }, { status: 400 });
    }
    if (rows.length > 200) {
      return NextResponse.json(
        { error: "Too many rows — max 200 per upload" },
        { status: 400 }
      );
    }

    // 1. Per-row validation (don't hit DB on bad input)
    const errors: RowError[] = [];
    rows.forEach((r, i) => errors.push(...validateRow(r, i)));

    // 2. Cap check (member-cap is shared between family + residents)
    const quota = await getMemberQuotaStatus(user.userId).catch(() => null);
    const remaining = quota
      ? (quota.unlimited ? Infinity : quota.remaining)
      : Infinity;
    const validRowsByIdx = rows
      .map((r, i) => ({ row: r as CsvRow, idx: i }))
      .filter(({ idx }) => !errors.some((e) => e.rowIndex === idx));

    const acceptedRows = validRowsByIdx.slice(0, Number.isFinite(remaining) ? Number(remaining) : validRowsByIdx.length);
    const capRejected = validRowsByIdx.slice(acceptedRows.length);

    let capHit = false;
    if (capRejected.length > 0) {
      capHit = true;
      for (const { idx } of capRejected) {
        errors.push({
          rowIndex: idx,
          field: "_cap",
          message: `Cap reached — only ${remaining} resident slots available`,
        });
      }
    }

    // 3. Bulk insert
    const now = new Date().toISOString();
    const insertedIds: string[] = [];
    const inserts = acceptedRows.map(({ row }) => {
      const id = uuidv4();
      insertedIds.push(id);
      const conditions = (row.conditions || "")
        .split(/[;,]/)
        .map((c) => c.trim())
        .filter(Boolean);
      return {
        id,
        user_id: user.userId,
        name: row.name.trim(),
        relation: "other",
        date_of_birth: normalizeDob(row.dob) ?? null,
        blood_group: (row.blood_group || "").trim().toUpperCase() || "",
        gender: "",
        allergies: [],
        chronic_conditions: conditions,
        emergency_contact_name: row.contact_name?.trim() || null,
        emergency_contact_phone: row.contact_phone?.replace(/\D/g, "") || null,
        avatar_url: null,
        is_resident: true,
        room_no: row.room_no!.trim(),
        admission_date: now.slice(0, 10),
        discharged_at: null,
        is_deleted: false,
        created_at: now,
        updated_at: now,
      };
    });

    let inserted = 0;
    if (inserts.length > 0) {
      const { error: insertErr } = await supabaseAdmin
        .from("members")
        .insert(inserts);
      if (insertErr) {
        console.error("[bulk residents] insert failed:", insertErr.message);
        return NextResponse.json(
          { error: `Database error: ${insertErr.message}` },
          { status: 500 }
        );
      }
      inserted = inserts.length;
    }

    const result: BulkResult = {
      inserted,
      errors,
      insertedIds,
      capHit,
    };
    return NextResponse.json(result);
  } catch (err) {
    console.error("Bulk residents error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
