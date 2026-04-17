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
  const greeting = selfMember
    ? `${t("home.greeting")}, ${selfMember.name.split(" ")[0]}`
    : t("home.welcome");

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
      <div className="bg-primary text-primary-foreground px-4 pt-6 pb-8 rounded-b-3xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="MediFamily"
              width={36}
              height={36}
              className="rounded-lg bg-white p-0.5"
            />
            <div>
              <h1 className="text-xl font-bold">{greeting}</h1>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <NotificationCenter />
          </div>
        </div>

        {/* Search */}
        <div className="mb-4">
          <GlobalSearch />
        </div>

        {/* 3 Main AI Actions */}
        <div data-tour="home-ai-row" className="grid grid-cols-3 gap-3">
          <Link href="/ai-doctor">
            <div className="flex flex-col items-center gap-2 bg-primary-foreground/10 rounded-2xl p-4 hover:bg-primary-foreground/20 transition-colors">
              <Stethoscope className="h-7 w-7" />
              <span className="text-xs font-medium">{t("home.ai_doctor")}</span>
            </div>
          </Link>
          <Link href="/medicine">
            <div className="flex flex-col items-center gap-2 bg-primary-foreground/10 rounded-2xl p-4 hover:bg-primary-foreground/20 transition-colors">
              <Pill className="h-7 w-7" />
              <span className="text-xs font-medium">{t("home.medicine_info")}</span>
            </div>
          </Link>
          <Link href="/lab-insights">
            <div className="flex flex-col items-center gap-2 bg-primary-foreground/10 rounded-2xl p-4 hover:bg-primary-foreground/20 transition-colors">
              <TestTube className="h-7 w-7" />
              <span className="text-xs font-medium">{t("home.lab_insights")}</span>
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
  const circumference = 2 * Math.PI * 34;
  const dash = (pct / 100) * circumference;
  const waterL = (waterMl / 1000).toFixed(waterMl % 1000 === 0 ? 0 : 2).replace(/\.?0+$/, "");
  const targetL = (waterTargetMl / 1000).toFixed(waterTargetMl % 1000 === 0 ? 0 : 1).replace(/\.?0+$/, "");
  const greeting = pct >= 100
    ? "Target hit — great work"
    : pct > 0
    ? "You're on your way"
    : "Let's start with a glass of water";

  return (
    <div className="rounded-3xl bg-gradient-to-br from-primary/15 via-primary/8 to-transparent border border-primary/20 p-5">
      <div className="flex items-center gap-4">
        {/* Progress ring */}
        <div className="relative h-20 w-20 shrink-0">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80">
            <circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              className="text-muted/30"
            />
            <circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference}`}
              className="text-primary transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Droplet
              className={cn(
                "h-7 w-7 transition-colors",
                pct > 0 ? "text-primary fill-primary/20" : "text-muted-foreground"
              )}
            />
          </div>
        </div>

        {/* Copy + streak */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Today
            </p>
            {streak > 0 && (
              <div className="flex items-center gap-1 bg-orange-500/10 px-2 py-0.5 rounded-full">
                <Flame className="h-3 w-3 text-orange-500" />
                <span className="text-[10px] font-extrabold text-orange-600">
                  {streak}
                </span>
              </div>
            )}
          </div>
          <p className="text-base font-extrabold tracking-tight">
            {waterL} / {targetL} L
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
            {greeting}
          </p>
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={onAddWater}
          className="h-12 px-4 rounded-2xl bg-primary text-primary-foreground text-[13px] font-bold flex items-center gap-1.5 shadow-md shadow-primary/20 active:scale-95 transition-transform shrink-0"
        >
          <Plus className="h-4 w-4" />
          Glass
        </button>
      </div>
    </div>
  );
}
