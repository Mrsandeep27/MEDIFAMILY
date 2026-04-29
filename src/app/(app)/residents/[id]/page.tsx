"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ChevronLeft,
  Phone,
  Pill,
  AlertCircle,
  Share2,
  Plus,
} from "lucide-react";
import { db } from "@/lib/db/dexie";
import { useMember } from "@/hooks/use-members";
import { useIncidents } from "@/hooks/use-incidents";
import { LoadingSpinner } from "@/components/common/loading-spinner";

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

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

const INCIDENT_LABELS: Record<string, string> = {
  fall: "Fall",
  illness: "Illness",
  hospital: "Hospital",
  other: "Other",
};

const INCIDENT_COLORS: Record<string, string> = {
  fall: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  illness: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  hospital: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  other: "bg-muted text-foreground",
};

/**
 * Resident profile — the page a caretaker opens to see everything about
 * one resident: who, what meds, recent dose log, incident timeline, share
 * link with family. Composes existing hooks; keeps custom UI minimal.
 */
export default function ResidentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { member: resident, isLoading } = useMember(id);
  const { incidents } = useIncidents(id);

  // Active medicines for this resident
  const medicines = useLiveQuery(
    () =>
      db.medicines
        .where("member_id")
        .equals(id)
        .filter((m) => !m.is_deleted && m.is_active)
        .toArray(),
    [id]
  );

  // Today's dose log for this resident
  const todayLogs = useLiveQuery(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const reminders = await db.reminders
      .where("member_id")
      .equals(id)
      .toArray();
    const ridSet = new Set(reminders.map((r) => r.id));
    const reminderById = new Map(reminders.map((r) => [r.id, r] as const));
    const all = await db.reminderLogs.toArray();
    return all
      .filter((l) => ridSet.has(l.reminder_id) && l.scheduled_at.startsWith(today))
      .map((l) => ({
        log: l,
        medName: reminderById.get(l.reminder_id)?.medicine_name || "Medicine",
      }))
      .sort((a, b) => b.log.created_at.localeCompare(a.log.created_at));
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-[100vh] pb-24">
        <LoadingSpinner className="py-16" />
      </div>
    );
  }

  if (!resident) {
    return (
      <div className="min-h-[100vh] pb-24 px-5 pt-6 text-center space-y-3">
        <p className="text-[15px] font-bold">Resident not found</p>
        <Link href="/residents" className="text-primary text-[13px]">
          Back to list
        </Link>
      </div>
    );
  }

  const age = ageFrom(resident.date_of_birth);

  return (
    <div className="min-h-[100vh] pb-24">
      {/* Header */}
      <div className="bg-foreground text-background px-5 pt-4 pb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Back"
            className="h-9 w-9 rounded-full bg-background/10 flex items-center justify-center active:scale-95"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <Link
            href={`/residents/${id}/share`}
            className="inline-flex items-center gap-1.5 rounded-full bg-background/10 px-3 py-1.5 text-[12px] font-bold active:scale-[0.97]"
          >
            <Share2 className="h-3 w-3" />
            Share
          </Link>
        </div>

        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-background/60">
          Room {resident.room_no || "—"}
        </p>
        <h1 className="text-[28px] font-extrabold tracking-tight mt-1.5">
          {resident.name}
        </h1>
        <div className="flex items-center gap-3 mt-2 text-[12.5px] text-background/80">
          {age != null && <span>{age} yr</span>}
          {resident.blood_group && (
            <span className="font-bold">{resident.blood_group}</span>
          )}
          {resident.admission_date && (
            <span>
              Admitted{" "}
              {new Date(resident.admission_date).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          )}
        </div>

        {(resident.chronic_conditions || []).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {resident.chronic_conditions.map((c) => (
              <span
                key={c}
                className="text-[10.5px] font-bold rounded-md bg-background/15 px-2 py-1"
              >
                {c}
              </span>
            ))}
          </div>
        )}

        {/* Next of kin call */}
        {resident.emergency_contact_phone && (
          <a
            href={`tel:${resident.emergency_contact_phone}`}
            className="inline-flex items-center gap-2 mt-4 rounded-full bg-background text-foreground px-3.5 py-1.5 text-[12px] font-extrabold active:scale-[0.97]"
          >
            <Phone className="h-3 w-3" />
            Call {resident.emergency_contact_name || "next of kin"}
          </a>
        )}
      </div>

      <div className="px-4 pt-4 space-y-5">
        {/* Active meds */}
        <Section title="Active medicines" count={medicines?.length || 0}>
          {(medicines || []).length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground py-2">
              No medicines added.{" "}
              <Link
                href={`/scan?memberId=${id}`}
                className="text-primary font-semibold"
              >
                Scan a prescription
              </Link>{" "}
              or{" "}
              <Link
                href={`/reminders`}
                className="text-primary font-semibold"
              >
                add manually
              </Link>
              .
            </p>
          ) : (
            <div className="space-y-2">
              {(medicines || []).map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-xl bg-card border border-border/40 px-3 py-2.5"
                >
                  <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Pill className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold truncate">{m.name}</p>
                    <p className="text-[11.5px] text-muted-foreground truncate">
                      {[m.dosage, m.frequency, m.before_food && "Before food"]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Today's dose log */}
        <Section title="Today's doses" count={todayLogs?.length || 0}>
          {(todayLogs || []).length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground py-2">
              No doses logged today yet.
            </p>
          ) : (
            <div className="space-y-1.5">
              {(todayLogs || []).slice(0, 8).map(({ log, medName }) => (
                <div
                  key={log.id}
                  className="flex items-center gap-2 text-[12.5px]"
                >
                  <span
                    className={
                      log.status === "taken"
                        ? "h-2 w-2 rounded-full bg-green-600"
                        : log.status === "missed"
                          ? "h-2 w-2 rounded-full bg-red-500"
                          : "h-2 w-2 rounded-full bg-amber-500"
                    }
                  />
                  <span className="font-semibold flex-1 truncate">{medName}</span>
                  <span className="text-muted-foreground capitalize text-[11.5px]">
                    {log.status}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {new Date(log.acted_at || log.created_at).toLocaleTimeString(
                      "en-IN",
                      { hour: "numeric", minute: "2-digit", hour12: true }
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Incidents timeline */}
        <Section
          title="Incidents"
          count={incidents.length}
          action={
            <Link
              href={`/incidents/${id}/new`}
              className="inline-flex items-center gap-1 text-[12px] font-bold text-primary"
            >
              <Plus className="h-3 w-3" />
              Report
            </Link>
          }
        >
          {incidents.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground py-2">
              No incidents reported.
            </p>
          ) : (
            <div className="space-y-2">
              {incidents.map((inc) => (
                <div
                  key={inc.id}
                  className="rounded-xl border border-border/40 bg-card px-3 py-2.5"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                    <span
                      className={`text-[10px] font-extrabold uppercase tracking-wider rounded-md px-1.5 py-0.5 ${INCIDENT_COLORS[inc.type]}`}
                    >
                      {INCIDENT_LABELS[inc.type]}
                    </span>
                    <span className="text-[11px] text-muted-foreground ml-auto">
                      {formatDateTime(inc.occurred_at)}
                    </span>
                  </div>
                  <p className="text-[13px] leading-relaxed">{inc.notes}</p>
                  {inc.action_taken && (
                    <p className="text-[12px] text-muted-foreground mt-1">
                      <b className="text-foreground/80">Action:</b>{" "}
                      {inc.action_taken}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {title}
          {typeof count === "number" && (
            <span className="text-foreground/60 ml-1">· {count}</span>
          )}
        </p>
        {action}
      </div>
      {children}
    </div>
  );
}
