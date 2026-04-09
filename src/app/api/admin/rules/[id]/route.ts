import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/admin";
import { invalidateRulesCache } from "@/lib/ai/medical/rules-server";

/**
 * PATCH /api/admin/rules/[id]
 * ───────────────────────────
 * Approve, reject, or edit a rule_candidate (when ?type=candidate, default)
 * OR toggle/delete an active rule (when ?type=active).
 *
 * Body for candidate:
 *   { action: "approve" | "reject" | "edit", final_rule?, category?, severity? }
 *
 * Body for active rule:
 *   { action: "deactivate" | "delete" | "edit", rule_text?, category?, severity? }
 */

interface PatchBody {
  action?: string;
  final_rule?: string;
  rule_text?: string;
  category?: string;
  severity?: string;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await context.params;
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "candidate";
  const body = (await request.json()) as PatchBody;

  if (type === "active") {
    return handleActiveRule(id, body, auth.user.email);
  }

  return handleCandidate(id, body, auth.user.email);
}

async function handleCandidate(id: string, body: PatchBody, reviewerEmail: string) {
  const candidate = await prisma.ruleCandidate.findUnique({ where: { id } });
  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }
  if (candidate.status !== "pending") {
    return NextResponse.json({ error: `Already ${candidate.status}` }, { status: 400 });
  }

  if (body.action === "reject") {
    await prisma.ruleCandidate.update({
      where: { id },
      data: {
        status: "rejected",
        reviewer_email: reviewerEmail,
        reviewed_at: new Date(),
      },
    });
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  if (body.action === "approve" || body.action === "edit") {
    const ruleText = (body.final_rule || body.rule_text || candidate.proposed_rule || "").trim();
    if (!ruleText || ruleText.length < 10) {
      return NextResponse.json({ error: "rule_text/final_rule required (min 10 chars)" }, { status: 400 });
    }
    const category = body.category || candidate.proposed_category || "safety";
    const severity = body.severity || candidate.proposed_severity || "normal";

    // Insert into active_rules
    const rule = await prisma.activeRule.create({
      data: {
        rule_text: ruleText.slice(0, 500),
        category,
        severity,
        source: "from_candidate",
        candidate_id: id,
        is_active: true,
      },
    });

    // Mark candidate as approved (or edited)
    await prisma.ruleCandidate.update({
      where: { id },
      data: {
        status: body.action === "edit" ? "edited" : "approved",
        reviewer_email: reviewerEmail,
        reviewed_at: new Date(),
        final_rule: ruleText,
      },
    });

    invalidateRulesCache();
    return NextResponse.json({ ok: true, status: "approved", rule });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

async function handleActiveRule(id: string, body: PatchBody, _reviewerEmail: string) {
  const rule = await prisma.activeRule.findUnique({ where: { id } });
  if (!rule) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  if (body.action === "deactivate") {
    await prisma.activeRule.update({
      where: { id },
      data: { is_active: false },
    });
    invalidateRulesCache();
    return NextResponse.json({ ok: true });
  }

  if (body.action === "delete") {
    await prisma.activeRule.delete({ where: { id } });
    invalidateRulesCache();
    return NextResponse.json({ ok: true });
  }

  if (body.action === "edit") {
    if (!body.rule_text || body.rule_text.length < 10) {
      return NextResponse.json({ error: "rule_text required" }, { status: 400 });
    }
    await prisma.activeRule.update({
      where: { id },
      data: {
        rule_text: body.rule_text.slice(0, 500),
        category: body.category || rule.category,
        severity: body.severity || rule.severity,
      },
    });
    invalidateRulesCache();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
