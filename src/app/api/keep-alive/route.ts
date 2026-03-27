import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

// This endpoint is called by Vercel Cron every 5 days
// to prevent Supabase free tier from pausing
export async function GET() {
  try {
    const { count } = await supabaseAdmin
      .from("members")
      .select("*", { count: "exact", head: true });

    return NextResponse.json({
      status: "alive",
      members: count || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
