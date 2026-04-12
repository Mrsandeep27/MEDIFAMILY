"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Stethoscope,
  Share2,
  Copy,
  Check,
  Loader2,
  Sparkles,
  AlertTriangle,
  Heart,
  Pill,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  Phone,
  Droplets,
  ChevronDown,
  MessageCircle,
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { useMembers } from "@/hooks/use-members";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/dexie";
import { METRIC_CONFIG } from "@/hooks/use-health-metrics";
import { RELATION_LABELS, FREQUENCY_LABELS } from "@/constants/config";
import { toast } from "sonner";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calculateAge(dob: string): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const md = now.getMonth() - birth.getMonth();
  if (md < 0 || (md === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function trend(values: number[]): "up" | "down" | "stable" {
  if (values.length < 2) return "stable";
  const first = values[0];
  const last = values[values.length - 1];
  const diff = last - first;
  const pct = Math.abs(diff) / (first || 1);
  if (pct < 0.05) return "stable";
  return diff > 0 ? "up" : "down";
}

const TrendIcon = ({ dir }: { dir: "up" | "down" | "stable" }) => {
  if (dir === "up") return <TrendingUp className="h-3.5 w-3.5 text-red-500" />;
  if (dir === "down") return <TrendingDown className="h-3.5 w-3.5 text-green-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function VisitPrepPage() {
  const router = useRouter();
  const { members, isLoading: membersLoading } = useMembers();
  const [selectedId, setSelectedId] = useState<string>("");
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);
  const [aiSummary, setAiSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showMemberPicker, setShowMemberPicker] = useState(false);

  const member = useMemo(() => {
    if (selectedId) return members.find((m) => m.id === selectedId);
    return members.find((m) => m.relation === "self") || members[0];
  }, [members, selectedId]);

  const memberId = member?.id || "";

  // Pull all data for selected member
  const activeMeds = useLiveQuery(
    () =>
      memberId
        ? db.medicines.filter((m) => !m.is_deleted && m.member_id === memberId && m.is_active).toArray()
        : [],
    [memberId]
  );

  const recentVitals = useLiveQuery(
    () =>
      memberId
        ? db.healthMetrics
            .filter((m) => !m.is_deleted && m.member_id === memberId)
            .toArray()
            .then((ms) => ms.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()))
        : [],
    [memberId]
  );

  const recentRecords = useLiveQuery(
    () =>
      memberId
        ? db.records
            .filter((r) => !r.is_deleted && r.member_id === memberId)
            .toArray()
            .then((rs) =>
              rs
                .sort((a, b) => new Date(b.visit_date || b.created_at).getTime() - new Date(a.visit_date || a.created_at).getTime())
                .slice(0, 5)
            )
        : [],
    [memberId]
  );

  const isLoading = membersLoading || activeMeds === undefined || recentVitals === undefined || recentRecords === undefined;

  // ─── Synthesize vitals by type (last 30 days) ──────────────────────────────
  const vitalsSummary = useMemo(() => {
    if (!recentVitals || recentVitals.length === 0) return [];

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recent = recentVitals.filter((v) => new Date(v.recorded_at) >= thirtyDaysAgo);

    const byType = new Map<string, typeof recent>();
    for (const v of recent) {
      const existing = byType.get(v.type) || [];
      existing.push(v);
      byType.set(v.type, existing);
    }

    return Array.from(byType.entries()).map(([type, metrics]) => {
      const config = METRIC_CONFIG[type as keyof typeof METRIC_CONFIG];
      const field = config?.fields[0];
      if (!field) return null;

      const values = metrics
        .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
        .map((m) => m.value[field.key])
        .filter((v) => v !== undefined);

      const latest = values[values.length - 1];
      const dir = trend(values);

      // For BP, also get diastolic
      let secondaryLabel = "";
      if (type === "bp" && config.fields.length > 1) {
        const diastolicValues = metrics
          .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
          .map((m) => m.value["diastolic"])
          .filter((v) => v !== undefined);
        const latestD = diastolicValues[diastolicValues.length - 1];
        if (latestD !== undefined) {
          secondaryLabel = `/${latestD}`;
        }
      }

      return {
        type,
        label: config?.label || type,
        unit: config?.unit || "",
        latest,
        secondaryLabel,
        values,
        trend: dir,
        count: values.length,
      };
    }).filter(Boolean);
  }, [recentVitals]);

  // ─── Build text brief for AI + sharing ─────────────────────────────────────
  const buildBrief = useCallback(() => {
    if (!member) return "";

    const age = member.date_of_birth ? calculateAge(member.date_of_birth) : null;

    const lines: string[] = [
      `DOCTOR VISIT BRIEF — ${member.name}`,
      `Generated: ${formatDate(new Date().toISOString())} | MediFamily`,
      "",
      "BASICS:",
      `  Name: ${member.name}`,
      `  Relation: ${RELATION_LABELS[member.relation] || member.relation}`,
      age !== null ? `  Age: ${age} years` : "",
      member.gender ? `  Gender: ${member.gender.charAt(0).toUpperCase() + member.gender.slice(1)}` : "",
      member.blood_group ? `  Blood Group: ${member.blood_group}` : "",
    ].filter(Boolean);

    if (member.allergies.length > 0) {
      lines.push("", `ALLERGIES: ${member.allergies.join(", ")}`);
    }

    if (member.chronic_conditions.length > 0) {
      lines.push("", `CONDITIONS: ${member.chronic_conditions.join(", ")}`);
    }

    if (activeMeds && activeMeds.length > 0) {
      lines.push("", "CURRENT MEDICINES:");
      for (const med of activeMeds) {
        const parts = [med.name];
        if (med.dosage) parts.push(med.dosage);
        if (med.frequency) parts.push(FREQUENCY_LABELS[med.frequency] || med.frequency);
        if (med.before_food) parts.push("(before food)");
        lines.push(`  - ${parts.join(" — ")}`);
      }
    }

    if (vitalsSummary && vitalsSummary.length > 0) {
      lines.push("", "RECENT VITALS (last 30 days):");
      for (const v of vitalsSummary) {
        if (!v) continue;
        const trendLabel = v.trend === "up" ? "TRENDING UP" : v.trend === "down" ? "TRENDING DOWN" : "STABLE";
        const valuesStr = v.values.join(" → ");
        lines.push(`  ${v.label}: ${valuesStr}${v.secondaryLabel} ${v.unit} (${trendLabel})`);
      }
    }

    if (recentRecords && recentRecords.length > 0) {
      lines.push("", "RECENT VISITS/RECORDS:");
      for (const rec of recentRecords) {
        const date = rec.visit_date ? formatDate(rec.visit_date) : formatDate(rec.created_at);
        const parts = [date, rec.title];
        if (rec.doctor_name) parts.push(`Dr. ${rec.doctor_name}`);
        if (rec.diagnosis) parts.push(`Diagnosis: ${rec.diagnosis}`);
        lines.push(`  - ${parts.join(" | ")}`);
      }
    }

    if (member.emergency_contact_phone) {
      lines.push(
        "",
        `EMERGENCY CONTACT: ${member.emergency_contact_name || "Contact"} — ${member.emergency_contact_phone}`
      );
    }

    if (aiQuestions.length > 0) {
      lines.push("", "QUESTIONS TO ASK DOCTOR:");
      aiQuestions.forEach((q, i) => lines.push(`  ${i + 1}. ${q}`));
    }

    if (aiSummary) {
      lines.push("", `SUMMARY: ${aiSummary}`);
    }

    lines.push("", "---", "Generated by MediFamily | medifamily.in");

    return lines.join("\n");
  }, [member, activeMeds, vitalsSummary, recentRecords, aiQuestions, aiSummary]);

  // ─── AI questions ──────────────────────────────────────────────────────────
  const generateQuestions = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    try {
      const brief = buildBrief();
      const res = await fetch("/api/visit-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief }),
      });
      const data = await res.json();
      if (data.questions?.length > 0) setAiQuestions(data.questions);
      if (data.visit_summary) setAiSummary(data.visit_summary);
    } catch {
      toast.error("Could not generate questions. You can still share the brief.");
    } finally {
      setAiLoading(false);
    }
  };

  // ─── Share ─────────────────────────────────────────────────────────────────
  const handleShare = async () => {
    const text = buildBrief();
    if (navigator.share) {
      try {
        await navigator.share({ title: `Doctor Visit Brief — ${member?.name}`, text });
        return;
      } catch {
        // fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Visit brief copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy. Try taking a screenshot.");
    }
  };

  // ─── Loading / Empty ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <AppHeader title="Visit Prep" showBack />
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <AppHeader title="Visit Prep" showBack />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <Stethoscope className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-bold mb-1">No Family Members</h3>
          <p className="text-sm text-muted-foreground mb-4">Add a family member first to prepare a visit brief.</p>
          <Button onClick={() => router.push("/family/add")}>Add Family Member</Button>
        </div>
      </div>
    );
  }

  if (!member) return null;

  const age = member.date_of_birth ? calculateAge(member.date_of_birth) : null;
  const hasData = (activeMeds && activeMeds.length > 0) || (vitalsSummary && vitalsSummary.length > 0) || (recentRecords && recentRecords.length > 0);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <AppHeader title="Doctor Visit Prep" showBack />

      <main className="flex-1 px-4 py-4 pb-32 space-y-4 max-w-lg mx-auto w-full">
        {/* ─── Member Selector ──────────────────────────────────────── */}
        <button
          onClick={() => setShowMemberPicker(!showMemberPicker)}
          className="w-full flex items-center justify-between bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
              {member.name.charAt(0).toUpperCase()}
            </div>
            <div className="text-left">
              <p className="font-semibold">{member.name}</p>
              <p className="text-xs text-muted-foreground">
                {RELATION_LABELS[member.relation]}
                {age !== null && ` · ${age} yrs`}
                {member.blood_group && ` · ${member.blood_group}`}
              </p>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showMemberPicker ? "rotate-180" : ""}`} />
        </button>

        {showMemberPicker && members.length > 1 && (
          <div className="bg-background border rounded-xl overflow-hidden -mt-2">
            {members
              .filter((m) => m.id !== member.id)
              .map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setSelectedId(m.id);
                    setShowMemberPicker(false);
                    setAiQuestions([]);
                    setAiSummary("");
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 border-t transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{RELATION_LABELS[m.relation]}</p>
                  </div>
                </button>
              ))}
          </div>
        )}

        {/* ─── Patient Identity Card ────────────────────────────────── */}
        <Card className="border-blue-200 dark:border-blue-800">
          <div className="bg-blue-600 px-4 py-2.5 flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-white" />
            <span className="text-white text-xs font-bold uppercase tracking-widest">
              Doctor Visit Brief
            </span>
          </div>
          <CardContent className="pt-4 space-y-3">
            {/* Allergies */}
            {member.allergies.length > 0 && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-xs font-bold text-red-700 dark:text-red-400 uppercase">Allergies</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {member.allergies.map((a) => (
                    <Badge key={a} variant="destructive" className="text-xs">{a}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Conditions */}
            {member.chronic_conditions.length > 0 && (
              <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Heart className="h-4 w-4 text-orange-600" />
                  <span className="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase">Conditions</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {member.chronic_conditions.map((c) => (
                    <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Current medicines */}
            {activeMeds && activeMeds.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Pill className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase">Current Medicines</span>
                </div>
                <div className="space-y-1.5">
                  {activeMeds.map((med) => (
                    <div key={med.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2 text-sm">
                      <span className="font-medium">{med.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {[med.dosage, med.frequency ? FREQUENCY_LABELS[med.frequency] || med.frequency : ""].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vitals trends */}
            {vitalsSummary && vitalsSummary.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-purple-600" />
                  <span className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase">Vitals (last 30 days)</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {vitalsSummary.map((v) => {
                    if (!v) return null;
                    return (
                      <div key={v.type} className="bg-muted/50 rounded-lg p-2.5">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">{v.label}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-lg font-bold">
                            {v.latest}{v.secondaryLabel}
                          </span>
                          <span className="text-xs text-muted-foreground">{v.unit}</span>
                          <TrendIcon dir={v.trend} />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {v.count} readings · {v.values.join(" → ")}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent records */}
            {recentRecords && recentRecords.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase">Recent Visits</span>
                </div>
                <div className="space-y-1.5">
                  {recentRecords.slice(0, 3).map((rec) => (
                    <div key={rec.id} className="bg-muted/50 rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate">{rec.title}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                          {formatDate(rec.visit_date || rec.created_at)}
                        </span>
                      </div>
                      {(rec.doctor_name || rec.diagnosis) && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {[rec.doctor_name ? `Dr. ${rec.doctor_name}` : "", rec.diagnosis].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No data hint */}
            {!hasData && (
              <div className="text-center py-6 text-muted-foreground">
                <p className="text-sm">No health data yet for {member.name}.</p>
                <p className="text-xs mt-1">Add medicines, vitals, or records first.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── AI Smart Questions ───────────────────────────────────── */}
        {hasData && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-amber-600" />
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase">
                    Questions to Ask Doctor
                  </span>
                </div>
                {aiQuestions.length === 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={generateQuestions}
                    disabled={aiLoading}
                    className="h-8 text-xs"
                  >
                    {aiLoading ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Thinking...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3 mr-1" />
                        Generate with AI
                      </>
                    )}
                  </Button>
                )}
              </div>

              {aiQuestions.length > 0 ? (
                <div className="space-y-2">
                  {aiQuestions.map((q, i) => (
                    <div key={i} className="flex gap-2.5 bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3">
                      <span className="text-amber-700 dark:text-amber-400 font-bold text-sm shrink-0">{i + 1}.</span>
                      <p className="text-sm">{q}</p>
                    </div>
                  ))}
                  {aiSummary && (
                    <p className="text-xs text-muted-foreground mt-2 italic">{aiSummary}</p>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setAiQuestions([]); setAiSummary(""); generateQuestions(); }}
                    className="h-7 text-xs mt-1"
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    Regenerate
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {aiLoading
                    ? "Analyzing health trends to generate smart questions..."
                    : "Tap \"Generate with AI\" to get personalized questions based on health trends."}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center pt-2">
          <p className="text-[11px] text-muted-foreground">
            Show this brief to your doctor. It saves time and improves care.
          </p>
        </div>
      </main>

      {/* ─── Sticky Share Bar ────────────────────────────────────────── */}
      {hasData && (
        <div className="fixed bottom-20 left-0 right-0 px-4 z-10 pointer-events-none">
          <div className="max-w-lg mx-auto pointer-events-auto flex gap-2">
            <Button
              onClick={handleShare}
              className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white shadow-2xl shadow-blue-600/30 rounded-full font-semibold"
            >
              <Share2 className="h-5 w-5 mr-2" />
              Share Visit Brief
            </Button>
            <Button
              onClick={async () => {
                const text = buildBrief();
                try {
                  await navigator.clipboard.writeText(text);
                  setCopied(true);
                  toast.success("Copied!");
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  toast.error("Could not copy");
                }
              }}
              variant="outline"
              className="h-12 w-12 rounded-full shadow-lg shrink-0"
            >
              {copied ? <Check className="h-5 w-5 text-green-600" /> : <Copy className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
