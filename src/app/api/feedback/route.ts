import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// POST: Submit feedback
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, user_email, user_name, category, rating, message, page, device } = body;

    if (!message || typeof message !== "string" || message.trim().length < 3) {
      return NextResponse.json({ error: "Message is required (min 3 characters)" }, { status: 400 });
    }

    const feedback = await prisma.feedback.create({
      data: {
        user_id: user_id || null,
        user_email: user_email || null,
        user_name: user_name || null,
        category: category || "review",
        rating: rating ? Math.min(5, Math.max(1, Number(rating))) : null,
        message: message.trim().slice(0, 2000),
        page: page || null,
        device: device || null,
        status: "new",
      },
    });

    return NextResponse.json({ id: feedback.id, success: true });
  } catch (err) {
    console.error("Feedback POST error:", err);
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}

// GET: Admin — list all feedback
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminKey = searchParams.get("key");

    // Simple admin auth — use JWT_SECRET as admin key
    if (adminKey !== process.env.JWT_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
  } catch (err) {
    console.error("Feedback GET error:", err);
    return NextResponse.json({ error: "Failed to fetch feedback" }, { status: 500 });
  }
}

// PATCH: Admin — update feedback status/note
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, admin_note, key } = body;

    if (key !== process.env.JWT_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!id) {
      return NextResponse.json({ error: "Feedback ID required" }, { status: 400 });
    }

    const updated = await prisma.feedback.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(admin_note !== undefined ? { admin_note } : {}),
      },
    });

    return NextResponse.json({ success: true, feedback: updated });
  } catch (err) {
    console.error("Feedback PATCH error:", err);
    return NextResponse.json({ error: "Failed to update feedback" }, { status: 500 });
  }
}
