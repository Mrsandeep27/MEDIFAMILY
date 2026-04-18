"use client";

import Link from "next/link";
import {
  ChevronRight,
  FileText,
  TestTube,
  Syringe,
  Receipt,
  Hospital,
  File,
  ImageIcon,
} from "lucide-react";
import type { HealthRecord, RecordType } from "@/lib/db/schema";

// Plain-language type words (designed for elder readability per R1 spec)
const TYPE_WORDS: Record<RecordType, string> = {
  prescription: "Medicine",
  lab_report: "Blood test",
  vaccination: "Vaccine",
  bill: "Medical bill",
  discharge_summary: "Hospital stay",
  other: "Record",
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  prescription: FileText,
  lab_report: TestTube,
  vaccination: Syringe,
  bill: Receipt,
  discharge_summary: Hospital,
  other: File,
};

// Soft pastel tints — match the R1 design tokens (--sky / --mint / --peach etc)
const TYPE_TINT: Record<string, { bg: string; fg: string }> = {
  prescription: { bg: "bg-[#FBE7DE]", fg: "text-[#9A3E1A]" },
  lab_report: { bg: "bg-[#E4EEF9]", fg: "text-[#1E4E86]" },
  vaccination: { bg: "bg-[#F6EDD0]", fg: "text-[#7A5B10]" },
  bill: { bg: "bg-[#F6E2E5]", fg: "text-[#8C2A34]" },
  discharge_summary: { bg: "bg-[#ECE7F6]", fg: "text-[#4A3B7A]" },
  other: { bg: "bg-muted", fg: "text-foreground/70" },
};

interface RecordCardProps {
  record: HealthRecord;
  memberName?: string;
}

export function RecordCard({ record, memberName }: RecordCardProps) {
  const Icon = TYPE_ICONS[record.type] || File;
  const tint = TYPE_TINT[record.type] || TYPE_TINT.other;
  const word = TYPE_WORDS[record.type] || "Record";
  const when = record.visit_date ? relativeDate(record.visit_date) : null;
  const sub = record.doctor_name
    ? `Dr. ${record.doctor_name}`
    : memberName
    ? memberName
    : null;

  return (
    <Link
      href={`/records/${record.id}`}
      className="block rounded-2xl bg-card border border-border/40 px-3.5 py-3 hover:bg-muted/30 transition-colors active:scale-[0.99]"
    >
      <div className="flex items-start gap-3">
        <div
          className={`h-11 w-11 shrink-0 rounded-xl ${tint.bg} ${tint.fg} flex items-center justify-center`}
        >
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {word.toUpperCase()}
            {when ? ` · ${when.toUpperCase()}` : ""}
          </p>
          <p className="text-[15px] font-extrabold tracking-tight leading-tight mt-0.5 truncate">
            {record.title}
          </p>
          {sub && (
            <p className="text-[11.5px] text-muted-foreground font-medium mt-0.5 truncate">
              {sub}
            </p>
          )}
          {record.image_urls.length > 0 && (
            <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
              <ImageIcon className="h-3 w-3" />
              {record.image_urls.length} image{record.image_urls.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0 mt-2" />
      </div>
    </Link>
  );
}

function relativeDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays < 0) {
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  }
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "1 week ago";
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 60) return "1 month ago";
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
