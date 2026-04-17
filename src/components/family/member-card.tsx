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
  Droplets,
} from "lucide-react";
import { MemberAvatar } from "./member-avatar";
import { RELATION_LABELS } from "@/constants/config";
import type { Member, HealthRecord } from "@/lib/db/schema";

interface MemberCardProps {
  member: Member;
  latestRecord?: HealthRecord | null;
  recordCount?: number;
}

const RECORD_ICONS: Record<string, React.ElementType> = {
  prescription: FileText,
  lab_report: TestTube,
  vaccination: Syringe,
  bill: Receipt,
  discharge_summary: Hospital,
  other: File,
};

const RECORD_COLORS: Record<string, string> = {
  prescription: "text-blue-600 bg-blue-500/10",
  lab_report: "text-purple-600 bg-purple-500/10",
  vaccination: "text-green-600 bg-green-500/10",
  bill: "text-amber-600 bg-amber-500/10",
  discharge_summary: "text-red-600 bg-red-500/10",
  other: "text-slate-600 bg-slate-500/10",
};

const RECORD_LABELS: Record<string, string> = {
  prescription: "Prescription",
  lab_report: "Lab Report",
  vaccination: "Vaccination",
  bill: "Medical Bill",
  discharge_summary: "Discharge",
  other: "Record",
};

export function MemberCard({ member, latestRecord, recordCount = 0 }: MemberCardProps) {
  const lastDate = latestRecord?.visit_date
    ? new Date(latestRecord.visit_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : null;
  const RecordIcon = latestRecord ? (RECORD_ICONS[latestRecord.type] || File) : null;
  const recordColor = latestRecord ? (RECORD_COLORS[latestRecord.type] || RECORD_COLORS.other) : "";
  const recordLabel = latestRecord ? (RECORD_LABELS[latestRecord.type] || "Record") : "";

  return (
    <Link href={`/family/${member.id}`}>
      <div className="group bg-card rounded-2xl border border-border/40 p-4 active:scale-[0.98] transition-all hover:shadow-md">
        <div className="flex items-start gap-3.5">
          {/* Avatar */}
          <div className="relative shrink-0">
            <MemberAvatar name={member.name} avatarUrl={member.avatar_url} size="lg" />
            {/* Activity indicator — green if has records */}
            {recordCount > 0 && (
              <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-card" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-bold truncate">{member.name}</h3>
              {member.blood_group && (
                <span className="shrink-0 flex items-center gap-0.5 text-[10px] font-bold text-red-500">
                  <Droplets className="h-3 w-3" />
                  {member.blood_group}
                </span>
              )}
            </div>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {RELATION_LABELS[member.relation] || member.relation}
            </p>
          </div>

          {/* Right: record count */}
          <div className="flex items-center gap-1.5 shrink-0 pt-1">
            {recordCount > 0 && (
              <div className="text-right mr-1">
                <p className="text-lg font-extrabold leading-none">{recordCount}</p>
                <p className="text-[9px] text-muted-foreground font-medium mt-0.5">records</p>
              </div>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground/25 group-hover:text-muted-foreground/50 transition-colors" />
          </div>
        </div>

        {/* Latest record strip */}
        {latestRecord && RecordIcon && (
          <div className="mt-3 pt-3 border-t border-border/30 flex items-center gap-2">
            <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${recordColor}`}>
              <RecordIcon className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold truncate text-foreground/80">
                {latestRecord.title || recordLabel}
              </p>
            </div>
            {lastDate && (
              <span className="text-[10px] text-muted-foreground shrink-0">{lastDate}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
