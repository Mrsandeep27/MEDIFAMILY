"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ArrowDown,
  ArrowUp,
  Minus,
  ShieldAlert,
  Info,
  Save,
  Check,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppHeader } from "@/components/layout/app-header";
import { useLocale } from "@/lib/i18n/use-locale";
import { useMembers } from "@/hooks/use-members";
import { useRecords } from "@/hooks/use-records";
import { useHealthMetrics } from "@/hooks/use-health-metrics";
import { handleQuotaError } from "@/lib/ai/quota-client";
import { toast } from "sonner";

/**
 * Extract vitals (BP, sugar, temperature, SpO2) from lab markers
 * and auto-save them to healthMetrics so the Vitals page shows them.
 */
async function autoSaveVitalsFromMarkers(
  markers: LabMarker[],
  memberId: string,
  reportDate: string,
  addMetric: (data: { member_id: string; type: "bp" | "sugar" | "temperature" | "spo2" | "weight"; value: Record<string, number>; recorded_at: string; notes?: string }) => Promise<string>
) {
  const saved: string[] = [];
  const recordedAt = new Date(reportDate || Date.now()).toISOString();

  // BP: look for systolic/diastolic or "blood pressure"
  const systolicMarker = markers.find((m) => /systolic|sys\s*bp/i.test(m.name));
  const diastolicMarker = markers.find((m) => /diastolic|dia\s*bp/i.test(m.name));
  const bpMarker = markers.find((m) => /blood\s*pressure|^bp$/i.test(m.name));

  if (systolicMarker && diastolicMarker) {
    const sys = parseFloat(systolicMarker.value);
    const dia = parseFloat(diastolicMarker.value);
    if (sys >= 60 && sys <= 250 && dia >= 40 && dia <= 150) {
      await addMetric({ member_id: memberId, type: "bp", value: { systolic: sys, diastolic: dia }, recorded_at: recordedAt, notes: "From lab report" });
      saved.push("BP");
    }
  } else if (bpMarker) {
    const bpMatch = bpMarker.value.match(/(\d+)\s*[\/\\]\s*(\d+)/);
    if (bpMatch) {
      const sys = parseInt(bpMatch[1]);
      const dia = parseInt(bpMatch[2]);
      if (sys >= 60 && sys <= 250 && dia >= 40 && dia <= 150) {
        await addMetric({ member_id: memberId, type: "bp", value: { systolic: sys, diastolic: dia }, recorded_at: recordedAt, notes: "From lab report" });
        saved.push("BP");
      }
    }
  }

  // Blood Sugar: fasting, random, post-prandial, glucose, HbA1c (convert)
  const sugarMarker = markers.find((m) =>
    /glucose|blood\s*sugar|fasting.*sugar|random.*sugar|fbs|rbs|ppbs|post.*prandial/i.test(m.name) &&
    !/hba1c|glycated/i.test(m.name)
  );
  if (sugarMarker) {
    const val = parseFloat(sugarMarker.value);
    if (val >= 30 && val <= 500) {
      await addMetric({ member_id: memberId, type: "sugar", value: { level: val }, recorded_at: recordedAt, notes: `From lab report (${sugarMarker.name})` });
      saved.push("Sugar");
    }
  }

  // Temperature
  const tempMarker = markers.find((m) => /temperature|temp|body\s*temp/i.test(m.name));
  if (tempMarker) {
    let val = parseFloat(tempMarker.value);
    // Convert Celsius to Fahrenheit if needed
    if (val >= 30 && val <= 45) val = val * 9 / 5 + 32;
    if (val >= 90 && val <= 110) {
      await addMetric({ member_id: memberId, type: "temperature", value: { temp: Math.round(val * 10) / 10 }, recorded_at: recordedAt, notes: "From lab report" });
      saved.push("Temperature");
    }
  }

  // SpO2
  const spo2Marker = markers.find((m) => /spo2|oxygen\s*sat|o2\s*sat|pulse\s*ox/i.test(m.name));
  if (spo2Marker) {
    const val = parseFloat(spo2Marker.value);
    if (val >= 70 && val <= 100) {
      await addMetric({ member_id: memberId, type: "spo2", value: { level: val }, recorded_at: recordedAt, notes: "From lab report" });
      saved.push("SpO2");
    }
  }

  // Weight
  const weightMarker = markers.find((m) => /^weight$|body\s*weight/i.test(m.name));
  if (weightMarker) {
    const val = parseFloat(weightMarker.value);
    if (val >= 1 && val <= 300) {
      await addMetric({ member_id: memberId, type: "weight", value: { weight: val }, recorded_at: recordedAt, notes: "From lab report" });
      saved.push("Weight");
    }
  }

  return saved;
}

interface LabMarker {
  name: string;
  value: string;
  normal_range: string;
  status: "normal" | "low" | "high" | "critical";
  explanation: string;
  advice: string;
}

interface LabInsight {
  patient_name?: string;
  report_date?: string;
  lab_name?: string;
  markers: LabMarker[];
  summary: string;
  /** AI-generated warm doctor-explaining-to-patient paragraph (4-6 sentences).
   *  This is the headline insight the patient reads first — reads like a
   *  doctor explaining results across the table, not a transcript. */
  patient_summary?: string;
  urgent_attention?: string[];
}

const statusColors = {
  normal: { color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle2, labelKey: "lab.normal" },
  low: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: ArrowDown, labelKey: "lab.low" },
  high: { color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", icon: ArrowUp, labelKey: "lab.high" },
  critical: { color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: ShieldAlert, labelKey: "lab.critical" },
};

export default function LabInsightsPage() {
  const router = useRouter();
  const { locale, t } = useLocale();
  const { members } = useMembers();
  const { addRecord } = useRecords();
  const { addMetric } = useHealthMetrics();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [insights, setInsights] = useState<LabInsight | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // Multi-page PDF progress state
  const [pageProgress, setPageProgress] = useState<{ current: number; total: number; stage: "rendering" | "analyzing" | "" }>({ current: 0, total: 0, stage: "" });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageBlob(file);
    setSaved(false);
    setInsights(null);
    e.target.value = "";

    // Auto-select self member if only one
    if (members.length === 1) {
      setSelectedMemberId(members[0].id);
    }

    if (file.type === "application/pdf") {
      setPreviewUrl(null);
      await analyzePdfReport(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setPreviewUrl(dataUrl);
        analyzeImageReport(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const autoSelectMemberFromReport = (patientName: string) => {
    if (!patientName || members.length <= 1 || selectedMemberId) return;
    const pname = patientName.toLowerCase().trim();
    const match = members.find((m) => {
      const name = m.name.toLowerCase().trim();
      const firstName = name.split(" ")[0];
      const patientFirst = pname.split(" ")[0];
      return (
        name === pname ||
        name.includes(pname) ||
        pname.includes(name) ||
        firstName === patientFirst ||
        pname.includes(firstName) ||
        firstName.includes(patientFirst)
      );
    });
    if (match) {
      setSelectedMemberId(match.id);
      toast.info(`Auto-selected ${match.name} (matched "${patientName}")`);
    }
  };

  // Single-image analysis (JPG/PNG photos)
  const analyzeImageReport = async (dataUrl: string) => {
    setIsAnalyzing(true);
    setPageProgress({ current: 0, total: 1, stage: "analyzing" });
    try {
      const payload = await compressDataUrl(dataUrl, 1600, 0.85);
      const { createClient } = await import("@/lib/supabase/client");
      const { data: { session } } = await createClient().auth.getSession();

      const res = await fetch("/api/lab-insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ image: payload, locale }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (handleQuotaError(err)) return;
        toast.error(err.error || "Failed to analyze report");
        return;
      }

      const data = await res.json();
      setInsights(data);
      if (data.patient_name) autoSelectMemberFromReport(data.patient_name);

      const abnormal = (data.markers || []).filter((m: LabMarker) => m.status !== "normal").length;
      if (abnormal > 0) toast.warning(`${abnormal} marker(s) need attention`);
      else toast.success("All markers look normal!");
    } catch {
      toast.error("Failed to analyze. Check internet connection.");
    } finally {
      setIsAnalyzing(false);
      setPageProgress({ current: 0, total: 0, stage: "" });
    }
  };

  // Multi-page PDF analysis: render each page -> Gemini -> merge results
  const analyzePdfReport = async (file: File) => {
    setIsAnalyzing(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const { data: { session } } = await createClient().auth.getSession();
      const authHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) authHeaders["Authorization"] = `Bearer ${session.access_token}`;

      // Pipeline: as each page finishes rendering, fire its Gemini call
      // immediately — don't wait for all pages to render first.
      const { streamPdfPages, MAX_PDF_PAGES } = await import("@/lib/pdf/extract-pages");

      // Per-page analyzer with retry logic:
      // - 5xx or network errors: retry once
      // - Response parsed but markers[] empty: retry up to twice (dense CBC
      //   pages occasionally return empty on first pass due to token caps)
      type PdfPageResult = { pageNum: number; data: Partial<LabInsight> | null };
      const analyzePage = async (p: { pageNum: number; totalPages: number; dataUrl: string }, attempt = 0): Promise<PdfPageResult> => {
        const MAX_ATTEMPTS = 3;
        try {
          const res = await fetch("/api/lab-insights", {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ image: p.dataUrl, locale }),
          });
          if (!res.ok) {
            // Quota exceeded = hard stop. Don't retry, don't continue — show
            // upgrade toast via handleQuotaError on the first page that trips.
            if (res.status === 429) {
              const body = await res.json().catch(() => ({}));
              if (body && body.error === "QUOTA_EXCEEDED") {
                handleQuotaError(body);
                return { pageNum: p.pageNum, data: null };
              }
              // Non-quota 429 (Gemini rate limit) — retry as before
              if (attempt < MAX_ATTEMPTS - 1) {
                await new Promise((r) => setTimeout(r, 1500 + attempt * 1000));
                return analyzePage(p, attempt + 1);
              }
            }
            if (attempt < MAX_ATTEMPTS - 1 && res.status >= 500) {
              await new Promise((r) => setTimeout(r, 1500 + attempt * 1000));
              return analyzePage(p, attempt + 1);
            }
            console.warn(`Page ${p.pageNum} failed with status ${res.status} after ${attempt + 1} attempts`);
            return { pageNum: p.pageNum, data: null };
          }
          const data = await res.json();
          // If the response has NO markers AND NO patient info, the page
          // likely dropped out due to token limit or parse failure. Retry.
          const hasAnything = (Array.isArray(data.markers) && data.markers.length > 0)
            || data.patient_name
            || data.lab_name;
          if (!hasAnything && attempt < MAX_ATTEMPTS - 1) {
            console.warn(`Page ${p.pageNum} returned empty — retrying (attempt ${attempt + 2})`);
            await new Promise((r) => setTimeout(r, 800));
            return analyzePage(p, attempt + 1);
          }
          return { pageNum: p.pageNum, data };
        } catch (err) {
          if (attempt < MAX_ATTEMPTS - 1) {
            await new Promise((r) => setTimeout(r, 1500 + attempt * 1000));
            return analyzePage(p, attempt + 1);
          }
          console.warn(`Page ${p.pageNum} error after ${attempt + 1} attempts:`, err);
          return { pageNum: p.pageNum, data: null };
        }
      };

      setPageProgress({ current: 0, total: 0, stage: "rendering" });
      const analysisPromises: Promise<PdfPageResult>[] = [];
      let totalPages = 0;
      let firstPagePreviewSet = false;
      let analyzedCount = 0;

      try {
        totalPages = await streamPdfPages(
          file,
          // Each page fires as soon as it's rendered — kick off analysis immediately
          (p) => {
            if (!firstPagePreviewSet) {
              setPreviewUrl(p.dataUrl);
              firstPagePreviewSet = true;
            }
            // Switch to "analyzing" stage once first page starts analysis
            setPageProgress((prev) => ({
              current: prev.current,
              total: p.totalPages,
              stage: "analyzing",
            }));
            const promise = analyzePage(p).then((result) => {
              analyzedCount++;
              setPageProgress({
                current: analyzedCount,
                total: p.totalPages,
                stage: "analyzing",
              });
              return result;
            });
            analysisPromises.push(promise);
          },
          // onProgress during render (only shown while analyzing hasn't started yet)
          (rendered, total) => {
            setPageProgress((prev) => prev.stage === "rendering" ? { current: rendered, total, stage: "rendering" } : prev);
          }
        );
      } catch (err) {
        console.error("PDF render failed:", err);
        toast.error("Couldn't open PDF. Try uploading each page as an image instead.");
        return;
      }

      if (totalPages === 0) {
        toast.error("PDF has no readable pages.");
        return;
      }

      if (totalPages >= MAX_PDF_PAGES) {
        toast.info(`Report has many pages — reading first ${MAX_PDF_PAGES}`);
      }

      const aggregated: LabInsight = {
        markers: [],
        summary: "",
        urgent_attention: [],
      };
      // Dedup key = canonical(name) + "|" + canonical(value). Same marker with
      // same value across pages (summary + detail page) collapses into one.
      // Same marker with DIFFERENT values (rare — but happens with re-tests)
      // stays as separate entries. Canonical strips punctuation/whitespace so
      // "Haemoglobin (Hb)" and "Haemoglobin(Hb)" match.
      const canonical = (s: string) =>
        String(s || "").toLowerCase().replace(/[\s().,/\\-]+/g, "").trim();
      const markersByKey = new Map<string, LabMarker>();
      let failedCount = 0;

      const allResults = await Promise.all(analysisPromises);

      // Sort by page number so markers appear in document order
      allResults.sort((a, b) => a.pageNum - b.pageNum);

      // Track which page's patient_summary to keep — pick the page with
      // the most markers (densest page = AI had most data to reason from).
      // A 4-page PDF where page 1 is a cover sheet would produce a thin
      // summary if we kept the first; pick the meatiest one instead.
      let bestSummaryPage = -1;
      let bestSummaryMarkerCount = -1;

      for (const result of allResults) {
        if (!result.data) {
          failedCount++;
          continue;
        }
        const pageData = result.data;

        if (!aggregated.patient_name && pageData.patient_name) aggregated.patient_name = pageData.patient_name;
        if (!aggregated.lab_name && pageData.lab_name) aggregated.lab_name = pageData.lab_name;
        if (!aggregated.report_date && pageData.report_date) aggregated.report_date = pageData.report_date;

        const pageMarkerCount = Array.isArray(pageData.markers) ? pageData.markers.length : 0;
        if (pageData.patient_summary && pageMarkerCount > bestSummaryMarkerCount) {
          aggregated.patient_summary = pageData.patient_summary;
          bestSummaryPage = result.pageNum;
          bestSummaryMarkerCount = pageMarkerCount;
        }

        if (Array.isArray(pageData.markers)) {
          for (const m of pageData.markers) {
            if (!m || !m.name) continue;
            const key = `${canonical(m.name)}|${canonical(m.value)}`;
            const existing = markersByKey.get(key);
            if (!existing) {
              markersByKey.set(key, m);
            } else {
              // Keep the version with the more descriptive name
              // ("Haemoglobin (Hb)" > "Hb") and richer explanation.
              if (m.name.length > existing.name.length) existing.name = m.name;
              if ((m.explanation || "").length > (existing.explanation || "").length) {
                existing.explanation = m.explanation;
              }
              if (!existing.advice && m.advice) existing.advice = m.advice;
            }
          }
        }

        if (Array.isArray(pageData.urgent_attention)) {
          for (const u of pageData.urgent_attention) {
            if (u && !aggregated.urgent_attention!.includes(u)) {
              aggregated.urgent_attention!.push(u);
            }
          }
        }
      }
      void bestSummaryPage; // tracked for diagnostics if needed

      aggregated.markers = Array.from(markersByKey.values());

      if (failedCount > 0) {
        toast.warning(`${failedCount} page(s) couldn't be read. Results may be incomplete.`);
      }

      if (aggregated.markers.length === 0) {
        toast.error("Couldn't read any markers from the report. Try a clearer scan.");
        return;
      }

      // Step 3: sort markers by severity — critical first, normal last
      const severityRank: Record<string, number> = { critical: 0, high: 1, low: 2, normal: 3 };
      aggregated.markers.sort((a, b) => {
        const aRank = severityRank[a.status] ?? 4;
        const bRank = severityRank[b.status] ?? 4;
        return aRank - bRank;
      });

      // Step 4: generate overall summary from sorted markers
      aggregated.summary = buildLocalSummary(aggregated.markers);

      setInsights(aggregated);
      if (aggregated.patient_name) autoSelectMemberFromReport(aggregated.patient_name);

      const abnormal = aggregated.markers.filter((m) => m.status !== "normal").length;
      if (abnormal > 0) toast.warning(`${abnormal} marker(s) need attention`);
      else toast.success(`All ${aggregated.markers.length} markers look normal!`);
    } catch (err) {
      console.error("PDF analysis failed:", err);
      toast.error("Failed to analyze PDF. Please try again.");
    } finally {
      setIsAnalyzing(false);
      setPageProgress({ current: 0, total: 0, stage: "" });
    }
  };

  const resetAll = () => {
    setPreviewUrl(null);
    setInsights(null);
    setImageBlob(null);
    setSelectedMemberId("");
    setSaved(false);
    setSaving(false);
  };

  return (
    <div>
      <AppHeader title={t("lab.title")} showBack />
      <div className="p-4 space-y-4">
        {/* Upload Section */}
        {!insights && !isAnalyzing && (
          <>
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="py-3">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    Upload your lab report and AI will explain every marker in simple language —
                    what&apos;s normal, what needs attention, and what to do next.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <CardContent className="flex flex-col items-center py-12">
                <div className="rounded-full bg-primary/10 p-6 mb-4">
                  <Upload className="h-10 w-10 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-1">{t("lab.upload")}</h3>
                <p className="text-sm text-muted-foreground text-center">
                  {t("lab.upload_desc")}
                </p>
              </CardContent>
            </Card>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleUpload}
              className="hidden"
            />
          </>
        )}

        {/* Loading with page-by-page progress */}
        {isAnalyzing && (
          <div className="flex flex-col items-center py-12 space-y-4">
            {previewUrl ? (
              <div className="w-24 h-32 rounded-xl overflow-hidden border shadow">
                <img src={previewUrl} alt="" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-24 h-32 rounded-xl border shadow flex items-center justify-center bg-muted">
                <FileText className="h-10 w-10 text-muted-foreground" />
              </div>
            )}
            <Loader2 className="h-8 w-8 animate-spin text-primary" />

            {pageProgress.total > 0 ? (
              <>
                <p className="text-sm font-medium">
                  {pageProgress.stage === "rendering"
                    ? `Preparing page ${pageProgress.current} of ${pageProgress.total}`
                    : `Reading page ${pageProgress.current} of ${pageProgress.total}`}
                </p>
                {/* Progress bar */}
                <div className="w-full max-w-xs h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{
                      width: `${Math.round((pageProgress.current / pageProgress.total) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {pageProgress.stage === "rendering"
                    ? "Converting PDF to readable images..."
                    : "Extracting every marker. This preserves accuracy."}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">{t("lab.analyzing")}</p>
                <p className="text-xs text-muted-foreground">Reading markers and checking ranges</p>
              </>
            )}
          </div>
        )}

        {/* Results */}
        {insights && (
          <>
            {/* Report Header */}
            <Card>
              <CardContent className="py-3">
                <div className="flex items-start gap-3">
                  {previewUrl && (
                    <div className="w-12 h-16 rounded-lg overflow-hidden border shrink-0">
                      <img src={previewUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold">Lab Report Analysis</h3>
                    </div>
                    {insights.patient_name && (
                      <p className="text-sm text-muted-foreground">Patient: {insights.patient_name}</p>
                    )}
                    {insights.lab_name && (
                      <p className="text-xs text-muted-foreground">{insights.lab_name}</p>
                    )}
                    {insights.report_date && (
                      <p className="text-xs text-muted-foreground">Date: {insights.report_date}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Doctor's Note — AI-generated warm explanation, the headline
                a patient reads first. Renders above urgent-attention so it
                sets the tone before any red banner. */}
            {insights.patient_summary && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold text-primary">
                      Doctor&apos;s Note
                    </p>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-line">
                    {insights.patient_summary}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Urgent Attention */}
            {insights.urgent_attention && insights.urgent_attention.length > 0 && (
              <Card className="border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950">
                <CardContent className="py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldAlert className="h-4 w-4 text-red-600" />
                    <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                      {t("lab.urgent")}
                    </p>
                  </div>
                  {insights.urgent_attention.map((item, i) => (
                    <p key={i} className="text-sm text-red-600 dark:text-red-400">• {item}</p>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* One-line headline summary — kept as a quick stat strip below
                the Doctor's Note. Hidden if patient_summary exists to avoid
                redundancy. */}
            {insights.summary && !insights.patient_summary && (
              <Card className="bg-muted/50">
                <CardContent className="py-3">
                  <p className="text-sm">{insights.summary}</p>
                </CardContent>
              </Card>
            )}

            {/* Quick Stats */}
            {insights.markers.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {["normal", "low", "high", "critical"].map((status) => {
                  const count = insights.markers.filter((m) => m.status === status).length;
                  const config = statusColors[status as keyof typeof statusColors];
                  const Icon = config.icon;
                  return (
                    <div key={status} className={`rounded-lg p-2 text-center ${config.color}`}>
                      <Icon className="h-4 w-4 mx-auto mb-0.5" />
                      <p className="text-lg font-bold">{count}</p>
                      <p className="text-[10px]">{t(config.labelKey)}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Markers List — sorted by severity (critical/high first, normal last) */}
            <div className="space-y-2">
              {[...insights.markers].sort((a, b) => {
                const rank: Record<string, number> = { critical: 0, high: 1, low: 2, normal: 3 };
                return (rank[a.status] ?? 4) - (rank[b.status] ?? 4);
              }).map((marker, i) => {
                const config = statusColors[marker.status] || statusColors.normal;
                const Icon = config.icon;
                return (
                  <Card key={i}>
                    <CardContent className="py-3">
                      <div className="flex items-start justify-between mb-1.5">
                        <h4 className="text-sm font-semibold">{marker.name}</h4>
                        <Badge className={`${config.color} text-[10px] gap-1`}>
                          <Icon className="h-3 w-3" />
                          {t(config.labelKey)}
                        </Badge>
                      </div>
                      <div className="flex items-baseline gap-2 mb-1.5">
                        <span className="text-lg font-bold">{marker.value}</span>
                        <span className="text-xs text-muted-foreground">
                          ({t("lab.normal_range")}: {marker.normal_range})
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">{marker.explanation}</p>
                      {marker.status !== "normal" && marker.advice && (
                        <p className="text-xs bg-muted p-1.5 rounded">
                          💡 {marker.advice}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* ─── Save to Family Member ─────────────────────────── */}
            {!saved ? (
              <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30">
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Save className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                      Save this report
                    </span>
                  </div>

                  <Select value={selectedMemberId} onValueChange={(v) => setSelectedMemberId(v || "")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select family member" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    className="w-full"
                    disabled={!selectedMemberId || saving}
                    onClick={async () => {
                      if (!selectedMemberId || !insights) return;
                      setSaving(true);
                      try {
                        const { db } = await import("@/lib/db/dexie");

                        // ── Duplicate detection ──
                        // Check if a lab report with same date + lab name already exists for this member
                        const reportDate = insights.report_date || new Date().toISOString().split("T")[0];
                        const existingRecords = await db.records
                          .where("member_id")
                          .equals(selectedMemberId)
                          .filter((r) =>
                            !r.is_deleted &&
                            r.type === "lab_report" &&
                            r.visit_date === reportDate &&
                            (r.hospital_name || "").toLowerCase() === (insights.lab_name || "").toLowerCase()
                          )
                          .toArray();

                        if (existingRecords.length > 0) {
                          toast.error("This lab report is already saved (same date and lab). Skipping duplicate.");
                          setSaving(false);
                          return;
                        }

                        const title = insights.lab_name
                          ? `${insights.lab_name} - Lab Report`
                          : `Lab Report - ${reportDate}`;

                        const abnormalMarkers = insights.markers
                          .filter((m) => m.status !== "normal")
                          .map((m) => `${m.name}: ${m.value} (${m.status})`)
                          .join(", ");

                        // Save full AI analysis as JSON in notes so it can be displayed later
                        const fullAnalysis = JSON.stringify({
                          _type: "lab_analysis_v1",
                          markers: insights.markers,
                          summary: insights.summary,
                          urgent_attention: insights.urgent_attention,
                          patient_name: insights.patient_name,
                          lab_name: insights.lab_name,
                          report_date: insights.report_date,
                        });

                        const images = imageBlob
                          ? [new File([imageBlob], "lab-report.jpg", { type: imageBlob.type || "image/jpeg" })]
                          : undefined;

                        const recordId = await addRecord(
                          {
                            member_id: selectedMemberId,
                            type: "lab_report",
                            title,
                            doctor_name: "",
                            hospital_name: insights.lab_name || "",
                            visit_date: reportDate,
                            diagnosis: abnormalMarkers || "All markers normal",
                            notes: fullAnalysis,
                            tags: ["lab", "ai-analyzed"],
                          },
                          images
                        );

                        // Auto-extract vitals from lab markers and save to healthMetrics
                        const savedVitals = await autoSaveVitalsFromMarkers(
                          insights.markers,
                          selectedMemberId,
                          reportDate,
                          addMetric
                        );

                        setSaved(true);
                        const memberName = members.find((m) => m.id === selectedMemberId)?.name || "member";
                        const vitalsMsg = savedVitals.length > 0
                          ? ` + ${savedVitals.join(", ")} added to Vitals`
                          : "";
                        toast.success(`Lab report saved for ${memberName}${vitalsMsg}`, {
                          action: {
                            label: "View",
                            onClick: () => router.push(`/records/${recordId}`),
                          },
                        });
                      } catch (err) {
                        console.error("Save failed:", err);
                        toast.error("Failed to save report. Try again.");
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    {saving ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
                    ) : (
                      <><Save className="h-4 w-4 mr-2" />Save to Records</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/30">
                <CardContent className="py-4">
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-semibold text-green-800 dark:text-green-300">
                      Report saved to {members.find((m) => m.id === selectedMemberId)?.name || "member"}'s records
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <Button variant="outline" className="w-full" onClick={resetAll}>
              Analyze Another Report
            </Button>

            <p className="text-[10px] text-center text-muted-foreground px-4">
              AI-generated analysis for reference only. Always consult your doctor for medical decisions.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// Build a simple summary from aggregated markers (no extra AI call)
function buildLocalSummary(markers: LabMarker[]): string {
  const abnormal = markers.filter((m) => m.status !== "normal");
  if (abnormal.length === 0) {
    return `All ${markers.length} markers are within normal ranges. Your report looks healthy overall.`;
  }
  const critical = abnormal.filter((m) => m.status === "critical");
  const high = abnormal.filter((m) => m.status === "high");
  const low = abnormal.filter((m) => m.status === "low");

  const parts: string[] = [];
  if (critical.length > 0) {
    parts.push(`${critical.length} critical marker(s): ${critical.map((m) => m.name).join(", ")} — consult a doctor immediately.`);
  }
  if (high.length > 0) {
    parts.push(`${high.length} high: ${high.slice(0, 4).map((m) => m.name).join(", ")}${high.length > 4 ? "..." : ""}.`);
  }
  if (low.length > 0) {
    parts.push(`${low.length} low: ${low.slice(0, 4).map((m) => m.name).join(", ")}${low.length > 4 ? "..." : ""}.`);
  }
  parts.push(`${markers.length - abnormal.length} of ${markers.length} markers are normal. Please review abnormal values with your doctor.`);
  return parts.join(" ");
}

function compressDataUrl(
  dataUrl: string,
  maxDimension: number,
  quality: number
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
