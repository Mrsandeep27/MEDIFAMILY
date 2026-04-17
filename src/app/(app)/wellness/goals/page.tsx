"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import {
  FormField,
  FormGroup,
  FormInput,
  FormStickyAction,
} from "@/components/ui/form-primitives";
import { useWellness } from "@/hooks/use-wellness";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function WellnessGoalsPage() {
  const router = useRouter();
  const { goals, ensureGoals, updateGoals } = useWellness();
  const [waterTarget, setWaterTarget] = useState("8");
  const [weeklyWorkouts, setWeeklyWorkouts] = useState("4");
  const [weightTarget, setWeightTarget] = useState("");
  const [calorieTarget, setCalorieTarget] = useState("");
  const [calorieEnabled, setCalorieEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Ensure a goals row exists on first visit
    ensureGoals().catch(() => {});
  }, []);

  useEffect(() => {
    if (!goals || hydrated) return;
    setWaterTarget(goals.water_target_glasses?.toString() || "8");
    setWeeklyWorkouts(goals.workout_days_per_week?.toString() || "4");
    setWeightTarget(goals.weight_target_kg?.toString() || "");
    setCalorieTarget(goals.daily_calorie_target?.toString() || "");
    setCalorieEnabled(goals.calorie_tracking_enabled ?? false);
    setHydrated(true);
  }, [goals, hydrated]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateGoals({
        water_target_glasses: Math.max(1, Math.min(20, parseInt(waterTarget || "8", 10))),
        workout_days_per_week: Math.max(0, Math.min(7, parseInt(weeklyWorkouts || "4", 10))),
        weight_target_kg: weightTarget ? parseFloat(weightTarget) : undefined,
        daily_calorie_target: calorieTarget ? parseInt(calorieTarget, 10) : undefined,
        calorie_tracking_enabled: calorieEnabled,
      });
      toast.success("Goals updated");
      router.back();
    } catch {
      toast.error("Failed to save goals");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pb-32">
      <AppHeader title="Wellness goals" showBack />

      <div className="p-4">
        <FormGroup title="Daily targets">
          <FormField
            label="Water glasses per day"
            hint="Recommended: 8 glasses (≈ 2 litres)"
          >
            <FormInput
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              value={waterTarget}
              onChange={(e) => setWaterTarget(e.target.value)}
            />
          </FormField>

          <FormField
            label="Workout days per week"
            hint="Aim for 3–5 days to stay consistent"
          >
            <FormInput
              type="number"
              inputMode="numeric"
              min={0}
              max={7}
              value={weeklyWorkouts}
              onChange={(e) => setWeeklyWorkouts(e.target.value)}
            />
          </FormField>

          <FormField label="Weight goal (kg)" optional>
            <FormInput
              type="number"
              inputMode="decimal"
              step="0.1"
              value={weightTarget}
              onChange={(e) => setWeightTarget(e.target.value)}
              placeholder="e.g. 65.0"
            />
          </FormField>
        </FormGroup>

        <FormGroup title="Calorie tracking">
          <div className="rounded-2xl bg-card border border-border/40 p-4 flex items-center justify-between">
            <div className="flex-1 min-w-0 pr-3">
              <p className="text-sm font-bold">Track calories</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Add a manual calorie log to your day. You can turn it off anytime.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCalorieEnabled(!calorieEnabled)}
              className={cn(
                "relative h-7 w-12 rounded-full transition-colors shrink-0",
                calorieEnabled ? "bg-primary" : "bg-muted"
              )}
              aria-label="Toggle calorie tracking"
            >
              <span
                className={cn(
                  "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform",
                  calorieEnabled ? "translate-x-5" : "translate-x-0.5"
                )}
              />
            </button>
          </div>
          {calorieEnabled && (
            <FormField
              label="Daily calorie target"
              hint="Adults typically 1800–2400 kcal. Ask your doctor if unsure."
            >
              <FormInput
                type="number"
                inputMode="numeric"
                value={calorieTarget}
                onChange={(e) => setCalorieTarget(e.target.value)}
                placeholder="e.g. 2000"
              />
            </FormField>
          )}
        </FormGroup>
      </div>

      <FormStickyAction>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-2xl text-[15px] font-semibold shadow-lg shadow-primary/15 transition-transform active:scale-[0.98]"
          style={{ height: "52px" }}
        >
          {saving ? "Saving..." : "Save goals"}
        </Button>
      </FormStickyAction>
    </div>
  );
}
