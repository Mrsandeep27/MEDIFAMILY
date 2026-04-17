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
  const [showFeeling, setShowFeeling] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [tipExpanded, setTipExpanded] = useState(false);
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
        <div className="grid grid-cols-3 gap-3">
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
        {/* Health Tip — tap to expand */}
        <button
          type="button"
          onClick={() => setTipExpanded((v) => !v)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-left shadow-md hover:shadow-lg transition-shadow"
        >
          <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Lightbulb className="h-4 w-4 text-white" />
          </div>
          <p className={`text-sm font-semibold text-white ${tipExpanded ? "" : "truncate"}`}>{t(tipKey)}</p>
        </button>


        {/* Weekly Summary */}

        {/* All Features + ABHA — side by side */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setShowTools((v) => !v)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted/50 hover:bg-muted transition-colors border border-border"
            aria-expanded={showTools}
          >
            <LayoutGrid className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs font-semibold flex-1 text-left">{t("home.all_features")}</span>
            <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0 ${showTools ? "rotate-180" : ""}`} />
          </button>
          <Link href="/abha">
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
