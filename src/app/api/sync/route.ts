import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/prisma";

// Map API table names to Prisma model accessors
function getModel(table: string) {
  const map: Record<string, any> = {
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

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { table, items } = await request.json();

    if (!table || !Array.isArray(items) || !ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Get user's member IDs for ownership validation
    const userMembers = await prisma.member.findMany({
      where: { user_id: auth.userId },
      select: { id: true },
    });
    const memberIds = new Set(userMembers.map((m) => m.id));

    const model = getModel(table);
    if (!model) {
      return NextResponse.json({ error: "Invalid table" }, { status: 400 });
    }

    const results = { pushed: 0, errors: [] as string[] };

    for (const item of items) {
      try {
        const { sync_status, synced_at, local_image_blobs, ...data } = item;

        // Ownership validation
        if (table === "members") {
          data.user_id = auth.userId;
        } else if ("member_id" in data) {
          // Verify the member_id belongs to this user
          if (!memberIds.has(data.member_id)) {
            results.errors.push(`${item.id}: unauthorized member_id`);
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
    const since = searchParams.get("since") || "2000-01-01T00:00:00Z";

    if (!table || !ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: "Invalid table" }, { status: 400 });
    }

    const userMembers = await prisma.member.findMany({
      where: { user_id: auth.userId },
      select: { id: true },
    });
    const memberIds = userMembers.map((m) => m.id);

    let data: any[] = [];

    switch (table) {
      case "members":
        data = await prisma.member.findMany({
          where: { user_id: auth.userId, updated_at: { gt: new Date(since) } },
        });
        break;
      case "health_records":
        data = await prisma.healthRecord.findMany({
          where: { member_id: { in: memberIds }, updated_at: { gt: new Date(since) } },
        });
        break;
      case "medicines":
        data = await prisma.medicine.findMany({
          where: { member_id: { in: memberIds }, updated_at: { gt: new Date(since) } },
        });
        break;
      case "reminders":
        data = await prisma.reminder.findMany({
          where: { member_id: { in: memberIds }, updated_at: { gt: new Date(since) } },
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
            updated_at: { gt: new Date(since) },
          },
        });
        break;
      }
      case "share_links":
        data = await prisma.shareLink.findMany({
          where: { member_id: { in: memberIds }, updated_at: { gt: new Date(since) } },
        });
        break;
      case "health_metrics":
        data = await prisma.healthMetric.findMany({
          where: { member_id: { in: memberIds }, updated_at: { gt: new Date(since) } },
        });
        break;
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Sync pull error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
