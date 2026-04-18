"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Plus,
  ChevronRight,
  Bell,
  Brain,
  ArrowUpRight,
  Pill,
  Calendar,
  TestTube,
  Shield,
} from "lucide-react";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { MemberAvatar } from "@/components/family/member-avatar";
import { useMembers } from "@/hooks/use-members";
import { useLocale } from "@/lib/i18n/use-locale";
import { db } from "@/lib/db/dexie";
import type { HealthRecord, Member } from "@/lib/db/schema";
import { RELATION_LABELS } from "@/constants/config";

type Alert = {
  id: string;
  kind: "missed" | "appt" | "lab";
  who: string;
  time: string;
  copy: string;
};

export default function FamilyPage() {
  const { members, isLoading } = useMembers();
  const { t } = useLocale();

  const allRecords = useLiveQuery(
    () => db.records.filter((r) => !r.is_deleted).toArray(),
    []
  );
  const allMedicines = useLiveQuery(
    () => db.medicines.filter((m) => !m.is_deleted && m.is_active).toArray(),
    []
  );
  const allReminders = useLiveQuery(
    () => db.reminders.filter((r) => !r.is_deleted && r.is_active).toArray(),
    []
  );
  const recentLogs = useLiveQuery(async () => {
    const cutoff = Date.now() - 1000 * 60 * 60 * 24;
    const logs = await db.reminderLogs
      .filter((l) => !l.is_deleted && new Date(l.scheduled_at).getTime() >= cutoff)
      .toArray();
    return logs;
  }, []);

  // Per-member aggregate stats
  const memberStats = useMemo(() => {
    const map: Record<
      string,
      { records: number; meds: number; appts: number; latest: HealthRecord | null; attention: boolean }
    > = {};
    for (const m of members) {
      map[m.id] = { records: 0, meds: 0, appts: 0, latest: null, attention: false };
    }
    for (const r of allRecords ?? []) {
      if (!map[r.member_id]) continue;
      map[r.member_id].records++;
      const current = map[r.member_id].latest;
      if (!current || (r.visit_date || r.created_at) > (current.visit_date || current.created_at)) {
        map[r.member_id].latest = r;
      }
    }
    for (const med of allMedicines ?? []) {
      if (map[med.member_id]) map[med.member_id].meds++;
    }
    // Appointments from localStorage (same source as home)
    if (typeof window !== "undefined") {
      try {
        const keys = Object.keys(localStorage).filter((k) =>
          k.startsWith("medifamily_appointments_")
        );
        const today = new Date().toISOString().split("T")[0];
        for (const k of keys) {
          const raw = localStorage.getItem(k);
          if (!raw) continue;
          const list = JSON.parse(raw) as Array<{ date: string; member_id?: string }>;
          for (const appt of list) {
            if (appt.date < today) continue;
            if (appt.member_id && map[appt.member_id]) map[appt.member_id].appts++;
          }
        }
      } catch {
        /* ignore corrupt data */
      }
    }
    // Mark attention for members with missed meds in last 24h
    for (const log of recentLogs ?? []) {
      if (log.status !== "missed") continue;
      const reminder = (allReminders ?? []).find((r) => r.id === log.reminder_id);
      if (reminder && map[reminder.member_id]) map[reminder.member_id].attention = true;
    }
    return map;
  }, [members, allRecords, allMedicines, allReminders, recentLogs]);

  const totals = useMemo(
    () =>
      Object.values(memberStats).reduce(
        (acc, s) => ({
          records: acc.records + s.records,
          meds: acc.meds + s.meds,
          appts: acc.appts + s.appts,
        }),
        { records: 0, meds: 0, appts: 0 }
      ),
    [memberStats]
  );

  // Build alerts list: missed meds in last 24h + upcoming appointments tomorrow
  const alerts = useMemo<Alert[]>(() => {
    const out: Alert[] = [];
    for (const log of recentLogs ?? []) {
      if (log.status !== "missed") continue;
      const reminder = (allReminders ?? []).find((r) => r.id === log.reminder_id);
      if (!reminder) continue;
      const who = members.find((m) => m.id === reminder.member_id)?.name || "Family";
      out.push({
        id: `missed-${log.id}`,
        kind: "missed",
        who,
        time: formatReminderTime(reminder.time),
        copy: `Missed ${reminder.medicine_name}${reminder.dosage ? ` ${reminder.dosage}` : ""}`,
      });
      if (out.length >= 3) break;
    }
    return out;
  }, [recentLogs, allReminders, members]);

  const alertsCount = alerts.length;
  const todayLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const aiSummary = (() => {
    if (members.length <= 1) return "Invite your family to start a shared record.";
    if (alertsCount > 0)
      return `${alertsCount} item${alertsCount > 1 ? "s" : ""} need attention today.`;
    return "Everyone is on track today. Nice work.";
  })();

  if (isLoading) {
    return <LoadingSpinner className="py-12" />;
  }

  return (
    <div className="pb-24">
      {/* Dark hero */}
      <div
        className="relative text-white rounded-b-[28px] overflow-hidden px-5 pt-12 pb-5"
        style={{
          background:
            "radial-gradient(ellipse at top right, rgba(232,168,160,0.12) 0%, transparent 55%), radial-gradient(ellipse at bottom left, rgba(144,188,232,0.08) 0%, transparent 50%), linear-gradient(180deg, #0F0F11 0%, #17171A 100%)",
        }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-white/50">
              FAMILY · {todayLabel.toUpperCase()}
            </p>
            <h1 className="font-serif text-[28px] font-bold tracking-tight leading-none mt-1">
              Household
            </h1>
          </div>
          <Link
            href="/reminders"
            aria-label="Notifications"
            className="h-9 w-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-white"
          >
            <Bell className="h-4 w-4" />
          </Link>
        </div>

        {/* Totals */}
        <div className="flex items-center gap-2.5 py-3 border-b border-white/10">
          <TotalCell value={members.length} label="MEMBERS" />
          <Separator />
          <TotalCell value={totals.records} label="RECORDS" />
          <Separator />
          <TotalCell value={totals.meds} label="MEDS" />
          <Separator />
          <TotalCell value={alertsCount} label="ALERTS" accent={alertsCount > 0} />
        </div>

        {/* AI summary */}
        <div className="mt-3.5 flex items-center gap-2.5 rounded-xl bg-white/[0.07] border border-white/10 px-3 py-2.5">
          <div className="h-7 w-7 shrink-0 rounded-lg bg-[#C9B9ED]/20 text-[#C9B9ED] flex items-center justify-center">
            <Brain className="h-3.5 w-3.5" />
          </div>
          <p className="flex-1 text-[11.5px] font-medium leading-snug text-white/90">
            {aiSummary}
          </p>
          <ArrowUpRight className="h-3.5 w-3.5 text-white/45" />
        </div>
      </div>

      <div className="px-4 pt-3 space-y-1.5">
        {/* Alerts ticker */}
        {alerts.length > 0 && (
          <>
            <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground px-0.5 pt-2 pb-1">
              Attention · {alerts.length}
            </p>
            <div className="space-y-1">
              {alerts.map((a, i) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2.5 rounded-xl bg-card border border-border/50 px-2.5 py-2"
                >
                  <span className="font-mono w-[18px] text-[10px] font-extrabold text-muted-foreground/70">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="h-[26px] w-[26px] rounded-lg bg-[#FBE7DE] text-[#9A3E1A] flex items-center justify-center">
                    <AlertIcon kind={a.kind} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold tracking-tight leading-tight truncate">
                      {a.copy}
                    </p>
                    <p className="font-mono text-[9.5px] font-semibold text-muted-foreground mt-0.5">
                      {a.who} · {a.time}
                    </p>
                  </div>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
                </div>
              ))}
            </div>
          </>
        )}

        {/* Members list */}
        <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground px-0.5 pt-3 pb-1">
          Members · {members.length}
        </p>

        <div className="space-y-1">
          {members.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              stats={memberStats[m.id] || { records: 0, meds: 0, appts: 0, attention: false, latest: null }}
            />
          ))}

          {/* Add member — dashed row, prominent in same stack */}
          <Link
            href="/family/add"
            className="flex items-center gap-2.5 rounded-xl bg-card border-[1.5px] border-dashed border-[#C7C7C0] px-2.5 py-3 hover:bg-muted/40 transition-colors"
          >
            <div className="h-10 w-10 rounded-xl bg-foreground text-background flex items-center justify-center shrink-0">
              <Plus className="h-[18px] w-[18px]" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-extrabold tracking-tight">
                {members.length === 0 ? t("family.add_member") : t("family.add")}
              </p>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mt-0.5">
                Partner · Parent · Child
              </p>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </Link>
        </div>

        {members.length <= 1 && (
          <div className="flex items-center gap-1.5 px-2.5 pt-3 text-[10.5px] text-muted-foreground font-medium">
            <Shield className="h-3 w-3" />
            <span>Private & encrypted · each member owns their data</span>
          </div>
        )}
      </div>
    </div>
  );
}

function TotalCell({
  value,
  label,
  accent,
}: {
  value: number;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="flex-1">
      <p
        className={`font-serif text-[26px] font-bold tracking-tight leading-none ${
          accent ? "text-[#FFB26E]" : ""
        }`}
      >
        {value}
      </p>
      <p className="font-mono text-[8.5px] font-bold uppercase tracking-[0.16em] text-white/50 mt-1">
        {label}
      </p>
    </div>
  );
}

function Separator() {
  return <span className="h-7 w-px bg-white/10" />;
}

function AlertIcon({ kind }: { kind: Alert["kind"] }) {
  if (kind === "missed") return <Pill className="h-3 w-3" />;
  if (kind === "appt") return <Calendar className="h-3 w-3" />;
  return <TestTube className="h-3 w-3" />;
}

function MemberRow({
  member,
  stats,
}: {
  member: Member;
  stats: { records: number; meds: number; appts: number; attention: boolean };
}) {
  const router = useRouter();
  const isSelf = member.relation === "self";
  const role = RELATION_LABELS[member.relation] || member.relation;
  const age = member.date_of_birth ? calcAge(member.date_of_birth) : null;

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/family/${member.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/family/${member.id}`);
        }
      }}
      className="flex items-center gap-2.5 rounded-xl bg-card border border-border/50 px-2.5 py-2.5 hover:bg-muted/30 transition-colors cursor-pointer"
    >
      <div className="relative shrink-0">
        <MemberAvatar name={member.name} avatarUrl={member.avatar_url} size="md" />
        {stats.attention && (
          <span className="absolute -bottom-0.5 -right-0.5 h-[11px] w-[11px] rounded-full bg-[#F05A1F] border-2 border-card" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[14px] font-extrabold tracking-tight truncate">
            {member.name.split(" ")[0]}
          </span>
          {isSelf && (
            <span className="font-mono text-[8.5px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              YOU
            </span>
          )}
          <span className="text-[11px] text-muted-foreground font-medium truncate">
            · {role}
            {age != null ? `, ${age}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground font-medium">
          <span>
            <b className="font-mono text-foreground font-extrabold">{stats.records}</b> rec
          </span>
          <span className="text-muted-foreground/60">·</span>
          <span>
            <b className="font-mono text-foreground font-extrabold">{stats.meds}</b> meds
          </span>
          <span className="text-muted-foreground/60">·</span>
          <span>
            <b className="font-mono text-foreground font-extrabold">{stats.appts}</b> appts
          </span>
        </div>
      </div>
      <Link
        href={`/records/add?member=${member.id}`}
        aria-label={`Add record for ${member.name}`}
        onClick={(e) => e.stopPropagation()}
        className="h-8 w-8 shrink-0 rounded-[10px] bg-foreground text-background flex items-center justify-center"
      >
        <Plus className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function calcAge(dob: string): number | null {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

function formatReminderTime(time: string): string {
  const [hStr, mStr] = time.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${suffix}`;
}
