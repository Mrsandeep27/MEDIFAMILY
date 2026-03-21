import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Find share link
  const { data: shareLink, error: linkError } = await supabase
    .from("share_links")
    .select("*")
    .eq("token", token)
    .eq("is_active", true)
    .single();

  if (linkError || !shareLink) {
    return NextResponse.json(
      { error: "Share link not found or expired" },
      { status: 404 }
    );
  }

  // Check expiry
  if (new Date(shareLink.expires_at) < new Date()) {
    return NextResponse.json(
      { error: "Share link has expired" },
      { status: 404 }
    );
  }

  // Get member info
  const { data: member } = await supabase
    .from("members")
    .select("name, blood_group, allergies, chronic_conditions, date_of_birth, gender")
    .eq("id", shareLink.member_id)
    .single();

  if (!member) {
    return NextResponse.json(
      { error: "Member not found" },
      { status: 404 }
    );
  }

  // Get records
  let recordsQuery = supabase
    .from("health_records")
    .select("id, type, title, doctor_name, hospital_name, visit_date, diagnosis, notes")
    .eq("member_id", shareLink.member_id)
    .eq("is_deleted", false)
    .order("visit_date", { ascending: false });

  if (shareLink.record_ids && shareLink.record_ids.length > 0) {
    recordsQuery = recordsQuery.in("id", shareLink.record_ids);
  }

  const { data: records } = await recordsQuery;

  // Get active medicines
  const { data: medicines } = await supabase
    .from("medicines")
    .select("name, dosage, frequency, is_active")
    .eq("member_id", shareLink.member_id)
    .eq("is_deleted", false);

  // Log access
  await supabase.from("share_access_logs").insert({
    share_link_id: shareLink.id,
    accessed_at: new Date().toISOString(),
    ip_address: request.headers.get("x-forwarded-for") || "unknown",
    user_agent: request.headers.get("user-agent") || "unknown",
  });

  return NextResponse.json({
    member,
    records: records || [],
    medicines: medicines || [],
  });
}
