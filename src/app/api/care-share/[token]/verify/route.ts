import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/server";
import { consumeOtp } from "@/lib/care-share-otp";

/**
 * Verify the family-side OTP. On success, returns the resident's
 * read-only view payload (profile + active meds + last 30 days of dose
 * logs + recent incidents) so the family page can render without a
 * second round-trip.
 *
 * Side effects:
 *  - Updates last_accessed_at on the share row (audit trail).
 *  - Marks the OTP as consumed (single-use; another OTP must be
 *    requested for re-access).
 *
 * Body: { phone: string, otp: string }
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ token: string }> }
) {
  try {
    if (!isSupabaseAdminConfigured) {
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 503 }
      );
    }
    const { token } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    const phone = String(body.phone || "").replace(/\D/g, "");
    const otp = String(body.otp || "").replace(/\D/g, "");

    if (!/^[6-9]\d{9}$/.test(phone) || !/^\d{6}$/.test(otp)) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const ok = await consumeOtp(token, otp);
    if (!ok) {
      return NextResponse.json(
        { error: "Wrong or expired code" },
        { status: 401 }
      );
    }

    // Fetch share + resident
    const { data: share } = await supabaseAdmin
      .from("care_home_shares")
      .select("id, member_id, authorized_phone, revoked_at, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (
      !share ||
      share.revoked_at ||
      share.authorized_phone !== phone ||
      (share.expires_at && new Date(share.expires_at) < new Date())
    ) {
      return NextResponse.json({ error: "Link unavailable" }, { status: 403 });
    }

    const memberId = share.member_id;
    const { data: member } = await supabaseAdmin
      .from("members")
      .select(
        "id, name, room_no, date_of_birth, blood_group, chronic_conditions, allergies, admission_date"
      )
      .eq("id", memberId)
      .maybeSingle();
    if (!member) {
      return NextResponse.json({ error: "Resident not found" }, { status: 404 });
    }

    // Active meds
    const { data: medicines } = await supabaseAdmin
      .from("medicines")
      .select("id, name, dosage, frequency, before_food, is_active")
      .eq("member_id", memberId)
      .eq("is_active", true)
      .eq("is_deleted", false);

    // Last 30 days of dose logs (joined client-side via reminder_id)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString();
    const { data: reminders } = await supabaseAdmin
      .from("reminders")
      .select("id, medicine_name, time, dosage, before_food")
      .eq("member_id", memberId)
      .eq("is_deleted", false);
    const reminderById = new Map(
      (reminders || []).map((r: { id: string; [k: string]: unknown }) => [r.id, r])
    );
    const reminderIds = (reminders || []).map(
      (r: { id: string }) => r.id
    );
    const { data: rawLogs } = reminderIds.length
      ? await supabaseAdmin
          .from("reminder_logs")
          .select("id, reminder_id, scheduled_at, status, acted_at, created_at")
          .in("reminder_id", reminderIds)
          .gte("created_at", thirtyDaysAgo)
          .order("created_at", { ascending: false })
          .limit(200)
      : { data: [] };
    const logsTyped = (rawLogs || []) as Array<Record<string, unknown>>;
    const logs = logsTyped.map((l) => {
      const r = reminderById.get(l.reminder_id as string) as
        | { medicine_name?: string }
        | undefined;
      return {
        ...l,
        medicine_name: r?.medicine_name || "Medicine",
      };
    });

    // Recent incidents
    const { data: incidents } = await supabaseAdmin
      .from("incidents")
      .select("id, type, occurred_at, notes, action_taken")
      .eq("member_id", memberId)
      .eq("is_deleted", false)
      .order("occurred_at", { ascending: false })
      .limit(20);

    // Update last_accessed_at for the audit trail
    await supabaseAdmin
      .from("care_home_shares")
      .update({ last_accessed_at: new Date().toISOString() })
      .eq("id", share.id);

    return NextResponse.json({
      resident: member,
      medicines: medicines || [],
      logs,
      incidents: incidents || [],
    });
  } catch (err) {
    console.error("OTP verify error:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
