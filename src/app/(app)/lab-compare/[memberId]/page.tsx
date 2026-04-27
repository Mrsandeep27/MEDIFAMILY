"use client";

import { use, useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowDown,
  ArrowUp,
  Minus,
  TrendingDown,
  TrendingUp,
  Sparkles,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { db } from "@/lib/db/dexie";
import { AppHeader } from "@/components/layout/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { EmptyState } from "@/components/common/empty-state";
import { useLocale } from "@/lib/i18n/use-locale";
import { useMembers } from "@/hooks/use-members";
import { createClient } from "@/lib/supabase/client";
import { normalizeMarkerName, parseNumericValue } from "@/lib/lab/normalize";

interface SavedMarker {
  name: string;
  value: string;
  normal_range: string;
  status: "normal" | "low" | "high" | "critical";
  explanation?: string;
  advice?: string;
}

interface SavedLabAnalysis {
  _type: "lab_analysis_v1";
  markers: SavedMarker[];
  summary: string;
  patient_summary?: string;
  urgent_attention?: string[];
  patient_name?: string;
  lab_name?: string;
  report_date?: string;
}

interface LabReportRecord {
  id: string;
  visit_date?: string;
  hospital_name?: string;
  created_at: string;
  notes?: string;
  parsed?: SavedLabAnalysis;
}

// Two markers can be compared if both have parseable numeric values AND
// move in the same direction relative to the same reference range. We
// don't try to convert units across labs — if units differ we treat the
// pair as not-comparable to avoid false trends.
type Movement = "improved" | "worsened" | "stable" | "resolved" | "new_abnormal" | "incomparable";

interface Diff {
  canonical: string;
  display_name: string;
  prev_value: string;
  curr_value: string;
  prev_status: string;
  curr_status: string;
  prev_num: number;
  curr_num: number;
  delta_num: number;
  delta_pct: number;
  movement: Movement;
  /** Comparable means both prev and curr have parseable numbers AND same
   *  reference range — basis for trend chart. Non-comparable still shows
   *  status change (normal → high) but no numeric delta. */
  comparable: boolean;
}

function parseRecord(rec: LabReportRecord): SavedLabAnalysis | null {
  if (!rec.notes) return null;
  try {
    const parsed = JSON.parse(rec.notes);
    if (parsed._type === "lab_analysis_v1" && Array.isArray(parsed.markers)) {
      return parsed;
    }
  } catch {
    // Older records may have plain-text notes — not a lab analysis.
  }
  return null;
}

function computeDiff(prev: SavedLabAnalysis, curr: SavedLabAnalysis): Diff[] {
  // Build canonical → marker map for prev. If a lab printed the same
  // canonical marker twice on one report (rare but possible — e.g. CBC
  // page + summary page) we keep the first occurrence; canonical names
  // collide intentionally for trend matching.
  const prevByKey = new Map<string, SavedMarker>();
  for (const m of prev.markers) {
    if (!m.name) continue;
    const key = normalizeMarkerName(m.name);
    if (!prevByKey.has(key)) prevByKey.set(key, m);
  }
  const currByKey = new Map<string, SavedMarker>();
  for (const m of curr.markers) {
    if (!m.name) continue;
    const key = normalizeMarkerName(m.name);
    if (!currByKey.has(key)) currByKey.set(key, m);
  }

  const allKeys = new Set([...prevByKey.keys(), ...currByKey.keys()]);
  const diffs: Diff[] = [];

  for (const key of allKeys) {
    const p = prevByKey.get(key);
    const c = currByKey.get(key);
    // Marker only on one side — no trend, but worth flagging if the
    // current side is abnormal (new finding).
    if (!p && c) {
      if (c.status !== "normal") {
        diffs.push({
          canonical: key,
          display_name: c.name,
          prev_value: "—",
          curr_value: c.value,
          prev_status: "missing",
          curr_status: c.status,
          prev_num: NaN,
          curr_num: parseNumericValue(c.value),
          delta_num: NaN,
          delta_pct: NaN,
          movement: "new_abnormal",
          comparable: false,
        });
      }
      continue;
    }
    if (p && !c) continue; // marker dropped — not interesting

    if (!p || !c) continue;
    const prevNum = parseNumericValue(p.value);
    const currNum = parseNumericValue(c.value);
    const numericPair = !isNaN(prevNum) && !isNaN(currNum);
    const sameRange = (p.normal_range || "").trim() === (c.normal_range || "").trim();

    // Determine movement from status transition + numeric delta
    let movement: Movement = "stable";
    if (p.status === "normal" && c.status !== "normal") {
      movement = "new_abnormal";
    } else if (p.status !== "normal" && c.status === "normal") {
      movement = "resolved";
    } else if (numericPair && sameRange) {
      // Both abnormal or both normal. Compare numbers — but "improved"
      // means moving TOWARD normal range, not just smaller.
      const range = parseRangeBounds(p.normal_range);
      if (range) {
        const prevDistance = distanceFromRange(prevNum, range);
        const currDistance = distanceFromRange(currNum, range);
        if (currDistance < prevDistance - 0.01) movement = "improved";
        else if (currDistance > prevDistance + 0.01) movement = "worsened";
        else movement = "stable";
      } else if (p.status === "high" || p.status === "critical") {
        movement = currNum < prevNum ? "improved" : currNum > prevNum ? "worsened" : "stable";
      } else if (p.status === "low") {
        movement = currNum > prevNum ? "improved" : currNum < prevNum ? "worsened" : "stable";
      }
    } else {
      movement = "incomparable";
    }

    diffs.push({
      canonical: key,
      display_name: c.name || p.name,
      prev_value: p.value,
      curr_value: c.value,
      prev_status: p.status,
      curr_status: c.status,
      prev_num: prevNum,
      curr_num: currNum,
      delta_num: numericPair ? currNum - prevNum : NaN,
      delta_pct: numericPair && prevNum !== 0 ? ((currNum - prevNum) / prevNum) * 100 : NaN,
      movement,
      comparable: numericPair && sameRange,
    });
  }

  return diffs;
}

// Parse "13 - 17", "<150", ">=240", "0.7-1.3" into {low, high} bounds.
// Returns null if unparseable. For one-sided ranges (<150) returns
// {low: -Infinity, high: 150}.
function parseRangeBounds(range: string): { low: number; high: number } | null {
  if (!range) return null;
  const r = range.replace(/\s+/g, "");
  // Two-sided: "13-17" or "0.7-1.3"
  const twoSided = r.match(/^(-?\d+\.?\d*)[-–](-?\d+\.?\d*)/);
  if (twoSided) {
    return { low: Number(twoSided[1]), high: Number(twoSided[2]) };
  }
  const lessThan = r.match(/^<=?(-?\d+\.?\d*)/);
  if (lessThan) return { low: -Infinity, high: Number(lessThan[1]) };
  const greaterThan = r.match(/^>=?(-?\d+\.?\d*)/);
  if (greaterThan) return { low: Number(greaterThan[1]), high: Infinity };
  return null;
}

// How far a value is from the normal range. 0 if inside, positive
// distance if outside (in the same units as the value).
function distanceFromRange(value: number, range: { low: number; high: number }): number {
  if (value < range.low) return range.low - value;
  if (value > range.high) return value - range.high;
  return 0;
}

// Format a delta like "+0.6", "-12", "+8.5%" depending on magnitude.
function formatDelta(diff: Diff): string {
  if (!diff.comparable || isNaN(diff.delta_num)) return "";
  const sign = diff.delta_num > 0 ? "+" : "";
  const abs = Math.abs(diff.delta_num);
  // Use percent when delta is small absolute but big relative
  if (abs < 1 && Math.abs(diff.delta_pct) > 5) {
    return `${sign}${diff.delta_num.toFixed(2)} (${diff.delta_pct > 0 ? "+" : ""}${diff.delta_pct.toFixed(0)}%)`;
  }
  return `${sign}${diff.delta_num.toFixed(diff.delta_num % 1 === 0 ? 0 : 2)}`;
}

export default function LabComparePage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const { members } = useMembers();
  const member = members.find((m) => m.id === memberId);

  // Load all lab reports for this member, newest first
  const allLabRecords = useLiveQuery(async () => {
    const recs = await db.records
      .where("member_id")
      .equals(memberId)
      .filter((r) => !r.is_deleted && r.type === "lab_report")
      .toArray();
    const enriched: LabReportRecord[] = recs.map((r) => ({
      id: r.id,
      visit_date: r.visit_date,
      hospital_name: r.hospital_name,
      created_at: r.created_at,
      notes: r.notes,
      parsed: parseRecord(r as LabReportRecord) || undefined,
    })).filter((r) => r.parsed);
    enriched.sort((a, b) => {
      const ad = a.visit_date || a.created_at;
      const bd = b.visit_date || b.created_at;
      return bd.localeCompare(ad);
    });
    return enriched;
  }, [memberId]);

  // Default selection: newest as "current", second-newest as "previous"
  const initialCurr = searchParams.get("curr") || allLabRecords?.[0]?.id || "";
  const initialPrev = searchParams.get("prev") || allLabRecords?.[1]?.id || "";

  const [currId, setCurrId] = useState(initialCurr);
  const [prevId, setPrevId] = useState(initialPrev);

  // Resync when records load
  useEffect(() => {
    if (!allLabRecords || allLabRecords.length === 0) return;
    if (!currId) setCurrId(allLabRecords[0].id);
    if (!prevId && allLabRecords.length > 1) setPrevId(allLabRecords[1].id);
  }, [allLabRecords, currId, prevId]);

  const currReport = allLabRecords?.find((r) => r.id === currId);
  const prevReport = allLabRecords?.find((r) => r.id === prevId);

  const diffs = useMemo(() => {
    if (!currReport?.parsed || !prevReport?.parsed) return [];
    return computeDiff(prevReport.parsed, currReport.parsed);
  }, [currReport, prevReport]);

  const grouped = useMemo(() => {
    return {
      worsened: diffs.filter((d) => d.movement === "worsened"),
      new_abnormal: diffs.filter((d) => d.movement === "new_abnormal"),
      improved: diffs.filter((d) => d.movement === "improved"),
      resolved: diffs.filter((d) => d.movement === "resolved"),
      stable: diffs.filter((d) => d.movement === "stable" && (d.prev_status !== "normal" || d.curr_status !== "normal")),
    };
  }, [diffs]);

  // Trend summary state (AI-generated)
  const [trendSummary, setTrendSummary] = useState<string>("");
  const [trendHeadline, setTrendHeadline] = useState<string>("");
  const [trendVerdict, setTrendVerdict] = useState<string>("");
  const [trendLoading, setTrendLoading] = useState(false);

  useEffect(() => {
    if (!currReport?.parsed || !prevReport?.parsed) return;
    let cancelled = false;

    const fetchTrend = async () => {
      setTrendLoading(true);
      setTrendSummary("");
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

        const payload = {
          mode: "compare",
          locale,
          comparison: {
            prev_date: prevReport.visit_date || prevReport.parsed!.report_date,
            curr_date: currReport.visit_date || currReport.parsed!.report_date,
            improved: grouped.improved.map((d) => ({
              name: d.display_name,
              prev: d.prev_value,
              curr: d.curr_value,
              delta: formatDelta(d),
            })),
            worsened: grouped.worsened.map((d) => ({
              name: d.display_name,
              prev: d.prev_value,
              curr: d.curr_value,
              delta: formatDelta(d),
            })),
            stable: grouped.stable.map((d) => ({
              name: d.display_name,
              prev: d.prev_value,
              curr: d.curr_value,
            })),
            new_abnormal: grouped.new_abnormal.map((d) => ({
              name: d.display_name,
              curr: d.curr_value,
              status: d.curr_status,
            })),
            resolved: grouped.resolved.map((d) => ({
              name: d.display_name,
              prev: d.prev_value,
              curr: d.curr_value,
            })),
          },
        };

        const res = await fetch("/api/lab-insights", {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        setTrendSummary(data.trend_summary || "");
        setTrendHeadline(data.headline || "");
        setTrendVerdict(data.verdict || "");
      } catch (err) {
        console.warn("Trend summary failed:", err);
      } finally {
        if (!cancelled) setTrendLoading(false);
      }
    };

    fetchTrend();
    return () => { cancelled = true; };
    // Stringify dependent fields so we don't re-fire on memo identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currReport?.id, prevReport?.id, locale]);

  if (allLabRecords === undefined) {
    return (
      <div>
        <AppHeader title="Compare Lab Reports" showBack />
        <div className="flex items-center justify-center min-h-[50vh]">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <div>
        <AppHeader title="Compare Lab Reports" showBack />
        <div className="p-4">
          <EmptyState
            icon={AlertCircle}
            title="Member not found"
            description="This family member couldn't be located."
          />
        </div>
      </div>
    );
  }

  if (allLabRecords.length < 2) {
    return (
      <div>
        <AppHeader title="Compare Lab Reports" showBack />
        <div className="p-4">
          <EmptyState
            icon={Calendar}
            title="Need at least 2 reports"
            description={`${member.name} only has ${allLabRecords.length} lab report${allLabRecords.length === 1 ? "" : "s"}. Upload another report to start comparing trends.`}
          />
          <div className="flex justify-center mt-4">
            <Button onClick={() => router.push("/lab-insights")}>
              Upload Lab Report
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const verdictColor =
    trendVerdict === "improved" ? "border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-800"
    : trendVerdict === "worsened" ? "border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800"
    : "border-primary/30 bg-primary/5";

  return (
    <div>
      <AppHeader title="Compare Lab Reports" showBack />
      <div className="p-4 space-y-4">
        {/* Member name */}
        <p className="text-sm text-muted-foreground">For {member.name}</p>

        {/* Report pickers */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Older Report</label>
            <Select value={prevId} onValueChange={(v) => v && setPrevId(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {allLabRecords
                  .filter((r) => r.id !== currId)
                  .map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.visit_date || r.parsed?.report_date || r.created_at.slice(0, 10)}
                      {r.hospital_name ? ` · ${r.hospital_name}` : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Newer Report</label>
            <Select value={currId} onValueChange={(v) => v && setCurrId(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {allLabRecords
                  .filter((r) => r.id !== prevId)
                  .map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.visit_date || r.parsed?.report_date || r.created_at.slice(0, 10)}
                      {r.hospital_name ? ` · ${r.hospital_name}` : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* AI Trend Summary */}
        <Card className={verdictColor}>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-primary">
                {trendHeadline || "Trend Summary"}
              </p>
            </div>
            {trendLoading ? (
              <p className="text-sm text-muted-foreground italic">Analyzing trends…</p>
            ) : trendSummary ? (
              <p className="text-sm leading-relaxed whitespace-pre-line">{trendSummary}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Trend summary unavailable. Per-marker comparison shown below.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-2">
          <StatBox label="Improved" count={grouped.improved.length + grouped.resolved.length} variant="green" />
          <StatBox label="Worsened" count={grouped.worsened.length + grouped.new_abnormal.length} variant="red" />
          <StatBox label="Stable" count={grouped.stable.length} variant="yellow" />
          <StatBox label="Total" count={diffs.length} variant="gray" />
        </div>

        {/* Sections */}
        {grouped.worsened.length > 0 && (
          <DiffSection
            title="Got Worse"
            icon={TrendingUp}
            iconColor="text-red-600"
            diffs={grouped.worsened}
          />
        )}
        {grouped.new_abnormal.length > 0 && (
          <DiffSection
            title="New Findings"
            icon={AlertCircle}
            iconColor="text-orange-600"
            diffs={grouped.new_abnormal}
          />
        )}
        {grouped.resolved.length > 0 && (
          <DiffSection
            title="Resolved"
            icon={TrendingDown}
            iconColor="text-green-600"
            diffs={grouped.resolved}
          />
        )}
        {grouped.improved.length > 0 && (
          <DiffSection
            title="Improved"
            icon={TrendingDown}
            iconColor="text-green-600"
            diffs={grouped.improved}
          />
        )}
        {grouped.stable.length > 0 && (
          <DiffSection
            title="Still Abnormal"
            icon={Minus}
            iconColor="text-yellow-600"
            diffs={grouped.stable}
          />
        )}
      </div>
    </div>
  );
}

function StatBox({
  label,
  count,
  variant,
}: {
  label: string;
  count: number;
  variant: "green" | "red" | "yellow" | "gray";
}) {
  const colors = {
    green: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    red: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    gray: "bg-muted text-foreground",
  };
  return (
    <div className={`rounded-lg p-2 text-center ${colors[variant]}`}>
      <p className="text-lg font-bold">{count}</p>
      <p className="text-[10px]">{label}</p>
    </div>
  );
}

function DiffSection({
  title,
  icon: Icon,
  iconColor,
  diffs,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  diffs: Diff[];
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          {title} ({diffs.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {diffs.map((d) => (
          <DiffRow key={d.canonical} diff={d} />
        ))}
      </CardContent>
    </Card>
  );
}

function DiffRow({ diff }: { diff: Diff }) {
  const arrow =
    diff.movement === "improved" || diff.movement === "resolved"
      ? <ArrowDown className="h-3 w-3 text-green-600" />
      : diff.movement === "worsened" || diff.movement === "new_abnormal"
        ? <ArrowUp className="h-3 w-3 text-red-600" />
        : <Minus className="h-3 w-3 text-muted-foreground" />;
  const deltaStr = formatDelta(diff);
  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{diff.display_name}</p>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{diff.prev_value}</span>
          {arrow}
          <span className="font-semibold text-foreground">{diff.curr_value}</span>
          {deltaStr && <span className="text-muted-foreground">({deltaStr})</span>}
        </div>
      </div>
      <Badge
        variant="outline"
        className={
          diff.curr_status === "normal" ? "text-green-700 border-green-300"
          : diff.curr_status === "critical" ? "text-red-700 border-red-300"
          : "text-orange-700 border-orange-300"
        }
      >
        {diff.curr_status}
      </Badge>
    </div>
  );
}
