"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dumbbell,
  Heart,
  Flower2,
  Footprints,
  Bike,
  Trophy,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import {
  FormField,
  FormGroup,
  FormInput,
  FormPillGroup,
  FormStickyAction,
  FormTextarea,
} from "@/components/ui/form-primitives";
import { useWorkouts } from "@/hooks/use-workouts";
import type { WorkoutIntensity, WorkoutType } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const WORKOUT_TYPES: {
  value: WorkoutType;
  label: string;
  icon: React.ElementType;
  color: string;
}[] = [
  { value: "cardio", label: "Cardio", icon: Heart, color: "text-rose-500" },
  { value: "strength", label: "Strength", icon: Dumbbell, color: "text-emerald-500" },
  { value: "yoga", label: "Yoga", icon: Flower2, color: "text-violet-500" },
  { value: "walk", label: "Walk", icon: Footprints, color: "text-blue-500" },
  { value: "cycle", label: "Cycle", icon: Bike, color: "text-amber-500" },
  { value: "sports", label: "Sports", icon: Trophy, color: "text-orange-500" },
  { value: "custom", label: "Other", icon: Sparkles, color: "text-purple-500" },
];

export default function AddWorkoutPage() {
  const router = useRouter();
  const { addWorkout } = useWorkouts();
  const [type, setType] = useState<WorkoutType>("cardio");
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(30);
  const [intensity, setIntensity] = useState<WorkoutIntensity>("moderate");
  const [distance, setDistance] = useState("");
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);

  const isCardio = type === "cardio" || type === "walk" || type === "cycle";
  const isStrength = type === "strength";

  const handleSave = async () => {
    if (duration < 1) {
      toast.error("Duration must be at least 1 minute");
      return;
    }
    setSaving(true);
    try {
      await addWorkout({
        date: new Date().toISOString().split("T")[0],
        type,
        name: name.trim() || undefined,
        duration_min: duration,
        intensity,
        distance_km: isCardio && distance ? parseFloat(distance) : undefined,
        sets: isStrength && sets ? parseInt(sets, 10) : undefined,
        reps: isStrength && reps ? parseInt(reps, 10) : undefined,
        weight_kg: isStrength && weight ? parseFloat(weight) : undefined,
        notes: notes.trim() || undefined,
      });
      toast.success("Workout logged!");
      router.back();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save workout");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pb-32">
      <AppHeader title="Log workout" showBack />

      <div className="p-4">
        {/* Type selector */}
        <FormGroup title="Type">
          <div className="grid grid-cols-4 gap-2">
            {WORKOUT_TYPES.map((opt) => {
              const Icon = opt.icon;
              const selected = type === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setType(opt.value)}
                  className={cn(
                    "aspect-square rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95",
                    selected
                      ? "bg-primary/10 ring-2 ring-primary"
                      : "bg-muted/60 hover:bg-muted"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5",
                      selected ? opt.color : "text-muted-foreground"
                    )}
                  />
                  <span className="text-[11px] font-semibold">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </FormGroup>

        <FormGroup title="Details">
          <FormField label="Name" optional>
            <FormInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                type === "strength"
                  ? "e.g. Bench press, Squats"
                  : type === "cardio"
                  ? "e.g. Morning run"
                  : "Workout name"
              }
            />
          </FormField>

          <FormField label={`Duration: ${duration} min`}>
            <input
              type="range"
              min={5}
              max={180}
              step={5}
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value, 10))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground px-1">
              <span>5</span>
              <span>60</span>
              <span>120</span>
              <span>180</span>
            </div>
          </FormField>

          <FormField label="Intensity">
            <FormPillGroup
              value={intensity}
              onChange={(v) => setIntensity(v)}
              options={[
                { value: "light", label: "Light" },
                { value: "moderate", label: "Moderate" },
                { value: "intense", label: "Intense" },
              ]}
            />
          </FormField>
        </FormGroup>

        {/* Optional advanced fields */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between px-1 py-4 text-[14px] font-medium text-foreground/80 hover:text-foreground transition-colors"
        >
          <span>More details</span>
          {showAdvanced ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {showAdvanced && (
          <div className="animate-in fade-in slide-in-from-top-1 duration-200">
            {isCardio && (
              <FormGroup title="Cardio">
                <FormField label="Distance (km)" optional>
                  <FormInput
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                    placeholder="e.g. 5.0"
                  />
                </FormField>
              </FormGroup>
            )}

            {isStrength && (
              <FormGroup title="Strength">
                <div className="grid grid-cols-3 gap-3">
                  <FormField label="Sets" optional>
                    <FormInput
                      type="number"
                      inputMode="numeric"
                      value={sets}
                      onChange={(e) => setSets(e.target.value)}
                      placeholder="3"
                    />
                  </FormField>
                  <FormField label="Reps" optional>
                    <FormInput
                      type="number"
                      inputMode="numeric"
                      value={reps}
                      onChange={(e) => setReps(e.target.value)}
                      placeholder="10"
                    />
                  </FormField>
                  <FormField label="Weight (kg)" optional>
                    <FormInput
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      placeholder="20"
                    />
                  </FormField>
                </div>
              </FormGroup>
            )}

            <FormGroup title="Notes">
              <FormField label="How did it go?" optional>
                <FormTextarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any thoughts about this workout..."
                />
              </FormField>
            </FormGroup>
          </div>
        )}
      </div>

      <FormStickyAction>
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-2xl text-[15px] font-semibold shadow-lg shadow-primary/15 transition-transform active:scale-[0.98]"
          style={{ height: "52px" }}
        >
          {saving ? "Saving..." : "Log workout"}
        </Button>
      </FormStickyAction>
    </div>
  );
}
