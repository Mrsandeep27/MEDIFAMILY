"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Flame,
  Droplet,
  Scale,
  Minus,
  Dumbbell,
  Play,
  Brain,
  Wind,
  Apple,
  ChevronRight,
  Bell,
} from "lucide-react";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { Button } from "@/components/ui/button";
import {
  FormField,
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function WellnessPage() {
  const {
    todayEntry,
    recentEntries,
    goals,
    isLoading,
    addWater,
    setWeight,
  } = useWellness();
  const { workouts } = useWorkouts();

  const [weightDialogOpen, setWeightDialogOpen] = useState(false);
  const [weightInput, setWeightInput] = useState("");

  if (isLoading) {
    return <LoadingSpinner className="py-12" />;
  }

  const waterTargetMl = goals?.water_target_ml ?? 2000;
  const weeklyTarget = goals?.workout_days_per_week ?? 4;
  const currentWaterMl = todayEntry?.water_ml ?? 0;
  const currentWeight = todayEntry?.weight_kg;

  const streak = computeStreak(recentEntries);
  const workoutsThisWeek = workoutDaysThisWeek(workouts);
  const score = computeHealthScore(
    recentEntries,
    workoutsThisWeek,
    waterTargetMl,
    weeklyTarget
  );

  const hasAnyActivity =
    recentEntries.length > 0 ||
    workoutsThisWeek > 0 ||
    (todayEntry?.water_ml ?? 0) > 0;

  const mostRecentWorkout = workouts[0];

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

  const todayLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // AI coach editorial copy, picked by current state
  const coachQuote = !hasAnyActivity
    ? "“Start where you are. Use what you have. Do what you can.”"
    : currentWaterMl < waterTargetMl / 2
    ? "“Halfway to today's hydration. Keep a glass within reach.”"
    : workoutsThisWeek === 0
    ? "“Ten minutes of movement beats none. Begin small.”"
    : "“Good pace today. A five-minute breath session would cap it off.”";

  // Gym hero state
  const gymInProgress = mostRecentWorkout != null && sameDay(mostRecentWorkout.date);
  const gymTitle = gymInProgress
    ? mostRecentWorkout?.name || "Today's workout"
    : workoutsThisWeek > 0
    ? "Next session"
    : "Begin.";

  return (
    <div className="pb-28">
      {/* Editorial header — serif + quiet kicker */}
      <div className="px-5 pt-6 pb-4 flex items-start justify-between">
        <div>
          <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Wellness · {todayLabel.toUpperCase()}
          </p>
          <h1 className="font-serif text-[34px] font-bold tracking-tight leading-none mt-1.5">
            Sandeep
          </h1>
        </div>
        <Link href="/wellness/goals" aria-label="Goals">
          <button className="h-9 w-9 rounded-xl bg-muted/60 border border-border/50 flex items-center justify-center active:scale-95 transition-transform">
            <Bell className="h-4 w-4" />
          </button>
        </Link>
      </div>

      <div className="px-4 space-y-4">
        {/* GYM cover block — full-bleed dark editorial */}
        <div
          className="relative rounded-3xl text-white overflow-hidden px-5 py-6"
          style={{
            background:
              "radial-gradient(ellipse at top right, rgba(255,255,255,0.12) 0%, transparent 55%), linear-gradient(135deg, #17171A 0%, #0B0B0C 100%)",
          }}
        >
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15">
            <Dumbbell className="h-3 w-3" />
            <span className="font-mono text-[9.5px] font-extrabold tracking-[0.16em]">
              TODAY&apos;S TRAINING
            </span>
          </div>
          <h2 className="font-serif text-[40px] font-bold tracking-tight leading-none mt-3">
            {gymTitle}
          </h2>

          <div className="mt-5 flex items-stretch gap-3 border-t border-white/10 pt-4">
            <GymMeta
              value={
                mostRecentWorkout?.duration_min != null
                  ? String(mostRecentWorkout.duration_min)
                  : hasAnyActivity
                  ? "—"
                  : "—"
              }
              label="MINUTES"
            />
            <MetaSeparator />
            <GymMeta
              value={
                workoutsThisWeek > 0 ? `${workoutsThisWeek}/${weeklyTarget}` : "—"
              }
              label="THIS WEEK"
            />
            <MetaSeparator />
            <GymMeta
              value={streak > 0 ? String(streak) : "—"}
              label="DAY STREAK"
            />
          </div>

          <Link
            href={
              goals?.gym_mode_enabled ? "/wellness/gym" : "/wellness/workout/add"
            }
            className="mt-5 inline-flex items-center gap-2 h-11 px-5 rounded-full bg-white text-foreground text-[13px] font-extrabold tracking-tight active:scale-95 transition-transform"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>
              {workoutsThisWeek === 0
                ? "Pick a workout"
                : gymInProgress
                ? "Resume workout"
                : "Start workout"}
            </span>
          </Link>
        </div>

        {/* AI coach editorial quote */}
        <div className="rounded-3xl bg-card border border-border/40 px-5 py-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Brain className="h-3 w-3" />
            <span className="font-mono text-[9.5px] font-extrabold uppercase tracking-[0.16em]">
              AI Coach · Today
            </span>
          </div>
          <p className="font-serif text-[22px] font-semibold tracking-tight leading-snug mt-2.5">
            {coachQuote}
          </p>
        </div>

        {/* Editorial metric mosaic */}
        <div className="grid grid-cols-3 gap-2.5">
          <MetricCard
            icon={Droplet}
            num={hasAnyActivity ? (currentWaterMl / 1000).toFixed(1) : "—"}
            unit="L"
            label="Hydration"
            sub={
              hasAnyActivity
                ? `of ${(waterTargetMl / 1000).toFixed(0)} L goal`
                : "Tap to start"
            }
          />
          <MetricCard
            icon={Apple}
            num={currentWeight != null ? String(currentWeight) : "—"}
            unit="kg"
            label="Weight"
            sub={currentWeight != null ? "Today" : "Tap to log"}
          />
          <MetricCard
            icon={Wind}
            num={streak > 0 ? String(streak) : "—"}
            unit="d"
            label="Streak"
            sub={streak > 0 ? "Daily checkins" : "Start a streak"}
          />
        </div>

        {/* Programs — editorial carousel row */}
        <div className="flex items-baseline justify-between pt-1">
          <h2 className="font-serif text-[22px] font-semibold tracking-tight">
            Programs
          </h2>
          <span className="font-mono text-[10px] font-bold tracking-wider text-muted-foreground">
            3 OF 12
          </span>
        </div>

        <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
          <ProgramCard
            tone="dark"
            kicker="4 WEEKS"
            title="Beginner Strength"
            sub="12 guided sessions"
            Icon={Dumbbell}
            href={
              goals?.gym_mode_enabled ? "/wellness/gym" : "/wellness/workout/add"
            }
          />
          <ProgramCard
            tone="sky"
            kicker="7 DAYS"
            title="Hydration Habit"
            sub="Daily reminders"
            Icon={Droplet}
            href="/wellness/goals"
          />
          <ProgramCard
            tone="lilac"
            kicker="5 MIN"
            title="Breathwork"
            sub="Start daily"
            Icon={Wind}
            href="/wellness/goals"
          />
        </div>

        {/* Water quick-add — still needed as core daily function */}
        <div className="rounded-2xl bg-card border border-border/40 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Droplet className="h-5 w-5 text-blue-500 fill-blue-500/30" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">Log water</p>
              <p className="text-[11px] text-muted-foreground">
                {formatLitres(currentWaterMl)} / {formatLitres(waterTargetMl)} L today
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
          <div className="h-2 rounded-full bg-muted/60 overflow-hidden mb-3">
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-300 rounded-full"
              style={{
                width: `${Math.min(100, (currentWaterMl / waterTargetMl) * 100)}%`,
              }}
            />
          </div>
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

        {/* Weight + Mood — compact row */}
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

        {/* Streak indicator if active */}
        {streak > 0 && (
          <div className="flex items-center gap-1.5 px-1 text-[11px] font-semibold text-muted-foreground">
            <Flame className="h-3.5 w-3.5 text-orange-500" />
            <span>
              {streak} day streak · score {score}/100
            </span>
          </div>
        )}
      </div>

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

function GymMeta({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1">
      <p className="font-serif text-[26px] font-bold tracking-tight leading-none">
        {value}
      </p>
      <p className="font-mono text-[8.5px] font-extrabold uppercase tracking-[0.16em] text-white/55 mt-1">
        {label}
      </p>
    </div>
  );
}

function MetaSeparator() {
  return <span className="w-px bg-white/10" />;
}

function MetricCard({
  icon: Icon,
  num,
  unit,
  label,
  sub,
}: {
  icon: React.ElementType;
  num: string;
  unit?: string;
  label: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl bg-card border border-border/40 p-3.5">
      <div className="h-8 w-8 rounded-lg bg-muted/60 flex items-center justify-center text-foreground/70 mb-3">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <p className="font-serif text-[26px] font-bold tracking-tight leading-none">
        {num}
        {unit ? (
          <span className="text-[14px] font-semibold text-muted-foreground ml-0.5">
            {unit}
          </span>
        ) : null}
      </p>
      <p className="text-[12px] font-bold tracking-tight mt-1.5">{label}</p>
      <p className="text-[10.5px] text-muted-foreground font-medium mt-0.5 leading-snug">
        {sub}
      </p>
    </div>
  );
}

const PROGRAM_TONES = {
  dark: {
    bg: "bg-[#1A1A1E] text-white",
    kicker: "text-white/60",
    sub: "text-white/65",
    iconBg: "bg-white/10 text-white",
  },
  sky: {
    bg: "bg-[#E4EEF9] text-[#1E4E86]",
    kicker: "text-[#1E4E86]/70",
    sub: "text-[#1E4E86]/70",
    iconBg: "bg-[#1E4E86]/12 text-[#1E4E86]",
  },
  lilac: {
    bg: "bg-[#ECE7F6] text-[#4A3B7A]",
    kicker: "text-[#4A3B7A]/70",
    sub: "text-[#4A3B7A]/70",
    iconBg: "bg-[#4A3B7A]/12 text-[#4A3B7A]",
  },
};

function ProgramCard({
  tone,
  kicker,
  title,
  sub,
  Icon,
  href,
}: {
  tone: keyof typeof PROGRAM_TONES;
  kicker: string;
  title: string;
  sub: string;
  Icon: React.ElementType;
  href: string;
}) {
  const t = PROGRAM_TONES[tone];
  return (
    <Link
      href={href}
      className={cn(
        "shrink-0 w-[168px] rounded-2xl px-4 py-4 relative",
        t.bg
      )}
    >
      <p className={cn("font-mono text-[9.5px] font-extrabold tracking-[0.14em]", t.kicker)}>
        {kicker}
      </p>
      <p className="font-serif text-[17px] font-semibold tracking-tight leading-tight mt-1.5">
        {title}
      </p>
      <p className={cn("text-[11px] font-medium mt-1", t.sub)}>{sub}</p>
      <div
        className={cn(
          "mt-4 h-9 w-9 rounded-xl flex items-center justify-center",
          t.iconBg
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
    </Link>
  );
}

/** Format millilitres as a clean litre string. 1750 → "1.75", 2000 → "2", 500 → "0.5". */
function formatLitres(ml: number): string {
  const l = ml / 1000;
  if (Number.isInteger(l)) return l.toString();
  return l.toFixed(l >= 10 ? 1 : 2).replace(/\.?0+$/, "");
}

function sameDay(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}
