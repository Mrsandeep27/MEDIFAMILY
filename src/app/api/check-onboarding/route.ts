import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromRequest } from "@/lib/supabase/auth-cache";

export async function GET(request: NextRequest) {
  try {
    // Uses the shared 30s auth cache so repeated calls (onboarding mount,
    // root redirect, addMember self-check) only verify the token once per
    // half-minute window.
    const authUser = await getUserFromRequest(request);
    const userId = authUser?.userId ?? null;

    if (!userId) {
      return NextResponse.json({ onboarded: false });
    }

    // Use admin client to bypass RLS — user is already authenticated above
    const { data: selfMember } = await supabaseAdmin
      .from("members")
      .select("id, name")
      .eq("user_id", userId)
      .eq("relation", "self")
      .eq("is_deleted", false)
      .limit(1)
      .single();

    return NextResponse.json({
      onboarded: !!selfMember,
      memberName: selfMember?.name || null,
    });
  } catch {
    return NextResponse.json({ onboarded: false });
  }
}
