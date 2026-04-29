import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/auth-cache";
import { getMemberQuotaStatus } from "@/lib/ai/quota";

// GET /api/member-quota — returns the user's current member usage + cap.
// Used by /family/add to gate the form and show "X of N used" hints.
// Returns Infinity as the string "unlimited" so JSON.stringify doesn't
// drop it (Infinity → null in stock JSON).
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const status = await getMemberQuotaStatus(user.userId);
    return NextResponse.json({
      used: status.used,
      limit: status.unlimited ? "unlimited" : status.limit,
      remaining: status.unlimited ? "unlimited" : status.remaining,
      exceeded: status.exceeded,
      unlimited: status.unlimited,
      plan: status.plan,
    });
  } catch (err) {
    // Never block the form on a quota lookup error — fail-open with
    // generous defaults so the user can still add members.
    console.warn("[member-quota] lookup failed:", err);
    return NextResponse.json({
      used: 0,
      limit: "unlimited",
      remaining: "unlimited",
      exceeded: false,
      unlimited: true,
      plan: null,
    });
  }
}
