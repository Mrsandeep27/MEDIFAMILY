import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// This endpoint is called by Vercel Cron every 5 days
// to prevent Supabase free tier from pausing
export async function GET() {
  try {
    // Simple query to keep the database active
    const count = await prisma.user.count();
    return NextResponse.json({
      status: "alive",
      users: count,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
