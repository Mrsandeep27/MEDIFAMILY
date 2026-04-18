"use client";

import { use, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Edit,
  Download,
  Share2,
  Search,
  Scan,
  FileText,
  Brain,
  ArrowUpRight,
  Trash2,
  Droplets,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/layout/app-header";
import { RecordCard } from "@/components/records/record-card";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { useMember, useMembers } from "@/hooks/use-members";
import { useRecords } from "@/hooks/use-records";
import { RELATION_LABELS, RECORD_TYPE_LABELS } from "@/constants/config";
import type { RecordType } from "@/lib/db/schema";
import { toast } from "sonner";
import { db } from "@/lib/db/dexie";
import { MemberAvatar } from "@/components/family/member-avatar";
import { cn } from "@/lib/utils";

// Plain-language chip labels (R1 elder-friendly spec).
const FILTER_PLAIN_LABELS: Record<RecordType, string> = {
  prescription: "Medicines",
  lab_report: "Blood tests",
  vaccination: "Vaccines",
  bill: "Bills",
  discharge_summary: "Hospital",
  other: "Other",
};

export default function MemberDetailPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = use(params);
  const router = useRouter();
  const { member, isLoading } = useMember(memberId);
  const { deleteMember } = useMembers();
  const { records, isLoading: recordsLoading, searchRecords } = useRecords(memberId);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [typeFilter, setTypeFilter] = useState<RecordType | "all">("all");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<typeof records | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback(
    (query: string) => {
      setSearch(query);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (query.trim().length > 1) {
        debounceRef.current = setTimeout(async () => {
          setSearchResults(await searchRecords(query));
        }, 300);
      } else {
        setSearchResults(null);
      }
    },
    [searchRecords]
  );

  const filteredRecords = (searchResults || records || []).filter(
    (r) => typeFilter === "all" || r.type === typeFilter
  );
  const recordCount = (records || []).length;
  const latestRecord = (records || [])[0];

  const handleDownloadReport = async () => {
    if (!member) return;
    try {
      const [memberRecords, medicines] = await Promise.all([
        db.records.filter((r) => r.member_id === memberId && !r.is_deleted).toArray(),
        db.medicines.filter((m) => m.member_id === memberId && !m.is_deleted).toArray(),
      ]);
      const report = {
        exportedAt: new Date().toISOString(),
        member: {
          name: member.name,
          relation: member.relation,
          blood_group: member.blood_group,
          date_of_birth: member.date_of_birth,
          allergies: member.allergies,
          chronic_conditions: member.chronic_conditions,
        },
        records: memberRecords.map(({ local_image_blobs, ...rest }) => rest),
        medicines,
      };
      const blob = new Blob([JSON.stringify(report, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${member.name.replace(/\s+/g, "-")}-health-report-${
        new Date().toISOString().split("T")[0]
      }.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Report downloaded");
    } catch {
      toast.error("Failed to download report");
    }
  };

  if (isLoading) {
    return (
      <div>
        <AppHeader title="Loading..." showBack />
        <LoadingSpinner className="py-12" />
      </div>
    );
  }
  if (!member) {
    return (
      <div>
        <AppHeader title="Not Found" showBack />
        <p className="text-center text-muted-foreground py-12">Member not found.</p>
      </div>
    );
  }

  const age = dobAge(member.date_of_birth);
  const role = RELATION_LABELS[member.relation] || member.relation;

  return (
    <div className="pb-28 bg-background">
      {/* Dark member header — R1 spec */}
      <div
        className="text-white rounded-b-[28px] overflow-hidden px-4 pt-4 pb-5"
        style={{
          background:
            "radial-gradient(ellipse at top right, rgba(232,168,160,0.12) 0%, transparent 55%), radial-gradient(ellipse at bottom left, rgba(144,188,232,0.08) 0%, transparent 50%), linear-gradient(180deg, #0F0F11 0%, #17171A 100%)",
        }}
      >
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            aria-label="Back"
            className="h-9 w-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center active:scale-95 transition-transform"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">
            FAMILY · RECORDS
          </p>
          <Link href={`/family/${memberId}/edit`} aria-label="Edit">
            <button className="h-9 w-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center active:scale-95 transition-transform">
              <Edit className="h-4 w-4" />
            </button>
          </Link>
        </div>

        {/* Member identity row */}
        <div className="flex items-center gap-3 mt-5">
          <div className="shrink-0">
            <MemberAvatar
              name={member.name}
              avatarUrl={member.avatar_url}
              size="lg"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-[26px] font-bold tracking-tight leading-none truncate">
              {member.name.split(" ")[0]}
            </h1>
            <p className="text-[12.5px] text-white/60 font-medium mt-1.5">
              {role}
              {age != null ? ` · Age ${age}` : ""}
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              {member.blood_group && (
                <div className="inline-flex items-center gap-1 bg-white/10 border border-white/10 rounded-full px-2.5 py-0.5">
                  <Droplets className="h-3 w-3 text-red-400" />
                  <span className="text-[10.5px] font-bold">{member.blood_group}</span>
                </div>
              )}
              {recordCount > 0 && (
                <div className="inline-flex items-center bg-white/10 border border-white/10 rounded-full px-2.5 py-0.5">
                  <span className="font-mono text-[10px] font-bold tracking-wider">
                    {recordCount} RECORDS
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick row: Download + Share */}
        <div className="flex gap-2 mt-5">
          <button
            onClick={handleDownloadReport}
            className="flex-1 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center gap-2 text-[12px] font-bold active:scale-[0.97] transition-transform"
          >
            <Download className="h-3.5 w-3.5" /> Download
          </button>
          <Link href={`/family/${memberId}/share`} className="flex-1">
            <button className="w-full h-10 rounded-full bg-white text-foreground flex items-center justify-center gap-2 text-[12px] font-bold shadow-sm active:scale-[0.97] transition-transform">
              <Share2 className="h-3.5 w-3.5" /> Share
            </button>
          </Link>
        </div>

        {/* Search — lives inside the dark header */}
        <div className="relative mt-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search records"
            className="w-full h-11 pl-10 pr-4 rounded-2xl bg-white/8 border border-white/10 text-[13px] font-medium text-white placeholder:text-white/45 focus:outline-none focus:ring-2 focus:ring-white/30"
          />
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* AI summary of latest record — R1 spec */}
        {latestRecord && !search && (
          <div className="rounded-2xl bg-[#ECE7F6]/50 border border-[#4A3B7A]/15 p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="h-6 w-6 rounded-lg bg-[#4A3B7A]/15 text-[#4A3B7A] flex items-center justify-center">
                <Brain className="h-3 w-3" />
              </div>
              <span className="font-mono text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-[#4A3B7A]">
                AI Summary · Latest
              </span>
            </div>
            <p className="text-[13px] font-medium text-foreground/85 leading-relaxed">
              <b className="font-bold">{latestRecord.title}</b>
              {latestRecord.doctor_name ? ` from Dr. ${latestRecord.doctor_name}` : ""}
              {latestRecord.visit_date
                ? ` on ${new Date(latestRecord.visit_date).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}`
                : ""}
              .
            </p>
            <Link
              href={`/records/${latestRecord.id}`}
              className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-bold text-[#4A3B7A]"
            >
              Read full record <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        )}

        {/* Filter chips — plain-language + counts */}
        {!recordsLoading && (records || []).length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar -mx-4 px-4">
            <R1Chip
              active={typeFilter === "all"}
              onClick={() => setTypeFilter("all")}
              label="All"
              count={(searchResults || records || []).length}
            />
            {(Object.keys(RECORD_TYPE_LABELS) as RecordType[]).map((value) => {
              const count = (searchResults || records || []).filter(
                (r) => r.type === value
              ).length;
              if (count === 0 && typeFilter !== value) return null;
              return (
                <R1Chip
                  key={value}
                  active={typeFilter === value}
                  onClick={() => setTypeFilter(value)}
                  label={FILTER_PLAIN_LABELS[value] || RECORD_TYPE_LABELS[value]}
                  count={count}
                />
              );
            })}
          </div>
        )}

        {/* Records list */}
        {recordsLoading ? (
          <LoadingSpinner className="py-12" />
        ) : filteredRecords.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border/60 py-14 text-center">
            <div className="h-16 w-16 rounded-3xl bg-muted/60 flex items-center justify-center mx-auto mb-4">
              <FileText className="h-8 w-8 text-muted-foreground/30" />
            </div>
            <p className="text-[15px] font-bold">
              {search ? `No results for "${search}"` : "No records yet"}
            </p>
            <p className="text-[12px] text-muted-foreground mt-1 max-w-[240px] mx-auto leading-relaxed">
              {search
                ? "Try a different search"
                : `Add ${member.name.split(" ")[0]}'s first record — take a photo of any test, prescription or doctor note.`}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredRecords.map((record) => (
              <RecordCard key={record.id} record={record} />
            ))}
          </div>
        )}

        {/* Delete (kept for non-self members) */}
        {member.relation !== "self" && (
          <div className="pt-8 pb-2">
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center justify-center gap-1.5 py-3 text-[11px] text-muted-foreground/50 hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete member
              </button>
            ) : (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 space-y-3">
                <p className="text-[13px] font-semibold text-destructive">
                  Delete {member.name}? All data will be permanently removed.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    className="flex-1 rounded-xl"
                    disabled={isDeleting}
                    onClick={async () => {
                      setIsDeleting(true);
                      try {
                        await deleteMember(memberId);
                        toast.success(`${member.name} deleted`);
                        router.replace("/family");
                      } catch (err) {
                        console.error("Delete failed:", err);
                        toast.error("Failed to delete member");
                        setIsDeleting(false);
                      }
                    }}
                  >
                    {isDeleting ? "Deleting..." : "Yes, Delete"}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scan FAB — primary R1 action */}
      <Link
        href={`/scan?memberId=${memberId}`}
        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 inline-flex items-center gap-2 h-12 px-5 rounded-full bg-foreground text-background text-[13px] font-extrabold tracking-tight shadow-[0_10px_24px_rgba(11,11,12,0.25)] active:scale-95 transition-transform"
      >
        <Scan className="h-[18px] w-[18px]" />
        Scan a document
      </Link>
    </div>
  );
}

function R1Chip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[12px] font-bold transition-colors",
        active
          ? "bg-foreground text-background"
          : "bg-muted/50 text-foreground/80 hover:bg-muted border border-border/40"
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "font-mono text-[10px] font-bold",
          active ? "text-background/70" : "text-muted-foreground"
        )}
      >
        {count}
      </span>
    </button>
  );
}

function dobAge(dob?: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}
