import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromRequest } from "@/lib/supabase/auth-cache";
import { AI_FEATURES } from "@/constants/config";

function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

async function verifyAdmin(request: NextRequest): Promise<{ email: string } | null> {
  const authUser = await getUserFromRequest(request);
  if (!authUser?.email) return null;
  const email = authUser.email.toLowerCase();
  const admins = getAdminEmails();
  if (admins.length === 0 || !admins.includes(email)) return null;
  return { email };
}

// GET — list all overrides + search-by-email helper
// ?search=foo@bar.com → looks up Supabase user (even if no override yet)
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim().toLowerCase();

  // List existing overrides
  const overrides = await prisma.userOverride.findMany({
    orderBy: { updated_at: "desc" },
    take: 200,
  });

  // Search: resolve email → Supabase user ID, even if no override exists
  let searchResult: { user_id: string; email: string | null } | null = null;
  if (search) {
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const user = data?.users.find((u) => u.email?.toLowerCase() === search);
    if (user) searchResult = { user_id: user.id, email: user.email ?? null };
  }

  // Enrich overrides with current-month usage count
  const firstOfMonth = new Date();
  firstOfMonth.setUTCDate(1);
  firstOfMonth.setUTCHours(0, 0, 0, 0);

  const enriched = await Promise.all(
    overrides.map(async (o) => {
      const used = await prisma.apiUsage.count({
        where: {
          user_id: o.user_id,
          success: true,
          feature: { in: AI_FEATURES as unknown as string[] },
          created_at: { gte: firstOfMonth },
        },
      });
      return { ...o, used_this_month: used };
    })
  );

  return NextResponse.json({ overrides: enriched, searchResult });
}

// POST — upsert an override
// body: { user_id, email?, ai_quota_limit?, member_cap?, plan?, note? }
// Set a numeric field to null to clear it. -1 = unlimited.
export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { user_id, email, ai_quota_limit, member_cap, plan, note } = body;

  if (!user_id || typeof user_id !== "string") {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }

  const data = {
    email: email ?? null,
    ai_quota_limit: ai_quota_limit === undefined ? null : ai_quota_limit,
    member_cap: member_cap === undefined ? null : member_cap,
    plan: plan ?? null,
    note: note ?? null,
    updated_by: admin.email,
  };

  const result = await prisma.userOverride.upsert({
    where: { user_id },
    update: data,
    create: { user_id, ...data },
  });

  return NextResponse.json({ success: true, override: result });
}

// DELETE — remove an override (user reverts to defaults)
// body: { user_id }
export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { user_id } = body;
  if (!user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 });

  await prisma.userOverride.delete({ where: { user_id } }).catch(() => null);
  return NextResponse.json({ success: true });
}

// PATCH — reset a user's monthly usage counter (mid-month support)
// body: { user_id }
export async function PATCH(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { user_id, action } = body;
  if (!user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 });

  if (action === "reset_monthly_usage") {
    const firstOfMonth = new Date();
    firstOfMonth.setUTCDate(1);
    firstOfMonth.setUTCHours(0, 0, 0, 0);
    const { count } = await prisma.apiUsage.deleteMany({
      where: {
        user_id,
        feature: { in: AI_FEATURES as unknown as string[] },
        created_at: { gte: firstOfMonth },
      },
    });
    return NextResponse.json({ success: true, deleted: count });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
