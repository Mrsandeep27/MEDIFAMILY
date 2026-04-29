"use client";

import Link from "next/link";
import { Plus, ChevronRight, Building2, Play, Upload } from "lucide-react";
import { useResidents } from "@/hooks/use-residents";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { EmptyState } from "@/components/common/empty-state";

function ageFrom(dob?: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

/**
 * Residents list — care-home equivalent of /family. Sorted by room number
 * via the useResidents hook; conditions surface inline so the caretaker
 * scanning the list sees who needs attention without opening profiles.
 */
export default function ResidentsPage() {
  const { residents, isLoading } = useResidents();

  if (isLoading) {
    return (
      <div className="min-h-[100vh]">
        <div className="px-4 pt-6">
          <h1 className="text-[24px] font-bold tracking-tight">Residents</h1>
        </div>
        <LoadingSpinner className="py-16" />
      </div>
    );
  }

  return (
    <div className="min-h-[100vh] pb-24">
      {/* Header */}
      <div className="bg-foreground text-background px-5 pt-7 pb-6">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-background/60">
          Care Home
        </p>
        <h1 className="text-[28px] font-bold tracking-tight mt-1.5">
          Residents
        </h1>
        <div className="flex items-center gap-2 mt-3">
          <div className="rounded-full bg-background/10 px-3 py-1 text-[12px] font-bold">
            {residents.length} active
          </div>
          {residents.length > 0 && (
            <Link
              href="/round"
              className="inline-flex items-center gap-1.5 rounded-full bg-background text-foreground px-3.5 py-1 text-[12px] font-extrabold active:scale-[0.97] transition-transform"
            >
              <Play className="h-3 w-3" />
              Start Round
            </Link>
          )}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-2">
        {residents.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No residents yet"
            description="Add your first resident to get started. You can always edit details later."
          />
        ) : (
          <>
            <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground px-0.5 pt-2 pb-1">
              By room
            </p>
            {residents.map((r) => {
              const age = ageFrom(r.date_of_birth);
              return (
                <Link
                  key={r.id}
                  href={`/residents/${r.id}`}
                  className="flex items-center gap-3 rounded-2xl bg-card border border-border/50 px-3.5 py-3 active:scale-[0.99] transition-transform"
                >
                  <div className="h-12 w-12 rounded-xl bg-foreground/8 text-foreground/80 flex items-center justify-center shrink-0 font-mono font-extrabold text-[13px]">
                    {r.room_no || "—"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-extrabold tracking-tight truncate">
                      {r.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {age != null && (
                        <span className="text-[11px] text-muted-foreground font-medium">
                          {age} yr
                        </span>
                      )}
                      {r.blood_group && (
                        <span className="text-[10px] font-bold text-red-700/80 dark:text-red-400">
                          {r.blood_group}
                        </span>
                      )}
                      {(r.chronic_conditions || []).slice(0, 2).map((c) => (
                        <span
                          key={c}
                          className="text-[10px] font-semibold rounded-md bg-muted/60 px-1.5 py-0.5"
                        >
                          {c}
                        </span>
                      ))}
                      {(r.chronic_conditions || []).length > 2 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{(r.chronic_conditions || []).length - 2}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              );
            })}
          </>
        )}

        {/* Add resident — single + bulk options. Single is the primary
            action (centred + filled); bulk surfaces below as the secondary
            path for care homes onboarding from a register. */}
        <Link
          href="/residents/add"
          className="flex items-center gap-3 rounded-2xl bg-card border-[1.5px] border-dashed border-[#C7C7C0] px-3.5 py-3 active:scale-[0.99] transition-transform mt-3"
        >
          <div className="h-10 w-10 rounded-xl bg-foreground text-background flex items-center justify-center shrink-0">
            <Plus className="h-[18px] w-[18px]" strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-extrabold tracking-tight">
              Add resident
            </p>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mt-0.5">
              Name + room — 30 seconds
            </p>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        </Link>

        <Link
          href="/residents/bulk"
          className="flex items-center gap-3 rounded-2xl bg-card border border-border/40 px-3.5 py-2.5 active:scale-[0.99] transition-transform"
        >
          <div className="h-9 w-9 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
            <Upload className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold tracking-tight">
              Bulk upload CSV
            </p>
            <p className="text-[10.5px] text-muted-foreground">
              For onboarding from an existing register
            </p>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        </Link>
      </div>
    </div>
  );
}
