import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin";
import { feedbackSchema, feedbackPatchSchema } from "@/lib/utils/validators";

// POST: Submit feedback
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Invalid input";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { user_id, user_email, user_name, category, rating, message, page, device } = parsed.data;

    const row = {
      user_id: user_id || null,
      user_email: user_email || null,
      user_name: user_name || null,
      category,
      rating: rating || null,
      message: message.trim(),
      page: page || null,
      device: device || null,
      status: "new",
    };

    const { data, error } = await supabaseAdmin.from("feedback").insert(row).select("id").single();

    if (error) {
      console.error("Feedback insert error:", error);
      return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
    }

    return NextResponse.json({ id: data.id, success: true });
  } catch (err) {
    console.error("Feedback POST error:", err);
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}

// GET: Admin — list all feedback
export async function GET(request: NextRequest) {
  try {
    const adminResult = await requireAdmin(request);
    if (!adminResult.ok) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const category = searchParams.get("category") || undefined;

    let query = supabaseAdmin.from("feedback").select("*").order("created_at", { ascending: false }).limit(100);
    if (status) query = query.eq("status", status);
    if (category) query = query.eq("category", category);

    const { data: feedback, error } = await query;
    if (error) throw error;

    const { count: total } = await supabaseAdmin.from("feedback").select("*", { count: "exact", head: true });
    const { count: newCount } = await supabaseAdmin.from("feedback").select("*", { count: "exact", head: true }).eq("status", "new");

    return NextResponse.json({
      feedback,
      stats: { total: total || 0, new: newCount || 0 },
    });
  } catch (err) {
    console.error("Feedback GET error:", err);
    return NextResponse.json({ error: "Failed to fetch feedback" }, { status: 500 });
  }
}

// PATCH: Admin — update feedback status/note
export async function PATCH(request: NextRequest) {
  try {
    const adminResult = await requireAdmin(request);
    if (!adminResult.ok) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const body = await request.json();

    const parsed = feedbackPatchSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Invalid input";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { id, status, admin_note } = parsed.data;

    const updateData: Record<string, string> = {};
    if (status) updateData.status = status;
    if (admin_note !== undefined) updateData.admin_note = admin_note;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.from("feedback").update(updateData).eq("id", id).select().single();
    if (error) throw error;

    return NextResponse.json({ success: true, feedback: data });
  } catch (err) {
    console.error("Feedback PATCH error:", err);
    return NextResponse.json({ error: "Failed to update feedback" }, { status: 500 });
  }
}
