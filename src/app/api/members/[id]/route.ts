import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const { data, error } = await supabaseAuth.auth.getUser(authHeader.slice(7));
    if (!error && data.user) return data.user.id;
  }
  return null;
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
    // Get reminder ids to delete reminder_logs through them.
    const { data: reminders } = await supabaseAdmin
      .from("reminders")
      .select("id")
      .eq("member_id", id);
    const reminderIds = (reminders || []).map((r: { id: string }) => r.id);

    if (reminderIds.length > 0) {
      await supabaseAdmin
        .from("reminder_logs")
        .delete()
        .in("reminder_id", reminderIds);
    }

    // Delete from each table that references members
    await supabaseAdmin.from("medicines").delete().eq("member_id", id);
    await supabaseAdmin.from("reminders").delete().eq("member_id", id);
    await supabaseAdmin.from("share_links").delete().eq("member_id", id);
    await supabaseAdmin.from("health_metrics").delete().eq("member_id", id);
    await supabaseAdmin.from("health_records").delete().eq("member_id", id);

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
