import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/prisma";
import type { PrismaClient } from "@prisma/client";

type ModelDelegate = PrismaClient[keyof PrismaClient];

function getModel(table: string): ModelDelegate | null {
  const map: Record<string, ModelDelegate> = {
    members: prisma.member,
    health_records: prisma.healthRecord,
    medicines: prisma.medicine,
    reminders: prisma.reminder,
    reminder_logs: prisma.reminderLog,
    share_links: prisma.shareLink,
    health_metrics: prisma.healthMetric,
  };
  return map[table] || null;
}

const ALLOWED_TABLES = [
  "members", "health_records", "medicines", "reminders",
  "reminder_logs", "share_links", "health_metrics",
];

// Fields that are safe to sync (whitelist per table)
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
    if (allowed.has(key)) {
      clean[key] = value;
    }
  }
  return clean;
}

function isValidDate(str: string): boolean {
  const d = new Date(str);
  return !isNaN(d.getTime());
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { table, items } = await request.json();

    if (!table || typeof table !== "string" || !Array.isArray(items) || !ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    if (items.length > 100) {
      return NextResponse.json({ error: "Max 100 items per request" }, { status: 400 });
    }

    const userMembers = await prisma.member.findMany({
      where: { user_id: auth.userId },
      select: { id: true },
    });
    const memberIds = new Set(userMembers.map((m) => m.id));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = getModel(table) as any;
    if (!model) {
      return NextResponse.json({ error: "Invalid table" }, { status: 400 });
    }

    const results = { pushed: 0, errors: [] as string[] };

    for (const item of items) {
      try {
        if (!item.id || typeof item.id !== "string") {
          results.errors.push("Item missing valid id");
          continue;
        }

        // Sanitize: only allow whitelisted fields
        const data = sanitizeItem(table, item);
        data.id = item.id;

        // Ownership validation
        if (table === "members") {
          (data as Record<string, unknown>).user_id = auth.userId;
        } else if ("member_id" in data) {
          if (!data.member_id || !memberIds.has(data.member_id as string)) {
            results.errors.push(`${item.id}: unauthorized member_id`);
            continue;
          }
        }

        // Validate record_id for medicines
        if (table === "medicines" && data.record_id) {
          const recordExists = await prisma.healthRecord.findUnique({
            where: { id: data.record_id as string },
            select: { id: true },
          });
          if (!recordExists) {
            results.errors.push(`${item.id}: invalid record_id`);
            continue;
          }
        }

        await model.upsert({
          where: { id: data.id },
          create: data,
          update: data,
        });
        results.pushed++;
      } catch (err) {
        results.errors.push(`${item.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return NextResponse.json(results);
  } catch (err) {
    console.error("Sync push error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const table = searchParams.get("table");
    const sinceRaw = searchParams.get("since") || "2000-01-01T00:00:00Z";

    if (!table || typeof table !== "string" || !ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: "Invalid table" }, { status: 400 });
    }

    // Validate date param
    if (!isValidDate(sinceRaw)) {
      return NextResponse.json({ error: "Invalid since date" }, { status: 400 });
    }
    const since = new Date(sinceRaw);

    const userMembers = await prisma.member.findMany({
      where: { user_id: auth.userId },
      select: { id: true },
    });
    const memberIds = userMembers.map((m) => m.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any[] = [];

    switch (table) {
      case "members":
        data = await prisma.member.findMany({
          where: { user_id: auth.userId, updated_at: { gt: since } },
        });
        break;
      case "health_records":
        data = await prisma.healthRecord.findMany({
          where: { member_id: { in: memberIds }, updated_at: { gt: since } },
        });
        break;
      case "medicines":
        data = await prisma.medicine.findMany({
          where: { member_id: { in: memberIds }, updated_at: { gt: since } },
        });
        break;
      case "reminders":
        data = await prisma.reminder.findMany({
          where: { member_id: { in: memberIds }, updated_at: { gt: since } },
        });
        break;
      case "reminder_logs": {
        const reminderIds = await prisma.reminder.findMany({
          where: { member_id: { in: memberIds } },
          select: { id: true },
        });
        data = await prisma.reminderLog.findMany({
          where: {
            reminder_id: { in: reminderIds.map((r) => r.id) },
            updated_at: { gt: since },
          },
        });
        break;
      }
      case "share_links":
        data = await prisma.shareLink.findMany({
          where: { member_id: { in: memberIds }, updated_at: { gt: since } },
        });
        break;
      case "health_metrics":
        data = await prisma.healthMetric.findMany({
          where: { member_id: { in: memberIds }, updated_at: { gt: since } },
        });
        break;
      default:
        return NextResponse.json({ error: "Invalid table" }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Sync pull error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
