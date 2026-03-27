import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

// POST: Submit feedback
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, user_email, user_name, category, rating, message, page, device } = body;

    if (!message || typeof message !== "string" || message.trim().length < 3) {
      return NextResponse.json({ error: "Message is required (min 3 characters)" }, { status: 400 });
    }

    const row = {
      user_id: user_id || null,
      user_email: user_email || null,
      user_name: user_name || null,
      category: category || "review",
      rating: rating ? Math.min(5, Math.max(1, Number(rating))) : null,
      message: message.trim().slice(0, 2000),
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
    const { searchParams } = new URL(request.url);
    const adminKey = searchParams.get("key");

    if (adminKey !== process.env.JWT_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    const body = await request.json();
    const { id, status, admin_note, key } = body;

    if (key !== process.env.JWT_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!id) {
      return NextResponse.json({ error: "Feedback ID required" }, { status: 400 });
    }

    const updateData: Record<string, string> = {};
    if (status) updateData.status = status;
    if (admin_note !== undefined) updateData.admin_note = admin_note;

    const { data, error } = await supabaseAdmin.from("feedback").update(updateData).eq("id", id).select().single();
    if (error) throw error;

    return NextResponse.json({ success: true, feedback: data });
  } catch (err) {
    console.error("Feedback PATCH error:", err);
    return NextResponse.json({ error: "Failed to update feedback" }, { status: 500 });
  }
}
