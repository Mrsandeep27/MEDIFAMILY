import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createClient } from "@supabase/supabase-js";

// Admin emails — set in Vercel env var (comma-separated)
function getAdminEmails(): string[] {
  const emails = process.env.ADMIN_EMAILS || "";
  return emails.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

// Verify admin from Supabase Auth token
async function verifyAdmin(request: NextRequest): Promise<{ email: string } | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.email) return null;

  const email = data.user.email.toLowerCase();
  const adminEmails = getAdminEmails();

  if (adminEmails.length === 0 || !adminEmails.includes(email)) {
    return null;
  }

  return { email };
}

// GET: Admin dashboard data
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const section = searchParams.get("section") || "overview";

    if (section === "overview") {
      // Use try-catch per query to handle missing tables gracefully
      const safeCount = async (fn: () => Promise<number>) => { try { return await fn(); } catch { return 0; } };
      const safeQuery = async <T>(fn: () => Promise<T>, fallback: T) => { try { return await fn(); } catch { return fallback; } };

      const [
        totalMembers,
        totalRecords,
        totalMedicines,
        totalReminders,
        totalFeedback,
        newFeedback,
        totalFamilies,
        recentFeedback,
      ] = await Promise.all([
        safeCount(() => prisma.member.count({ where: { is_deleted: false } })),
        safeCount(() => prisma.healthRecord.count({ where: { is_deleted: false } })),
        safeCount(() => prisma.medicine.count({ where: { is_deleted: false } })),
        safeCount(() => prisma.reminder.count({ where: { is_deleted: false } })),
        safeCount(() => prisma.feedback.count()),
        safeCount(() => prisma.feedback.count({ where: { status: "new" } })),
        safeCount(() => prisma.family.count()),
        safeQuery(() => prisma.feedback.findMany({ orderBy: { created_at: "desc" }, take: 5 }), []),
      ]);

      return NextResponse.json({
        stats: {
          totalMembers,
          totalRecords,
          totalMedicines,
          totalReminders,
          totalFeedback,
          newFeedback,
          totalFamilies,
        },
        recentFeedback,
      });
    }

    if (section === "users") {
      const members = await prisma.member.findMany({
        where: { is_deleted: false },
        orderBy: { created_at: "desc" },
        take: 100,
        select: {
          id: true,
          name: true,
          relation: true,
          gender: true,
          blood_group: true,
          user_id: true,
          created_at: true,
        },
      });
      return NextResponse.json({ members });
    }

    if (section === "feedback") {
      const status = searchParams.get("status") || undefined;
      const category = searchParams.get("category") || undefined;

      const feedback = await prisma.feedback.findMany({
        where: {
          ...(status ? { status } : {}),
          ...(category ? { category } : {}),
        },
        orderBy: { created_at: "desc" },
        take: 100,
      });

      const stats = {
        total: await prisma.feedback.count(),
        new: await prisma.feedback.count({ where: { status: "new" } }),
        avgRating: await prisma.feedback.aggregate({ _avg: { rating: true } }),
      };

      return NextResponse.json({ feedback, stats });
    }

    if (section === "families") {
      const families = await prisma.family.findMany({
        include: {
          members: {
            include: {
              user: { select: { email: true, name: true } },
            },
          },
        },
        orderBy: { created_at: "desc" },
      });
      return NextResponse.json({ families });
    }

    if (section === "records") {
      const records = await prisma.healthRecord.findMany({
        where: { is_deleted: false },
        orderBy: { created_at: "desc" },
        take: 50,
        include: {
          member: { select: { name: true } },
        },
      });
      return NextResponse.json({ records });
    }

    if (section === "api-usage") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [totalCalls, todayCalls, successCalls, failedCalls, byFeature, recentCalls, avgDuration] = await Promise.all([
        prisma.apiUsage.count(),
        prisma.apiUsage.count({ where: { created_at: { gte: today } } }),
        prisma.apiUsage.count({ where: { success: true } }),
        prisma.apiUsage.count({ where: { success: false } }),
        prisma.apiUsage.groupBy({ by: ["feature"], _count: true, orderBy: { _count: { feature: "desc" } } }),
        prisma.apiUsage.findMany({ orderBy: { created_at: "desc" }, take: 20 }),
        prisma.apiUsage.aggregate({ _avg: { duration: true } }),
      ]);

      return NextResponse.json({
        totalCalls,
        todayCalls,
        successCalls,
        failedCalls,
        successRate: totalCalls > 0 ? Math.round((successCalls / totalCalls) * 100) : 0,
        avgDuration: Math.round(avgDuration._avg.duration || 0),
        byFeature,
        recentCalls,
      });
    }

    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  } catch (err) {
    console.error("Admin GET error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH: Admin actions (update feedback, etc.)
export async function PATCH(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === "update_feedback") {
      const { id, status, admin_note } = body;
      const updated = await prisma.feedback.update({
        where: { id },
        data: {
          ...(status ? { status } : {}),
          ...(admin_note !== undefined ? { admin_note } : {}),
        },
      });
      return NextResponse.json({ success: true, feedback: updated });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("Admin PATCH error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
