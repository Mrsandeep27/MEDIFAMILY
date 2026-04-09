import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/admin";
import { invalidateRulesCache } from "@/lib/ai/medical/rules-server";

/**
 * GET  /api/admin/rules?status=pending|all     → list candidates
 * GET  /api/admin/rules?type=active            → list active rules
 * POST /api/admin/rules                        → manually add an active rule
 * (per-id approve/reject lives in /api/admin/rules/[id])
 */

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const status = url.searchParams.get("status") || "pending";

  if (type === "active") {
    const rules = await prisma.activeRule.findMany({
      where: { is_active: true },
      orderBy: [{ severity: "desc" }, { created_at: "desc" }],
      take: 500,
    });
    return NextResponse.json({ rules });
  }

  // Default: list candidates
  const where = status === "all" ? {} : { status };
  const candidates = await prisma.ruleCandidate.findMany({
    where,
    orderBy: { created_at: "desc" },
    take: 100,
  });

  // Counts for the dashboard header
  const [pending, approved, rejected] = await Promise.all([
    prisma.ruleCandidate.count({ where: { status: "pending" } }),
    prisma.ruleCandidate.count({ where: { status: "approved" } }),
    prisma.ruleCandidate.count({ where: { status: "rejected" } }),
  ]);
  const activeCount = await prisma.activeRule.count({ where: { is_active: true } });

  return NextResponse.json({
    candidates,
    counts: { pending, approved, rejected, active: activeCount },
  });
}

interface NewRuleBody {
  rule_text?: string;
  category?: string;
  severity?: string;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json() as NewRuleBody;
  if (!body.rule_text || typeof body.rule_text !== "string" || body.rule_text.length < 10) {
    return NextResponse.json({ error: "rule_text required (min 10 chars)" }, { status: 400 });
  }

  const rule = await prisma.activeRule.create({
    data: {
      rule_text: body.rule_text.slice(0, 500),
      category: ["safety", "red_flag", "grounding", "dosage", "tone"].includes(body.category || "")
        ? body.category!
        : "safety",
      severity: ["low", "normal", "high", "critical"].includes(body.severity || "")
        ? body.severity!
        : "normal",
      source: "manual",
      is_active: true,
    },
  });

  invalidateRulesCache();
  return NextResponse.json({ rule });
}
