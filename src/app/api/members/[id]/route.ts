import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromRequest } from "@/lib/supabase/auth-cache";

async function getUserId(request: NextRequest): Promise<string | null> {
  const authUser = await getUserFromRequest(request);
  return authUser?.userId ?? null;
}

// DELETE: Hard-delete a member and ALL their related records.
// Cascades through medicines, reminders, reminder_logs, share_links,
// health_records, and health_metrics.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid member id" }, { status: 400 });
    }

    // Verify ownership
    const { data: member } = await supabaseAdmin
      .from("members")
      .select("id, user_id")
      .eq("id", id)
      .maybeSingle();

    if (!member) {
      // Already deleted or never existed — treat as success (idempotent)
      return NextResponse.json({ success: true });
    }

    if (member.user_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Cascade-delete related rows in order (children first to respect FKs).
    // Each step is tracked so partial failures can be reported.
    const cascadeErrors: string[] = [];

    // Get reminder ids to delete reminder_logs through them.
    const { data: reminders } = await supabaseAdmin
      .from("reminders")
      .select("id")
      .eq("member_id", id);
    const reminderIds = (reminders || []).map((r: { id: string }) => r.id);

    if (reminderIds.length > 0) {
      const { error } = await supabaseAdmin
        .from("reminder_logs")
        .delete()
        .in("reminder_id", reminderIds);
      if (error) cascadeErrors.push(`reminder_logs: ${error.message}`);
    }

    // Delete from each table that references members — continue on error
    const cascadeTables = [
      { table: "medicines", column: "member_id" },
      { table: "reminders", column: "member_id" },
      { table: "share_links", column: "member_id" },
      { table: "health_metrics", column: "member_id" },
      { table: "health_records", column: "member_id" },
    ] as const;

    for (const { table, column } of cascadeTables) {
      const { error } = await supabaseAdmin.from(table).delete().eq(column, id);
      if (error) cascadeErrors.push(`${table}: ${error.message}`);
    }

    // Only delete the member if all children were cleaned up
    if (cascadeErrors.length > 0) {
      console.error("[member/delete] cascade partial failure:", cascadeErrors);
      return NextResponse.json(
        { error: "Failed to delete some related records", details: cascadeErrors },
        { status: 500 }
      );
    }

    // Finally delete the member itself
    const { error: delErr } = await supabaseAdmin
      .from("members")
      .delete()
      .eq("id", id);

    if (delErr) {
      console.error("[member/delete] failed:", delErr);
      return NextResponse.json(
        { error: delErr.message || "Failed to delete member" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[member/delete] unexpected:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
