import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/auth-cache";
import { getQuotaStatus } from "@/lib/ai/quota";

export async function GET(request: NextRequest) {
  const authUser = await getUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const status = await getQuotaStatus(authUser.userId);
  return NextResponse.json({
    used: status.unlimited ? 0 : status.used,
    limit: status.unlimited ? null : status.limit,
    remaining: status.unlimited ? null : status.remaining,
    exceeded: status.exceeded,
    unlimited: status.unlimited,
    resetsAt: status.resetsAt,
  });
}
