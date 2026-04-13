import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    let userId: string | null = null;

    // Method 1: Bearer token (works on new devices where cookies aren't set)
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const supabaseAuth = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data, error } = await supabaseAuth.auth.getUser(authHeader.slice(7));
      if (!error && data.user) {
        userId = data.user.id;
      }
    }

    // Method 2: Cookie-based auth (fallback)
    if (!userId) {
      const cookieStore = await cookies();
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll() {
              // read-only in GET
            },
          },
        }
      );
      const { data: { user } } = await supabase.auth.getUser();
      if (user) userId = user.id;
    }

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
