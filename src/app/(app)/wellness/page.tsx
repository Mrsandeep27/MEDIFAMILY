"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Flame,
  Droplet,
  Scale,
  Smile,
  Laugh,
  Meh,
  Frown,
  Angry,
  Plus,
  Minus,
  Dumbbell,
  ChevronRight,
  Settings,
  TrendingUp,
  Target,
  Zap,
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { Button } from "@/components/ui/button";
import {
  FormField,
  FormGroup,
  FormInput,
} from "@/components/ui/form-primitives";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useWellness,
  computeStreak,
  computeHealthScore,
} from "@/hooks/use-wellness";
import { useWorkouts, workoutDaysThisWeek } from "@/hooks/use-workouts";
import type { Mood } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MOOD_OPTIONS: {
  value: Mood;
  label: string;
  icon: React.ElementType;
  color: string;
}[] = [
  { value: "great", label: "Great", icon: Laugh, color: "text-emerald-500" },
  { value: "good", label: "Good", icon: Smile, color: "text-lime-500" },
  { value: "okay", label: "Okay", icon: Meh, color: "text-amber-500" },
  { value: "low", label: "Low", icon: Frown, color: "text-orange-500" },
  { value: "bad", label: "Bad", icon: Angry, color: "text-rose-500" },
];

export default function WellnessPage() {
  const {
    todayEntry,
    recentEntries,
    goals,
    isLoading,
    addWater,
    setWeight,
    setMood,
  } = useWellness();
  const { workouts } = useWorkouts();

  const [weightDialogOpen, setWeightDialogOpen] = useState(false);
  const [weightInput, setWeightInput] = useState("");

  if (isLoading) {
    return (
      <div>
        <AppHeader title="Wellness" />
        <LoadingSpinner className="py-12" />
      </div>
    );
  }

  const waterTargetMl = goals?.water_target_ml ?? 2000;
  const weeklyTarget = goals?.workout_days_per_week ?? 4;
  const currentWaterMl = todayEntry?.water_ml ?? 0;
  const currentMood = todayEntry?.mood;
  const currentWeight = todayEntry?.weight_kg;

  const streak = computeStreak(recentEntries);
  const workoutsThisWeek = workoutDaysThisWeek(workouts);
  const score = computeHealthScore(
    recentEntries,
    workoutsThisWeek,
    waterTargetMl,
    weeklyTarget
  );

  // Day-0 fresh accounts should never see red/amber — that's demotivating.
  // If the user hasn't logged anything yet, frame it as "Let's begin" with
  // the neutral primary accent. Only surface warning colors once they've
  // been active for a while and actually fall behind.
  const hasAnyActivity =
    recentEntries.length > 0 || workoutsThisWeek > 0 || (todayEntry?.water_ml ?? 0) > 0;

  const scoreColor = !hasAnyActivity
    ? "text-primary"
    : score >= 75
    ? "text-emerald-500"
    : score >= 50
    ? "text-amber-500"
    : score >= 25
    ? "text-amber-500"
    : "text-muted-foreground";
  const scoreLabel = !hasAnyActivity
    ? "Let's begin"
    : score >= 75
    ? "Excellent"
    : score >= 50
    ? "Good"
    : score >= 25
    ? "Getting there"
    : "Tap a goal to start";

  const handleWeightSave = async () => {
    const kg = parseFloat(weightInput);
    if (!kg || kg < 20 || kg > 300) {
      toast.error("Enter a valid weight (20–300 kg)");
      return;
    }
    await setWeight(kg);
    setWeightDialogOpen(false);
    setWeightInput("");
    toast.success("Weight logged");
  };

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="pb-24">
      <AppHeader
        title="Wellness"
        rightAction={
          <Link href="/wellness/goals">
            <button className="h-9 w-9 rounded-full bg-muted/60 flex items-center justify-center active:scale-95 transition-transform">
              <Settings className="h-4 w-4" />
            </button>
          </Link>
        }
      />

      <div className="p-4 space-y-5">
        {/* ═══════ DATE + STREAK + SCORE HERO ═══════ */}
        <div className="relative rounded-3xl bg-gradient-to-br from-primary/12 via-primary/5 to-transparent border border-primary/20 p-5 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />

          <div className="relative flex items-center justify-between mb-5">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">
                Today
              </p>
              <p className="text-base font-extrabold tracking-tight mt-0.5">{today}</p>
            </div>
            {streak > 0 && (
              <div className="flex items-center gap-1.5 bg-orange-500/10 px-3 py-1.5 rounded-full">
                <Flame className="h-4 w-4 text-orange-500" />
                <span className="font-mono text-sm font-extrabold text-orange-600 tabular-nums">
                  {streak}
                </span>
                <span className="text-[11px] font-semibold text-orange-600/80">
                  day{streak === 1 ? "" : "s"}
                </span>
              </div>
            )}
          </div>

          <div className="relative flex items-end justify-between">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">
                Health Score
              </p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className={cn("font-mono text-6xl font-black tracking-tight tabular-nums leading-none", scoreColor)}>
                  {score}
                </span>
                <span className="text-base font-bold text-muted-foreground leading-none">
                  / 100
                </span>
              </div>
              <p className={cn("text-[13px] font-bold mt-1.5", scoreColor)}>
                {scoreLabel}
              </p>
            </div>
            {/* Circular progress ring — 96px, thicker */}
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
                  strokeDasharray={`${(score / 100) * 251.2} 251.2`}
                  className={cn(scoreColor, "transition-all duration-700 ease-out")}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center">
                  <TrendingUp className={cn("h-5 w-5 -mb-0.5", scoreColor)} />
                  <span className={cn("font-mono text-[10px] font-extrabold tabular-nums", scoreColor)}>
                    {score}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════ DAILY CHECKIN ═══════ */}
        <FormGroup title="Daily checkin">
          {/* Water */}
          <div className="rounded-2xl bg-card border border-border/40 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Droplet className="h-5 w-5 text-blue-500 fill-blue-500/30" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">Water</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatLitres(currentWaterMl)} / {formatLitres(waterTargetMl)} L
                </p>
              </div>
              <button
                onClick={() => addWater(-250)}
                disabled={currentWaterMl <= 0}
                className="h-9 w-9 rounded-full bg-muted/60 flex items-center justify-center active:scale-90 transition-transform disabled:opacity-40"
                aria-label="Undo last add"
              >
                <Minus className="h-4 w-4" />
              </button>
            </div>

            {/* Progress bar */}
            <div className="h-2 rounded-full bg-muted/60 overflow-hidden mb-3">
              <div
                className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-300 rounded-full"
                style={{
                  width: `${Math.min(100, (currentWaterMl / waterTargetMl) * 100)}%`,
                }}
              />
            </div>

            {/* Quick-add buttons */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { ml: 250, label: "Glass", sub: "250 ml" },
                { ml: 500, label: "Bottle", sub: "500 ml" },
                { ml: 1000, label: "Large", sub: "1 L" },
              ].map((opt) => (
                <button
                  key={opt.ml}
                  onClick={() => addWater(opt.ml)}
                  className="h-14 rounded-xl bg-blue-500/10 hover:bg-blue-500/15 active:scale-[0.97] transition-all flex flex-col items-center justify-center gap-0.5"
                >
                  <span className="text-[11px] font-bold text-blue-600">
                    + {opt.label}
                  </span>
                  <span className="text-[10px] text-blue-600/70 font-semibold">
                    {opt.sub}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Weight */}
          <button
            onClick={() => {
              setWeightInput(currentWeight?.toString() || "");
              setWeightDialogOpen(true);
            }}
            className="w-full rounded-2xl bg-card border border-border/40 p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
          >
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Scale className="h-5 w-5 text-purple-500" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-bold">Weight</p>
              <p className="text-[11px] text-muted-foreground">
                {currentWeight != null ? `${currentWeight} kg logged` : "Tap to log"}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
          </button>

          {/* Mood */}
          <div className="rounded-2xl bg-card border border-border/40 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Smile className="h-5 w-5 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">How do you feel?</p>
                <p className="text-[11px] text-muted-foreground">
                  {currentMood
                    ? MOOD_OPTIONS.find((m) => m.value === currentMood)?.label
                    : "Pick one"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {MOOD_OPTIONS.map((m) => {
                const Icon = m.icon;
                const selected = currentMood === m.value;
                return (
                  <button
                    key={m.value}
                    onClick={() => setMood(m.value)}
                    className={cn(
                      "aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all active:scale-90",
                      selected
                        ? "bg-primary/10 ring-2 ring-primary"
                        : "bg-muted/50 hover:bg-muted"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-6 w-6",
                        selected ? m.color : "text-muted-foreground"
                      )}
                    />
                    <span
                      className={cn(
                        "text-[10px] font-semibold",
                        selected ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {m.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </FormGroup>

        {/* ═══════ GYM MODE ENTRY (opt-in) ═══════ */}
        {goals?.gym_mode_enabled && (
          <Link href="/wellness/gym" className="block">
            <div className="rounded-2xl bg-gradient-to-br from-primary/15 via-primary/8 to-transparent border border-primary/30 p-4 flex items-center gap-3 active:scale-[0.98] transition-transform">
              <div className="h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
                <Zap className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">Gym Session</p>
                <p className="text-[11px] text-muted-foreground">
                  Log routines, sets, and weights
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
            </div>
          </Link>
        )}

        {/* ═══════ WORKOUTS ═══════ */}
        <FormGroup title="Workouts">
          <div className="rounded-2xl bg-card border border-border/40 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Dumbbell className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-bold">This week</p>
                  <p className="text-[11px] text-muted-foreground">
                    {workoutsThisWeek} / {weeklyTarget} days
                  </p>
                </div>
              </div>
              <Link href="/wellness/workout/add">
                <button className="h-9 px-3.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-transform">
                  <Plus className="h-3.5 w-3.5" />
                  Log
                </button>
              </Link>
            </div>
            {/* Week bar */}
            <div className="flex items-center gap-1 mb-3">
              {Array.from({ length: 7 }).map((_, i) => {
                const filled = i < workoutsThisWeek;
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex-1 h-2 rounded-full transition-colors",
                      filled ? "bg-emerald-500" : "bg-muted/60"
                    )}
                  />
                );
              })}
            </div>

            {workouts.length === 0 ? (
              <Link href="/wellness/workout/add" className="block">
                <div className="rounded-xl border-2 border-dashed border-border/60 p-4 flex items-center gap-3 active:scale-[0.98] transition-transform">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Plus className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold">Log your first workout</p>
                    <p className="text-[11px] text-muted-foreground">
                      Even 10 minutes counts
                    </p>
                  </div>
                </div>
              </Link>
            ) : (
              <div className="space-y-2">
                {workouts.slice(0, 3).map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center gap-3 py-2 border-t border-border/30 first:border-t-0 first:pt-0"
                  >
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <Dumbbell className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold capitalize truncate">
                        {w.name || w.type}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {w.duration_min} min · {w.intensity}
                      </p>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(w.date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                ))}
                {workouts.length > 3 && (
                  <Link
                    href="/wellness/workout"
                    className="block text-center text-[11px] font-bold text-primary py-2"
                  >
                    View all {workouts.length} workouts
                  </Link>
                )}
              </div>
            )}
          </div>
        </FormGroup>

        {/* ═══════ WEEKLY INSIGHTS ═══════ */}
        <FormGroup title="This week">
          <div className="grid grid-cols-2 gap-3">
            <InsightCard
              label="Workouts"
              value={`${workoutsThisWeek}/${weeklyTarget}`}
              sublabel="days"
              color="text-emerald-500"
              bg="bg-emerald-500/10"
              icon={Dumbbell}
            />
            <InsightCard
              label="Avg water"
              value={formatLitres(avgWaterMl(recentEntries.slice(-7)))}
              sublabel="L / day"
              color="text-blue-500"
              bg="bg-blue-500/10"
              icon={Droplet}
            />
            <InsightCard
              label="Days logged"
              value={`${daysLogged(recentEntries.slice(-7))}/7`}
              sublabel="this week"
              color="text-amber-500"
              bg="bg-amber-500/10"
              icon={Target}
            />
            <InsightCard
              label="Weight"
              value={latestWeight(recentEntries)?.toString() || "—"}
              sublabel={latestWeight(recentEntries) ? "kg" : "not logged"}
              color="text-purple-500"
              bg="bg-purple-500/10"
              icon={Scale}
            />
          </div>
        </FormGroup>
      </div>

      {/* ═══════ WEIGHT DIALOG ═══════ */}
      <Dialog open={weightDialogOpen} onOpenChange={setWeightDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log weight</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <FormField label="Weight (kg)">
              <FormInput
                type="number"
                inputMode="decimal"
                step="0.1"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                placeholder="e.g. 65.5"
                autoFocus
              />
            </FormField>
            <Button
              onClick={handleWeightSave}
              className="w-full h-12 rounded-xl text-[15px] font-semibold shadow-md shadow-primary/15 transition-transform active:scale-[0.98]"
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InsightCard({
  label,
  value,
  sublabel,
  color,
  bg,
  icon: Icon,
}: {
  label: string;
  value: string;
  sublabel: string;
  color: string;
  bg: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl bg-card border border-border/40 p-4">
      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center mb-2", bg)}>
        <Icon className={cn("h-4 w-4", color)} />
      </div>
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <div className="flex items-baseline gap-1 mt-0.5">
        <span className="text-xl font-extrabold tracking-tight">{value}</span>
        <span className="text-[10px] text-muted-foreground">{sublabel}</span>
      </div>
    </div>
  );
}

function avgWaterMl(entries: { water_ml?: number }[]): number {
  if (!entries.length) return 0;
  return (
    entries.reduce((s, e) => s + (e.water_ml || 0), 0) / entries.length
  );
}

function daysLogged(entries: { water_ml?: number; weight_kg?: number; mood?: string }[]): number {
  return entries.filter(
    (e) => (e.water_ml ?? 0) > 0 || e.weight_kg != null || e.mood
  ).length;
}

/** Format millilitres as a clean litre string. 1750 → "1.75", 2000 → "2", 500 → "0.5". */
function formatLitres(ml: number): string {
  const l = ml / 1000;
  if (Number.isInteger(l)) return l.toString();
  return l.toFixed(l >= 10 ? 1 : 2).replace(/\.?0+$/, "");
}

function latestWeight(entries: { weight_kg?: number; date: string }[]): number | null {
  const withWeight = entries.filter((e) => e.weight_kg != null);
  if (!withWeight.length) return null;
  withWeight.sort((a, b) => (a.date < b.date ? 1 : -1));
  return withWeight[0].weight_kg ?? null;
}
