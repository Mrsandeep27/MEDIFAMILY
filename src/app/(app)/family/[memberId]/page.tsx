"use client";

import { use, useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Edit,
  Share2,
  AlertTriangle,
  BarChart3,
  Droplets,
  Trash2,
  Plus,
  ScanLine,
  Search,
  FileText,
  Download,
  Activity,
  Pill,
  Bell,
  Calendar,
  Clock,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AppHeader } from "@/components/layout/app-header";
import { RecordCard } from "@/components/records/record-card";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { useMember, useMembers } from "@/hooks/use-members";
import { useRecords } from "@/hooks/use-records";
import { useHealthMetrics, METRIC_CONFIG, getHealthStatus } from "@/hooks/use-health-metrics";
import { useReminders } from "@/hooks/use-reminders";
import { useAuthStore } from "@/stores/auth-store";
import { RELATION_LABELS, RECORD_TYPE_LABELS } from "@/constants/config";
import type { RecordType } from "@/lib/db/schema";
import { toast } from "sonner";
import { db } from "@/lib/db/dexie";

interface Appointment {
  id: string;
  member_id: string;
  member_name: string;
  doctor_name: string;
  hospital: string;
  date: string;
  time: string;
  purpose: string;
}

/* ─── Initials avatar with soft gradient ─── */
const AVATAR_GRADIENTS = [
  "from-blue-500 to-cyan-400",
  "from-emerald-500 to-teal-400",
  "from-violet-500 to-purple-400",
  "from-rose-500 to-pink-400",
  "from-amber-500 to-orange-400",
  "from-indigo-500 to-blue-400",
];
function getGradient(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_GRADIENTS[Math.abs(h) % AVATAR_GRADIENTS.length];
}

export default function MemberDetailPage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { member, isLoading } = useMember(memberId);
  const { deleteMember } = useMembers();
  const { records, isLoading: recordsLoading, searchRecords } = useRecords(memberId);
  const { metrics } = useHealthMetrics(memberId);
  const { reminders } = useReminders(memberId);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [typeFilter, setTypeFilter] = useState<RecordType | "all">("all");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<typeof records | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;
    try {
      const raw = localStorage.getItem(`medifamily_appointments_${user.id}`);
      if (raw) {
        const all: Appointment[] = JSON.parse(raw);
        const now = new Date();
        setAppointments(
          all.filter((a) => a.member_id === memberId && new Date(a.date) >= now)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .slice(0, 3)
        );
      }
    } catch { /* ignore */ }
  }, [user, memberId]);

  const handleSearch = useCallback((query: string) => {
    setSearch(query);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length > 1) {
      debounceRef.current = setTimeout(async () => {
        setSearchResults(await searchRecords(query));
      }, 300);
    } else {
      setSearchResults(null);
    }
  }, [searchRecords]);

  const filteredRecords = (searchResults || records || []).filter(
    (r) => typeFilter === "all" || r.type === typeFilter
  );
  const latestVitals = (() => {
    const seen = new Set<string>();
    return (metrics || []).filter((m) => { if (seen.has(m.type)) return false; seen.add(m.type); return true; });
  })();
  const activeReminders = (reminders || []).filter((r) => r.is_active);
  const recordCount = (records || []).length;

  const handleDownloadReport = async () => {
    if (!member) return;
    try {
      const [memberRecords, medicines] = await Promise.all([
        db.records.filter((r) => r.member_id === memberId && !r.is_deleted).toArray(),
        db.medicines.filter((m) => m.member_id === memberId && !m.is_deleted).toArray(),
      ]);
      const report = {
        exportedAt: new Date().toISOString(),
        member: { name: member.name, relation: member.relation, blood_group: member.blood_group, date_of_birth: member.date_of_birth, allergies: member.allergies, chronic_conditions: member.chronic_conditions },
        records: memberRecords.map(({ local_image_blobs, ...rest }) => rest), medicines,
      };
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${member.name.replace(/\s+/g, "-")}-health-report-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Report downloaded");
    } catch { toast.error("Failed to download report"); }
  };

  if (isLoading) return <div><AppHeader title="Loading..." showBack /><LoadingSpinner className="py-12" /></div>;
  if (!member) return <div><AppHeader title="Not Found" showBack /><p className="text-center text-muted-foreground py-12">Member not found.</p></div>;

  const initials = member.name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
  const gradient = getGradient(member.name);

  return (
    <div className="pb-24 bg-background">
      {/* ═══════════════════ PROFILE HEADER ═══════════════════ */}
      <div className="bg-primary text-primary-foreground rounded-b-[2rem]">
        {/* Nav */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <button onClick={() => router.back()} className="h-10 w-10 rounded-full bg-primary-foreground/10 flex items-center justify-center active:scale-95 transition-transform">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold tracking-wide">Profile</span>
          <Link href={`/family/${memberId}/edit`}>
            <button className="h-10 w-10 rounded-full bg-primary-foreground/10 flex items-center justify-center active:scale-95 transition-transform">
              <Edit className="h-4 w-4" />
            </button>
          </Link>
        </div>

        {/* Avatar + Info */}
        <div className="flex flex-col items-center pt-2 pb-6 px-4">
          <div className={`h-20 w-20 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
            <span className="text-2xl font-bold text-white drop-shadow-sm">{initials}</span>
          </div>
          <h1 className="text-xl font-bold mt-3 tracking-tight">{member.name}</h1>
          <p className="text-primary-foreground/50 text-sm mt-0.5">
            {RELATION_LABELS[member.relation] || member.relation}
          </p>
          {/* Info chips */}
          <div className="flex items-center gap-2 mt-3">
            {member.blood_group && (
              <div className="flex items-center gap-1.5 bg-primary-foreground/10 rounded-full px-3 py-1">
                <Droplets className="h-3.5 w-3.5 text-red-400" />
                <span className="text-xs font-bold">{member.blood_group}</span>
              </div>
            )}
            {member.date_of_birth && (
              <div className="bg-primary-foreground/10 rounded-full px-3 py-1">
                <span className="text-xs text-primary-foreground/70">
                  {new Date(member.date_of_birth).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
            )}
          </div>
          {/* Buttons */}
          <div className="flex gap-3 mt-5 w-full max-w-xs">
            <button onClick={handleDownloadReport} className="flex-1 h-11 rounded-full bg-primary-foreground/10 flex items-center justify-center gap-2 text-sm font-semibold active:scale-[0.97] transition-transform">
              <Download className="h-4 w-4" /> Download
            </button>
            <Link href={`/family/${memberId}/share`} className="flex-1">
              <button className="w-full h-11 rounded-full bg-primary-foreground text-primary flex items-center justify-center gap-2 text-sm font-bold shadow-lg active:scale-[0.97] transition-transform">
                <Share2 className="h-4 w-4" /> Share
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* ═══════════════════ QUICK ACTIONS ═══════════════════ */}
      <div className="px-4 mt-5">
        <div className="flex gap-3">
          {[
            { href: `/family/${memberId}/emergency`, icon: AlertTriangle, label: "Emergency", iconBg: "bg-red-500", cardBg: "bg-red-50 dark:bg-red-950/30" },
            { href: `/family/${memberId}/insights`, icon: BarChart3, label: "Insights", iconBg: "bg-emerald-500", cardBg: "bg-emerald-50 dark:bg-emerald-950/30" },
            { href: `/scan?memberId=${memberId}`, icon: ScanLine, label: "Scan Rx", iconBg: "bg-violet-500", cardBg: "bg-violet-50 dark:bg-violet-950/30" },
          ].map((a) => (
            <Link key={a.href} href={a.href} className="flex-1">
              <div className={`${a.cardBg} rounded-2xl py-4 flex flex-col items-center gap-2.5 border border-border/30 active:scale-[0.96] transition-transform`}>
                <div className={`h-11 w-11 rounded-2xl ${a.iconBg} flex items-center justify-center shadow-md`}>
                  <a.icon className="h-5 w-5 text-white" />
                </div>
                <span className="text-[11px] font-bold text-foreground">{a.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ═══════════════════ SECTIONS ═══════════════════ */}
      <div className="px-4 mt-6 space-y-6">

        {/* ─── Health Alerts ─── */}
        {(member.allergies.length > 0 || member.chronic_conditions.length > 0) && (
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest">Health Alerts</span>
            </div>
            {member.allergies.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-bold text-amber-500/80 uppercase tracking-wider mb-1.5">Allergies</p>
                <div className="flex flex-wrap gap-1.5">
                  {member.allergies.map((a) => (
                    <span key={a} className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">{a}</span>
                  ))}
                </div>
              </div>
            )}
            {member.allergies.length > 0 && member.chronic_conditions.length > 0 && <Separator className="bg-amber-200/40 mb-3" />}
            {member.chronic_conditions.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-amber-500/80 uppercase tracking-wider mb-1.5">Conditions</p>
                <div className="flex flex-wrap gap-1.5">
                  {member.chronic_conditions.map((c) => (
                    <span key={c} className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">{c}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Vitals ─── */}
        {latestVitals.length > 0 && (
          <section>
            <SectionHeader icon={Activity} title="Latest Vitals" actionHref={`/vitals?memberId=${memberId}`} />
            <div className="grid grid-cols-2 gap-3">
              {latestVitals.map((metric) => {
                const config = METRIC_CONFIG[metric.type];
                const status = getHealthStatus(metric.type, metric.value);
                const val = Object.values(metric.value).join("/");
                const dot = status.status === "normal" ? "bg-green-500" : status.status === "high" ? "bg-orange-500" : status.status === "critical" ? "bg-red-500" : "bg-yellow-500";
                return (
                  <div key={metric.id} className="bg-card rounded-2xl border border-border/40 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{config.label}</span>
                      <div className="flex items-center gap-1">
                        <div className={`h-2 w-2 rounded-full ${dot}`} />
                        <span className={`text-[10px] font-bold ${status.color}`}>{status.label}</span>
                      </div>
                    </div>
                    <p className="text-2xl font-extrabold tracking-tight" style={{ color: config.color }}>{val}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{config.unit}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ─── Reminders ─── */}
        {activeReminders.length > 0 && (
          <section>
            <SectionHeader icon={Bell} title="Reminders" actionHref="/reminders" actionLabel="Manage" />
            <div className="bg-card rounded-2xl border border-border/40 overflow-hidden divide-y divide-border/30">
              {activeReminders.slice(0, 4).map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="h-10 w-10 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0">
                    <Pill className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{r.medicine_name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3 shrink-0" />
                      <span className="font-semibold">{r.time}</span>
                      {r.dosage && <><span className="opacity-30">|</span><span>{r.dosage}</span></>}
                      {r.before_food && <span className="text-[9px] font-bold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-md ml-0.5">Before food</span>}
                    </div>
                  </div>
                </div>
              ))}
              {activeReminders.length > 4 && (
                <Link href="/reminders" className="flex items-center justify-center py-3 text-xs font-bold text-primary hover:bg-muted/30 transition-colors">
                  +{activeReminders.length - 4} more
                </Link>
              )}
            </div>
          </section>
        )}

        {/* ─── Appointments ─── */}
        {appointments.length > 0 && (
          <section>
            <SectionHeader icon={Calendar} title="Upcoming" actionHref="/appointments" />
            <div className="space-y-3">
              {appointments.map((apt) => (
                <div key={apt.id} className="bg-card rounded-2xl border border-border/40 p-4 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold text-blue-400 uppercase leading-none">{new Date(apt.date).toLocaleDateString("en-IN", { month: "short" })}</span>
                    <span className="text-lg font-extrabold text-blue-600 dark:text-blue-400 leading-none">{new Date(apt.date).getDate()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{apt.doctor_name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{apt.time}{apt.purpose ? ` · ${apt.purpose}` : ""}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/20 shrink-0" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ═══════════════════ RECORDS ═══════════════════ */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-2xl bg-primary flex items-center justify-center">
                <FileText className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <h3 className="text-base font-extrabold leading-tight">Records</h3>
                {recordCount > 0 && <p className="text-[10px] text-muted-foreground">{recordCount} total</p>}
              </div>
            </div>
            <div className="flex gap-2">
              <Link href={`/scan?memberId=${memberId}`}>
                <button className="h-9 px-3.5 rounded-full border border-border text-[11px] font-bold flex items-center gap-1.5 active:scale-95 transition-transform hover:bg-muted/50">
                  <ScanLine className="h-3.5 w-3.5" /> Scan
                </button>
              </Link>
              <Link href={`/records/add?memberId=${memberId}`}>
                <button className="h-9 px-3.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform">
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </Link>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
            <input
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search records..."
              className="w-full h-11 pl-11 pr-4 rounded-2xl bg-muted/40 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/15 focus:bg-background transition-all"
            />
          </div>

          {/* Filter pills */}
          <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
            {[["all", "All"], ...Object.entries(RECORD_TYPE_LABELS)].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setTypeFilter(value as RecordType | "all")}
                className={`shrink-0 px-4 py-2 rounded-full text-[11px] font-bold transition-all active:scale-95 ${
                  typeFilter === value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* List */}
          {recordsLoading ? (
            <LoadingSpinner className="py-12" />
          ) : filteredRecords.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border/60 py-14 text-center">
              <div className="h-16 w-16 rounded-3xl bg-muted/60 flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-bold">{search ? `No results for "${search}"` : "No records yet"}</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[200px] mx-auto">
                {search ? "Try a different search" : "Scan a prescription or add a record to get started"}
              </p>
              {!search && (
                <div className="flex gap-2 justify-center mt-5">
                  <button onClick={() => router.push(`/scan?memberId=${memberId}`)} className="h-10 px-5 rounded-full bg-primary text-sm font-bold text-primary-foreground flex items-center gap-2 shadow-sm active:scale-95 transition-transform">
                    <ScanLine className="h-4 w-4" /> Scan Rx
                  </button>
                  <button onClick={() => router.push(`/records/add?memberId=${memberId}`)} className="h-10 px-5 rounded-full border border-border text-sm font-bold flex items-center gap-2 active:scale-95 transition-transform">
                    <Plus className="h-4 w-4" /> Add
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRecords.map((record) => (
                <RecordCard key={record.id} record={record} />
              ))}
            </div>
          )}
        </section>

        {/* ─── Delete ─── */}
        {member.relation !== "self" && (
          <div className="pt-8 pb-4">
            {!showDeleteConfirm ? (
              <button onClick={() => setShowDeleteConfirm(true)} className="w-full flex items-center justify-center gap-1.5 py-3 text-xs text-muted-foreground/30 hover:text-destructive transition-colors">
                <Trash2 className="h-3.5 w-3.5" /> Delete Member
              </button>
            ) : (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 space-y-3">
                <p className="text-sm font-semibold text-destructive">Delete {member.name}? All data will be permanently removed.</p>
                <div className="flex gap-2">
                  <Button variant="destructive" className="flex-1 rounded-xl" disabled={isDeleting}
                    onClick={async () => { setIsDeleting(true); try { await deleteMember(memberId); toast.success(`${member.name} deleted`); router.replace("/family"); } catch (err) { console.error("Delete failed:", err); toast.error("Failed to delete member"); setIsDeleting(false); } }}>
                    {isDeleting ? "Deleting..." : "Yes, Delete"}
                  </Button>
                  <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Section Header ─── */
function SectionHeader({ icon: Icon, title, actionHref, actionLabel = "View All" }: { icon: React.ElementType; title: string; actionHref: string; actionLabel?: string; }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-[15px] font-extrabold flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
      </h3>
      <Link href={actionHref} className="text-xs font-bold text-primary flex items-center gap-0.5 active:scale-95 transition-transform">
        {actionLabel} <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
