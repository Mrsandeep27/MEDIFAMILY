"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Activity,
  Pill,
  TestTube,
  Stethoscope,
  AlertTriangle,
  X,
  Smile,
  Meh,
  Frown,
  AlertCircle,
  Shield,
  Calendar,
  Clock,
  Lightbulb,
  CalendarDays,
  Zap,
  LayoutGrid,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GlobalSearch } from "@/components/home/global-search";
import { NotificationCenter } from "@/components/home/notification-center";
import { useMembers } from "@/hooks/use-members";
import { useAuthStore } from "@/stores/auth-store";
import { APP_NAME } from "@/constants/config";
import { PWAInstallBanner } from "@/components/pwa/install-button";
import { useLocale } from "@/lib/i18n/use-locale";
import { useWellness, computeStreak } from "@/hooks/use-wellness";
import { useReminders } from "@/hooks/use-reminders";
import { Droplet, Plus, Flame } from "lucide-react";
import { MemberAvatar } from "@/components/family/member-avatar";
import { cn } from "@/lib/utils";

const moodOptionDefs = [
  { value: "great", icon: Smile, labelKey: "mood.great", color: "text-green-500", bg: "bg-green-500/20" },
  { value: "good", icon: Smile, labelKey: "mood.good", color: "text-emerald-500", bg: "bg-emerald-500/20" },
  { value: "okay", icon: Meh, labelKey: "mood.okay", color: "text-yellow-500", bg: "bg-yellow-500/20" },
  { value: "bad", icon: Frown, labelKey: "mood.bad", color: "text-orange-500", bg: "bg-orange-500/20" },
  { value: "terrible", icon: AlertCircle, labelKey: "mood.terrible", color: "text-red-500", bg: "bg-red-500/20" },
];


// Specialized health tools — basic actions (Scan/Add/Symptoms/Reminders) live
// in the quick actions row, and Settings/Feedback/Export live under /more.
const shortcutDefs = [
  { href: "/visit-prep", icon: Stethoscope, labelKey: "home.visit_prep" },
  { href: "/medicine-checker", icon: Zap, labelKey: "more.medicine_checker" },
  { href: "/vitals", icon: Activity, labelKey: "home.vitals_tracker" },
  { href: "/smart-records", icon: Activity, labelKey: "home.health_overview" },
  { href: "/health-risk", icon: AlertTriangle, labelKey: "home.risk_assessment" },
  { href: "/timeline", icon: Clock, labelKey: "home.health_timeline" },
  { href: "/appointments", icon: CalendarDays, labelKey: "more.appointments" },
  { href: "/abha", icon: Shield, labelKey: "home.abha_health_id" },
];

const tipKeys = ["tip.1", "tip.2", "tip.3", "tip.4", "tip.5", "tip.6", "tip.7", "tip.8", "tip.9", "tip.10"];

export default function HomePage() {
  const router = useRouter();
  const { locale, t } = useLocale();
  const user = useAuthStore((s) => s.user);
  const { members } = useMembers();
  const { todayEntry, recentEntries, goals, addWater } = useWellness();
  const { todayReminders } = useReminders();
  const [showFeeling, setShowFeeling] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [tipExpanded, setTipExpanded] = useState(true); // expanded by default — never truncate
  const [appointments, setAppointments] = useState<Array<{ date: string; time: string; doctor_name: string; purpose: string }>>([]);
  // Rotate tip on every mount (each time user lands on home) — pick a fresh
  // random key so revisiting feels alive instead of stuck on one tip.
  const [tipKey, setTipKey] = useState(() => tipKeys[Math.floor(Math.random() * tipKeys.length)]);
  useEffect(() => {
    setTipKey(tipKeys[Math.floor(Math.random() * tipKeys.length)]);
  }, []);

  const selfMember = members.find((m) => m.relation === "self");
  const firstName = selfMember?.name.split(" ")[0];
  const greeting = firstName || t("home.welcome");

  const todayLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // Load upcoming appointments
  useEffect(() => {
    if (!user) return;
    const raw = localStorage.getItem(`medifamily_appointments_${user.id}`);
    if (raw) {
      try {
        const all = JSON.parse(raw);
        const today = new Date().toISOString().split("T")[0];
        const upcoming = all
          .filter((a: { date: string }) => a.date >= today)
          .sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date))
          .slice(0, 3);
        setAppointments(upcoming);
      } catch { /* ignore */ }
    }
  }, [user]);

  // Show "Feeling Today" popup once per day
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const lastShown = localStorage.getItem("medifamily_feeling_shown");
    if (lastShown !== today) {
      const timer = setTimeout(() => setShowFeeling(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleFeelingSelect = (mood: string) => {
    const today = new Date().toISOString().split("T")[0];
    localStorage.setItem("medifamily_feeling_shown", today);
    const userId = user?.id || "anon";
    const key = `medifamily_symptoms_${userId}`;
    let existing: Array<{ date: string }> = [];
    try { existing = JSON.parse(localStorage.getItem(key) || "[]"); } catch { /* corrupted data */ }
    const entry = {
      id: Date.now().toString(),
      date: today,
      mood,
      symptoms: [],
      notes: "",
      timestamp: Date.now(),
    };
    const updated = [entry, ...existing.filter((e: { date: string }) => e.date !== today)];
    localStorage.setItem(key, JSON.stringify(updated));
    setShowFeeling(false);
    if (mood === "bad" || mood === "terrible") {
      router.push("/symptom-tracker");
    }
  };

  const dismissFeeling = () => {
    const today = new Date().toISOString().split("T")[0];
    localStorage.setItem("medifamily_feeling_shown", today);
    setShowFeeling(false);
  };


  return (
    <div className="space-y-6">
      <PWAInstallBanner />

      {/* Header */}
      <div className="relative bg-primary text-primary-foreground px-4 pt-6 pb-9 rounded-b-[2rem] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-500">
        {/* Subtle decorative glow — creates depth without being busy */}
        <div className="pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full bg-primary-foreground/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-primary-foreground/5 blur-3xl" />

        <div className="relative flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="MediFamily"
              width={40}
              height={40}
              className="rounded-xl bg-white p-1 shadow-sm"
            />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-foreground/60">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]"
                  aria-hidden="true"
                />
                {todayLabel}
              </p>
              <h1 className="text-xl font-extrabold tracking-tight leading-tight mt-0.5 truncate">
                {firstName ? `Hi, ${firstName}` : greeting}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <NotificationCenter />
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <GlobalSearch />
        </div>

        {/* 3 Main AI Actions — distinct soft tints per tool for visual rhythm */}
        <div data-tour="home-ai-row" className="relative grid grid-cols-3 gap-2.5">
          <Link href="/ai-doctor" className="group">
            <div className="flex flex-col items-center gap-2 bg-primary-foreground/12 hover:bg-primary-foreground/20 rounded-2xl p-3.5 transition-all active:scale-[0.97]">
              <div className="h-11 w-11 rounded-2xl bg-primary-foreground/15 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Stethoscope className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-bold tracking-tight">{t("home.ai_doctor")}</span>
            </div>
          </Link>
          <Link href="/medicine" className="group">
            <div className="flex flex-col items-center gap-2 bg-primary-foreground/12 hover:bg-primary-foreground/20 rounded-2xl p-3.5 transition-all active:scale-[0.97]">
              <div className="h-11 w-11 rounded-2xl bg-primary-foreground/15 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Pill className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-bold tracking-tight">{t("home.medicine_info")}</span>
            </div>
          </Link>
          <Link href="/lab-insights" className="group">
            <div className="flex flex-col items-center gap-2 bg-primary-foreground/12 hover:bg-primary-foreground/20 rounded-2xl p-3.5 transition-all active:scale-[0.97]">
              <div className="h-11 w-11 rounded-2xl bg-primary-foreground/15 flex items-center justify-center group-hover:scale-105 transition-transform">
                <TestTube className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-bold tracking-tight">{t("home.lab_insights")}</span>
            </div>
          </Link>
        </div>
      </div>

      <div className="px-4 space-y-4">
        {/* Family switcher chips — quick deep-link to any member */}
        {members.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
            {members.map((m) => (
              <Link
                key={m.id}
                href={`/family/${m.id}`}
                className="shrink-0 flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
              >
                <MemberAvatar
                  name={m.name}
                  avatarUrl={m.avatar_url}
                  size="lg"
                />
                <span className="text-[11px] font-semibold text-foreground/80 max-w-[64px] truncate">
                  {m.relation === "self" ? "You" : m.name.split(" ")[0]}
                </span>
              </Link>
            ))}
          </div>
        )}

        {/* Today hero — wellness ring + streak + CTA */}
        <TodayCard
          waterMl={todayEntry?.water_ml ?? 0}
          waterTargetMl={goals?.water_target_ml ?? 2000}
          streak={computeStreak(recentEntries)}
          onAddWater={() => addWater(250)}
        />

        {/* Next medicine reminder — elevated card with clear CTA */}
        <NextMedicineCard reminders={todayReminders} />

        {/* Health Tip — always expanded so it never truncates mid-word */}
        <button
          type="button"
          onClick={() => setTipExpanded((v) => !v)}
          className="w-full flex items-start gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-left shadow-md hover:shadow-lg transition-shadow"
        >
          <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
            <Lightbulb className="h-4 w-4 text-white" />
          </div>
          <p className="text-sm font-semibold text-white leading-relaxed">
            {t(tipKey)}
          </p>
        </button>


        {/* Weekly Summary */}

        {/* All Features + ABHA — side by side */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            data-tour="home-all-features"
            onClick={() => setShowTools((v) => !v)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted/50 hover:bg-muted transition-colors border border-border"
            aria-expanded={showTools}
          >
            <LayoutGrid className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs font-semibold flex-1 text-left">{t("home.all_features")}</span>
            <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0 ${showTools ? "rotate-180" : ""}`} />
          </button>
          <Link href="/abha" data-tour="home-abha">
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-green-50 border border-green-200 h-full">
              <Shield className="h-4 w-4 text-green-600 shrink-0" />
              <span className="text-xs font-bold text-green-800 flex-1">{t("home.link_abha")}</span>
              <span className="text-[8px] font-bold uppercase text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full leading-none shrink-0">Soon</span>
            </div>
          </Link>
        </div>
        {showTools && (
          <div className="grid grid-cols-4 gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
            {selfMember && (
              <Link
                href="/emergency-card"
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-red-100 border border-red-300 shadow-sm hover:bg-red-200 transition-colors"
              >
                <AlertTriangle className="h-5 w-5 text-red-700" />
                <span className="text-[10px] font-semibold text-center text-red-800 leading-tight">{t("home.emergency_card")}</span>
              </Link>
            )}
            {shortcutDefs.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-slate-800 border border-slate-700 shadow-sm hover:bg-slate-700 transition-colors"
                >
                  <Icon className="h-5 w-5 text-white" />
                  <span className="text-[10px] font-medium text-center text-white leading-tight">{t(item.labelKey)}</span>
                </Link>
              );
            })}
          </div>
        )}

        {/* Upcoming Appointments */}
        {appointments.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                {t("home.upcoming_appointments")}
              </h2>
              <Link href="/appointments" className="text-xs text-primary font-medium">
                {t("home.view_all")}
              </Link>
            </div>
            <div className="space-y-2">
              {appointments.map((apt, i) => (
                <Card key={i}>
                  <CardContent className="py-2.5 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-blue-50 dark:bg-blue-950 flex items-center justify-center shrink-0">
                      <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{apt.doctor_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(apt.date).toLocaleDateString(locale === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short" })} · {apt.time}
                        {apt.purpose ? ` · ${apt.purpose}` : ""}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}


      </div>

      {/* === FEELING TODAY POPUP === */}
      {showFeeling && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/40" onClick={dismissFeeling} />
          <div className="relative bg-background rounded-t-2xl sm:rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">{t("home.how_feeling")}</h3>
              <button onClick={dismissFeeling} className="text-muted-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex justify-between">
              {moodOptionDefs.map((mood) => {
                const Icon = mood.icon;
                return (
                  <button
                    key={mood.value}
                    onClick={() => handleFeelingSelect(mood.value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl hover:${mood.bg} transition-all active:scale-95`}
                  >
                    <Icon className={`h-9 w-9 ${mood.color}`} />
                    <span className="text-[11px] font-medium">{t(mood.labelKey)}</span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={dismissFeeling}
              className="text-xs text-muted-foreground text-center w-full"
            >
              {t("home.skip_today")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Pick the next upcoming reminder based on the current wall-clock time.
// Matches the design's "NEXT MEDICINE · 10:30 AM" pattern.
function pickNextReminder<T extends { time: string }>(reminders: T[]): T | null {
  if (!reminders.length) return null;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const parseMinutes = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const sorted = [...reminders].sort(
    (a, b) => parseMinutes(a.time) - parseMinutes(b.time)
  );
  return sorted.find((r) => parseMinutes(r.time) >= nowMinutes) ?? sorted[0];
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

function NextMedicineCard({
  reminders,
}: {
  reminders: Array<{
    id: string;
    medicine_name: string;
    dosage?: string;
    time: string;
    before_food: boolean;
  }>;
}) {
  const next = pickNextReminder(reminders);
  if (!next) return null;

  const subParts: string[] = [];
  if (next.dosage) subParts.push(next.dosage);
  subParts.push(next.before_food ? "before food" : "with food");

  return (
    <Link
      href="/reminders"
      className="relative flex items-center gap-3 rounded-3xl px-3.5 py-3 overflow-hidden text-white shadow-[0_8px_22px_rgba(240,90,31,0.3)] active:scale-[0.98] transition-transform"
      style={{
        background:
          "radial-gradient(ellipse at top right, rgba(255,255,255,0.15) 0%, transparent 60%), linear-gradient(135deg, #FF8A4C 0%, #F05A1F 100%)",
      }}
    >
      <div className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center bg-white/20 border border-white/20">
        <Pill className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[9px] font-extrabold tracking-[0.16em] opacity-90">
          NEXT MEDICINE · {formatReminderTime(next.time)}
        </p>
        <p className="text-[13px] font-bold leading-snug truncate mt-0.5">
          {next.medicine_name}
          {subParts.length ? ` · ${subParts.join(" · ")}` : ""}
        </p>
      </div>
      <span className="shrink-0 rounded-xl bg-white px-3 py-1.5 text-[11px] font-extrabold text-[#F05A1F] shadow-sm">
        Taken
      </span>
    </Link>
  );
}

/**
 * Today hero card — the first thing users see after the header.
 * Shows a circular hydration progress ring, current check-in streak,
 * and a primary "Log water" action so the home screen never feels dead.
 */
function TodayCard({
  waterMl,
  waterTargetMl,
  streak,
  onAddWater,
}: {
  waterMl: number;
  waterTargetMl: number;
  streak: number;
  onAddWater: () => void;
}) {
  const pct = Math.min(100, Math.round((waterMl / waterTargetMl) * 100));
  const circumference = 2 * Math.PI * 40;
  const dash = (pct / 100) * circumference;
  const waterL = (waterMl / 1000).toFixed(waterMl % 1000 === 0 ? 0 : 2).replace(/\.?0+$/, "");
  const targetL = (waterTargetMl / 1000).toFixed(waterTargetMl % 1000 === 0 ? 0 : 1).replace(/\.?0+$/, "");
  const subtitle = pct >= 100
    ? "Target hit — great work"
    : pct > 0
    ? `${100 - pct}% to daily target`
    : "Start with a glass of water";

  return (
    <div className="relative rounded-3xl bg-gradient-to-br from-primary/18 via-primary/10 to-transparent border border-primary/25 p-5 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Soft decorative blob */}
      <div className="pointer-events-none absolute -top-14 -right-14 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative flex items-center gap-4">
        {/* Progress ring — 96px */}
        <div className="relative h-24 w-24 shrink-0">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 96 96">
            <circle
              cx="48"
              cy="48"
              r="40"
              fill="none"
              stroke="currentColor"
              strokeWidth="7"
              className="text-muted/30"
            />
            <circle
              cx="48"
              cy="48"
              r="40"
              fill="none"
              stroke="currentColor"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference}`}
              className="text-primary transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Droplet
              className={cn(
                "h-5 w-5 transition-colors -mb-0.5",
                pct > 0 ? "text-primary fill-primary/30" : "text-muted-foreground"
              )}
            />
            <span className={cn(
              "font-mono text-[11px] font-bold tabular-nums",
              pct > 0 ? "text-primary" : "text-muted-foreground"
            )}>
              {pct}%
            </span>
          </div>
        </div>

        {/* Copy + streak */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.12em]">
              Today
            </p>
            {streak > 0 && (
              <div className="flex items-center gap-1 bg-orange-500/10 px-2 py-0.5 rounded-full">
                <Flame className="h-3 w-3 text-orange-500" />
                <span className="font-mono text-[10px] font-extrabold text-orange-600 tabular-nums">
                  {streak}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-black tracking-tight tabular-nums">
              {waterL}
            </span>
            <span className="text-sm font-bold text-muted-foreground">
              / {targetL} L
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
            {subtitle}
          </p>
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={onAddWater}
          className="h-14 w-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/25 active:scale-90 hover:scale-105 transition-transform shrink-0"
          aria-label="Add a glass of water"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
