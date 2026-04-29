"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronLeft,
  Upload,
  Download,
  AlertCircle,
  CheckCircle2,
  X,
  FileText,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const TEMPLATE_HEADERS = [
  "name",
  "dob",
  "room_no",
  "blood_group",
  "conditions",
  "contact_name",
  "contact_phone",
];

const TEMPLATE_CSV = [
  TEMPLATE_HEADERS.join(","),
  // Realistic example rows so the caretaker has format references for
  // each field — DOB in DD/MM/YYYY (Indian Excel default), conditions
  // semicolon-separated within the cell, phone without country code.
  `Sharma Devi,15/06/1948,101,O+,Diabetes;Hypertension,Rajesh Sharma,9876543210`,
  `Verma Ji,03/11/1952,102,B+,Heart;Mobility,Priya Verma,9123456789`,
].join("\n");

interface ParsedRow {
  data: Record<string, string>;
  rowIndex: number; // 0-based, excluding header
  warnings: string[];
}

interface RowError {
  rowIndex: number;
  field: string;
  message: string;
}

interface BulkResult {
  inserted: number;
  errors: RowError[];
  insertedIds: string[];
  capHit: boolean;
}

/**
 * CSV bulk upload — onboarding flow for a care home that already has a
 * register. Three stages:
 *   1. Pick file → parse client-side → preview table with warnings
 *   2. User reviews + confirms
 *   3. Server validates + inserts; we show inserted count + per-row errors
 *
 * The parse is local (instant feedback), validation runs again
 * server-side (the source of truth).
 */
export default function BulkResidentsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [stage, setStage] = useState<"idle" | "preview" | "result">("idle");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);

  const handleDownloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "residents_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-pick of same file
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length === 0) {
        toast.error("CSV is empty or unreadable");
        return;
      }
      if (parsed.length > 200) {
        toast.error("Max 200 rows per upload — split into smaller files");
        return;
      }
      setRows(parsed);
      setStage("preview");
    } catch (err) {
      console.error("CSV parse failed:", err);
      toast.error("Couldn't read this file. Make sure it's a valid CSV.");
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      const res = await fetch("/api/residents/bulk", {
        method: "POST",
        headers,
        body: JSON.stringify({ rows: rows.map((r) => r.data) }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error || "Upload failed");
        return;
      }
      setResult(body);
      setStage("result");

      if (body.inserted > 0) {
        toast.success(`${body.inserted} resident${body.inserted === 1 ? "" : "s"} added`);
      }
    } catch {
      toast.error("Network error — try again");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────

  if (stage === "result" && result) {
    return (
      <div className="min-h-[100vh] pb-24">
        <Header onBack={() => router.replace("/residents")} title="Upload result" />
        <div className="px-5 pt-4 space-y-4">
          <div
            className={cn(
              "rounded-2xl p-4",
              result.inserted > 0
                ? "bg-green-50 border border-green-200 dark:bg-green-950/40 dark:border-green-900"
                : "bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900"
            )}
          >
            <div className="flex items-center gap-2">
              {result.inserted > 0 ? (
                <CheckCircle2 className="h-5 w-5 text-green-700 dark:text-green-300" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-700 dark:text-amber-300" />
              )}
              <p className="text-[15px] font-extrabold">
                {result.inserted} added
                {result.errors.length > 0 && `, ${result.errors.length} skipped`}
              </p>
            </div>
            {result.capHit && (
              <p className="text-[12.5px] text-amber-800 dark:text-amber-300 mt-2">
                Member cap reached — some rows weren&apos;t added. Email
                support to bump your limit.
              </p>
            )}
          </div>

          {result.errors.length > 0 && (
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground px-1 mb-2">
                Skipped rows ({result.errors.length})
              </p>
              <div className="space-y-1.5">
                {result.errors.map((e, i) => (
                  <div
                    key={i}
                    className="rounded-lg bg-card border border-border/40 px-3 py-2 flex items-start gap-2"
                  >
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0 text-[12.5px]">
                      <span className="font-mono font-bold">Row {e.rowIndex + 2}</span>
                      <span className="text-muted-foreground"> · {e.field}: </span>
                      <span>{e.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => router.replace("/residents")}
            className="w-full h-12 rounded-xl bg-foreground text-background font-extrabold text-[14px] active:scale-[0.98]"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  if (stage === "preview") {
    const errCount = rows.reduce((n, r) => n + r.warnings.length, 0);
    return (
      <div className="min-h-[100vh] pb-32">
        <Header onBack={() => setStage("idle")} title="Preview" />
        <div className="px-3 pt-3 space-y-3">
          <div className="px-2 flex items-center justify-between">
            <p className="text-[12.5px] text-muted-foreground">
              <span className="font-bold text-foreground">{fileName}</span> ·{" "}
              {rows.length} row{rows.length === 1 ? "" : "s"}
              {errCount > 0 && ` · ${errCount} warning${errCount === 1 ? "" : "s"}`}
            </p>
            <button
              onClick={() => setStage("idle")}
              className="text-[12px] text-primary font-bold"
            >
              Pick another
            </button>
          </div>

          <div className="rounded-2xl border border-border/50 bg-card divide-y divide-border/40 overflow-hidden">
            {rows.slice(0, 50).map((r) => (
              <PreviewRow key={r.rowIndex} row={r} />
            ))}
            {rows.length > 50 && (
              <div className="px-3 py-2 text-[12px] text-muted-foreground text-center">
                ... and {rows.length - 50} more rows (will be uploaded too)
              </div>
            )}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-20 bg-background/95 backdrop-blur-sm border-t border-border/40 px-4 pt-3 pb-4">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={cn(
              "w-full h-[52px] rounded-2xl bg-foreground text-background inline-flex items-center justify-center gap-2 text-[14px] font-extrabold active:scale-[0.98] transition-transform",
              submitting && "opacity-60"
            )}
          >
            {submitting ? "Uploading..." : `Upload ${rows.length} resident${rows.length === 1 ? "" : "s"}`}
          </button>
          <p className="text-[10.5px] text-muted-foreground text-center mt-2">
            Server will skip any row with required-field errors.
          </p>
        </div>
      </div>
    );
  }

  // Idle / pick stage
  return (
    <div className="min-h-[100vh] pb-24">
      <Header onBack={() => router.back()} title="Bulk upload" />
      <div className="px-5 pt-4 space-y-5">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            CSV upload
          </p>
          <h1 className="text-[24px] font-bold tracking-tight leading-tight mt-1.5">
            Add many residents at once
          </h1>
          <p className="text-[13px] text-muted-foreground leading-relaxed mt-2">
            Download the template, fill in your residents, then upload it
            here. We&apos;ll show a preview before saving anything.
          </p>
        </div>

        <button
          onClick={handleDownloadTemplate}
          className="w-full rounded-2xl border border-border/50 bg-card px-4 py-3.5 flex items-center gap-3 active:scale-[0.99] transition-transform"
        >
          <div className="h-10 w-10 rounded-xl bg-foreground/8 flex items-center justify-center shrink-0">
            <Download className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[14px] font-extrabold">Download template</p>
            <p className="text-[11.5px] text-muted-foreground">
              residents_template.csv with sample rows
            </p>
          </div>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full rounded-2xl border-[1.5px] border-dashed border-border bg-card px-4 py-8 flex flex-col items-center gap-2 active:scale-[0.99] transition-transform"
        >
          <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Upload className="h-5 w-5" />
          </div>
          <p className="text-[15px] font-extrabold">Tap to upload CSV</p>
          <p className="text-[11.5px] text-muted-foreground">
            Max 200 rows per upload
          </p>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFile}
        />

        <div className="rounded-2xl bg-muted/40 border border-border/40 px-4 py-3.5 space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[12px] font-bold">Required columns</p>
          </div>
          <p className="text-[11.5px] text-muted-foreground leading-relaxed">
            <b>name</b> and <b>room_no</b> are required. Everything else
            optional. Conditions can be semicolon-separated within a cell
            (e.g. &quot;Diabetes;Heart&quot;). Date of birth accepts
            YYYY-MM-DD or DD/MM/YYYY.
          </p>
        </div>
      </div>
    </div>
  );
}

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-sm flex items-center justify-between px-4 py-3 border-b border-transparent">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="h-9 w-9 rounded-full bg-muted/60 flex items-center justify-center active:scale-95"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <p className="text-[13px] font-bold">{title}</p>
      <span className="h-9 w-9" aria-hidden="true" />
    </div>
  );
}

function PreviewRow({ row }: { row: ParsedRow }) {
  const hasWarning = row.warnings.length > 0;
  return (
    <div className="px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-extrabold tracking-tight truncate">
            {row.data.name || <span className="text-red-600">— missing name —</span>}
          </p>
          <p className="text-[11.5px] text-muted-foreground">
            Room <b className="text-foreground">{row.data.room_no || "—"}</b>
            {row.data.dob && ` · ${row.data.dob}`}
            {row.data.blood_group && ` · ${row.data.blood_group}`}
          </p>
        </div>
        {hasWarning ? (
          <div className="flex items-center gap-1 text-[10.5px] text-amber-700 dark:text-amber-400 font-bold">
            <AlertCircle className="h-3 w-3" />
            {row.warnings.length}
          </div>
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
        )}
      </div>
      {hasWarning && (
        <ul className="mt-1 ml-1 space-y-0.5">
          {row.warnings.map((w, i) => (
            <li
              key={i}
              className="flex items-center gap-1 text-[11px] text-amber-800/80 dark:text-amber-300/80"
            >
              <X className="h-2.5 w-2.5 shrink-0" />
              {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Minimal CSV parser ──────────────────────────────────────────────────
// Handles quoted cells, escaped quotes ("" inside quoted), CRLF and LF.
// Doesn't handle multi-line cells (rare in the resident-list use case).

function parseCsv(text: string): ParsedRow[] {
  const lines = text
    .replace(/^\uFEFF/, "") // strip BOM
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const data: Record<string, string> = {};
    headers.forEach((h, j) => {
      data[h] = (cells[j] || "").trim();
    });

    // Lightweight client-side warnings (the server validates again)
    const warnings: string[] = [];
    if (!data.name) warnings.push("Missing name");
    if (!data.room_no) warnings.push("Missing room number");
    if (data.dob && !/^\d{4}-\d{2}-\d{2}$/.test(data.dob) && !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(data.dob)) {
      warnings.push(`Date format: "${data.dob}"`);
    }
    if (data.contact_phone && !/^[6-9]\d{9}$/.test(data.contact_phone.replace(/\D/g, ""))) {
      warnings.push("Phone must be 10-digit Indian mobile");
    }
    rows.push({ data, rowIndex: i - 1, warnings });
  }
  return rows;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
  }
  out.push(cur);
  return out;
}
