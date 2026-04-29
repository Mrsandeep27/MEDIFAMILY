import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/server";
import {
  canSend,
  generateOtp,
  hashOtp,
  recordSent,
  storeOtp,
} from "@/lib/care-share-otp";

/**
 * Send an OTP to the family member's phone for a care-home share.
 *
 * Body: { phone: string }  // 10-digit Indian mobile
 *
 * Vague success responses on miss prevent enumeration of authorized
 * phones via the public link. Rate-limited to one OTP per token per 60s.
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
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return NextResponse.json({ error: "Invalid phone" }, { status: 400 });
    }

    if (!canSend(token)) {
      return NextResponse.json(
        { sent: true, message: "OTP already sent. Try in 1 minute." },
        { status: 200 }
      );
    }

    const { data: share } = await supabaseAdmin
      .from("care_home_shares")
      .select("id, authorized_phone, revoked_at, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (
      !share ||
      share.revoked_at ||
      (share.expires_at && new Date(share.expires_at) < new Date()) ||
      share.authorized_phone !== phone
    ) {
      // Vague response — never confirm whether token + phone match
      return NextResponse.json(
        { sent: true, message: "If the phone matches, an OTP has been sent." },
        { status: 200 }
      );
    }

    const otp = generateOtp();
    const hash = await hashOtp(otp, token);
    storeOtp(token, hash);
    recordSent(token);

    // TODO: integrate MSG91 / Twilio. Pilot: console-logged, caretaker
    // can read it from logs and hand to the family member if needed.
    console.log(`[care-share OTP] token=${token} phone=${phone} otp=${otp}`);

    return NextResponse.json({
      sent: true,
      message: "OTP sent to the registered family phone.",
    });
  } catch (err) {
    console.error("OTP send error:", err);
    return NextResponse.json({ error: "Failed to send OTP" }, { status: 500 });
  }
}
