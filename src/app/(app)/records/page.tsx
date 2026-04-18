"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, FileText, Search, Scan } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/layout/app-header";
import { RecordCard } from "@/components/records/record-card";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { useRecords } from "@/hooks/use-records";
import { useMembers } from "@/hooks/use-members";
import { useFamilyStore } from "@/stores/family-store";
import { RECORD_TYPE_LABELS } from "@/constants/config";
import type { RecordType } from "@/lib/db/schema";
import { useLocale } from "@/lib/i18n/use-locale";
import { cn } from "@/lib/utils";

// Plain-language labels for filter chips (R1 elder-friendly design)
const FILTER_LABELS: Record<RecordType, string> = {
  prescription: "Medicines",
  lab_report: "Blood tests",
  vaccination: "Vaccines",
  bill: "Bills",
  discharge_summary: "Hospital",
  other: "Other",
};

export default function RecordsPage() {
  const router = useRouter();
  const { selectedMemberId } = useFamilyStore();
  const { records, isLoading, searchRecords } = useRecords(selectedMemberId || undefined);
  const { members } = useMembers();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<RecordType | "all">("all");
  const [searchResults, setSearchResults] = useState<typeof records | null>(null);
  const { t } = useLocale();

  const memberMap = Object.fromEntries(members.map((m) => [m.id, m.name]));

  const filteredRecords = (searchResults || records).filter(
    (r) => typeFilter === "all" || r.type === typeFilter
  );

  // Per-type counts for chip labels
  const counts = (searchResults || records).reduce<Record<string, number>>(
    (acc, r) => {
      acc[r.type] = (acc[r.type] || 0) + 1;
      return acc;
    },
    {}
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback(
    (query: string) => {
      setSearch(query);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (query.trim().length > 1) {
        debounceRef.current = setTimeout(async () => {
          const results = await searchRecords(query);
          setSearchResults(results);
        }, 300);
      } else {
        setSearchResults(null);
      }
    },
    [searchRecords]
  );

  return (
    <div className="pb-28">
      <AppHeader
        title={t("records.title")}
        rightAction={
          <Link href="/records/add">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              {t("common.add")}
            </Button>
          </Link>
        }
      />

      <div className="p-4 space-y-4">
        {/* Big, calm search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={t("records.search")}
            className="w-full h-12 rounded-2xl bg-muted/50 border border-border/40 pl-10 pr-3 text-[14px] font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-card"
          />
        </div>

        {/* Filter chips — plain-language labels + counts */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar -mx-4 px-4">
          <FilterChip
            active={typeFilter === "all"}
            onClick={() => setTypeFilter("all")}
            label={t("common.all")}
            count={(searchResults || records).length}
          />
          {(Object.keys(RECORD_TYPE_LABELS) as RecordType[]).map((value) => {
            const count = counts[value] || 0;
            if (count === 0 && typeFilter !== value) return null;
            return (
              <FilterChip
                key={value}
                active={typeFilter === value}
                onClick={() => setTypeFilter(value)}
                label={FILTER_LABELS[value] || RECORD_TYPE_LABELS[value]}
                count={count}
              />
            );
          })}
        </div>

        {/* Records list */}
        {isLoading ? (
          <LoadingSpinner className="py-12" />
        ) : filteredRecords.length === 0 ? (
          search ? (
            <EmptyState
              icon={Search}
              title={t("records.no_results")}
              description={`${t("records.no_results_desc")} "${search}"`}
            />
          ) : (
            <div className="py-10 space-y-4 text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-lg">{t("records.no_records")}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("records.no_records_desc")}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
                <Button size="sm" onClick={() => router.push("/scan")}>
                  {t("records.scan_prescription")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => router.push("/records/add")}>
                  {t("records.add_manually")}
                </Button>
              </div>
            </div>
          )
        ) : (
          <div className="space-y-2.5">
            {filteredRecords.map((record) => (
              <RecordCard
                key={record.id}
                record={record}
                memberName={memberMap[record.member_id]}
              />
            ))}
          </div>
        )}
      </div>

      {/* Scan FAB — primary action pinned above bottom nav (R1 spec) */}
      {filteredRecords.length > 0 && (
        <Link
          href="/scan"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 inline-flex items-center gap-2 h-12 px-5 rounded-full bg-foreground text-background text-[13px] font-extrabold tracking-tight shadow-[0_10px_24px_rgba(11,11,12,0.25)] active:scale-95 transition-transform"
        >
          <Scan className="h-[18px] w-[18px]" />
          Scan a document
        </Link>
      )}
    </div>
  );
}

function FilterChip({
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
