"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  X,
  CheckCircle2,
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FormField,
  FormGroup,
  FormInput,
  FormTextarea,
} from "@/components/ui/form-primitives";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/dexie";
import {
  useExercises,
  useRoutines,
  useGymSessionSets,
  lastSetForExercise,
  useGymSessions,
} from "@/hooks/use-gym";
import { useAuthStore } from "@/stores/auth-store";
import type { Exercise } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function GymSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;

  const session = useLiveQuery(
    () => db.gymSessions.get(sessionId),
    [sessionId]
  );
  const { exercises } = useExercises();
  const { routines } = useRoutines();
  const { sets, addSet, deleteSet } = useGymSessionSets(sessionId);
  const { endSession, deleteSession } = useGymSessions();

  // Per-exercise UI state: which exercises are added to this session,
  // in what order, plus the "draft" (next-set) weight/reps inputs.
  const [sessionExerciseIds, setSessionExerciseIds] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  const [exercisePickerOpen, setExercisePickerOpen] = useState(false);
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [endNotes, setEndNotes] = useState("");
  const [ending, setEnding] = useState(false);

  // Initialize session exercises from routine (if any) or from sets that already exist
  useEffect(() => {
    if (initialized || !session || !exercises.length) return;

    const fromSets = Array.from(new Set(sets.map((s) => s.exercise_id)));
    if (fromSets.length > 0) {
      setSessionExerciseIds(fromSets);
      setInitialized(true);
      return;
    }

    if (session.routine_id) {
      const routine = routines.find((r) => r.id === session.routine_id);
      if (routine) {
        setSessionExerciseIds(routine.exercise_ids);
        setInitialized(true);
        return;
      }
    }

    setInitialized(true);
  }, [session, exercises, routines, sets, initialized]);

  if (!session) {
    return (
      <div>
        <AppHeader title="Session" showBack />
        <LoadingSpinner className="py-12" />
      </div>
    );
  }

  if (session.ended_at) {
    // Session is already finished; redirect back
    router.replace("/wellness/gym");
    return null;
  }

  const addExercise = (id: string) => {
    setSessionExerciseIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setExercisePickerOpen(false);
  };

  const removeExerciseFromSession = (id: string) => {
    // Only remove if no sets logged for it
    const hasSets = sets.some((s) => s.exercise_id === id);
    if (hasSets) {
      toast.error("Delete all sets first");
      return;
    }
    setSessionExerciseIds((prev) => prev.filter((x) => x !== id));
  };

  const handleEnd = async () => {
    // Don't save empty sessions — they clutter history with no value.
    // Offer to discard instead.
    if (sets.length === 0) {
      const discard = confirm(
        "No sets logged yet. Discard this session? (It won't appear in your history.)"
      );
      if (!discard) return;
      setEnding(true);
      try {
        await deleteSession(sessionId);
        toast.success("Session discarded");
        router.replace("/wellness/gym");
      } catch {
        toast.error("Failed to discard session");
        setEnding(false);
      }
      return;
    }
    setEnding(true);
    try {
      await endSession(sessionId, endNotes);
      toast.success("Session saved");
      router.replace("/wellness/gym");
    } catch {
      toast.error("Failed to end session");
      setEnding(false);
    }
  };

  const totalSets = sets.length;
  const totalVolume = sets.reduce(
    (sum, s) => sum + (s.weight_kg || 0) * (s.reps || 0),
    0
  );

  return (
    <div className="pb-32">
      <AppHeader
        title={session.routine_name || "Quick session"}
        showBack
        rightAction={
          <button
            onClick={() => setEndDialogOpen(true)}
            className="h-9 px-3.5 rounded-full bg-emerald-500 text-white text-[12px] font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-transform"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Finish
          </button>
        }
      />

      <div className="p-4 space-y-4">
        {/* Stats strip */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Sets" value={totalSets.toString()} />
          <StatCard label="Volume" value={`${Math.round(totalVolume)} kg`} />
        </div>

        {/* Per-exercise cards */}
        {sessionExerciseIds.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border/60 p-6 text-center">
            <p className="text-sm font-bold">No exercises yet</p>
            <p className="text-[12px] text-muted-foreground mt-1 mb-4">
              Add exercises to start logging sets
            </p>
            <button
              onClick={() => setExercisePickerOpen(true)}
              className="h-10 px-5 rounded-full bg-primary text-primary-foreground text-[13px] font-bold flex items-center gap-2 mx-auto active:scale-95 transition-transform"
            >
              <Plus className="h-4 w-4" />
              Add exercise
            </button>
          </div>
        ) : (
          <>
            {sessionExerciseIds.map((exId) => {
              const exercise = exercises.find((e) => e.id === exId);
              if (!exercise) return null;
              const exSets = sets.filter((s) => s.exercise_id === exId);
              return (
                <ExerciseCard
                  key={exId}
                  exercise={exercise}
                  sets={exSets}
                  userId={userId || ""}
                  onAddSet={async (weight, reps) => {
                    await addSet({
                      session_id: sessionId,
                      exercise_id: exId,
                      exercise_name: exercise.name,
                      set_number: exSets.length + 1,
                      weight_kg: weight,
                      reps,
                    });
                  }}
                  onDeleteSet={deleteSet}
                  onRemoveExercise={() => removeExerciseFromSession(exId)}
                />
              );
            })}

            <button
              onClick={() => setExercisePickerOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-border/60 text-sm font-bold text-primary hover:bg-muted/30 transition-colors active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              Add exercise
            </button>
          </>
        )}
      </div>

      {/* Exercise picker */}
      <Dialog open={exercisePickerOpen} onOpenChange={setExercisePickerOpen}>
        <DialogContent className="max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Pick exercise</DialogTitle>
          </DialogHeader>
          <ExercisePicker
            exercises={exercises.filter(
              (e) => !sessionExerciseIds.includes(e.id)
            )}
            onPick={addExercise}
          />
        </DialogContent>
      </Dialog>

      {/* End session dialog */}
      <Dialog open={endDialogOpen} onOpenChange={setEndDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finish session?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-xl bg-muted/40 p-3 space-y-1">
              <p className="text-[13px]">
                <span className="font-bold">{totalSets}</span> sets logged
              </p>
              <p className="text-[13px]">
                <span className="font-bold">{Math.round(totalVolume)} kg</span>{" "}
                total volume
              </p>
            </div>
            <FormGroup title="Notes">
              <FormField label="How did it go?" optional>
                <FormTextarea
                  rows={3}
                  value={endNotes}
                  onChange={(e) => setEndNotes(e.target.value)}
                  placeholder="Any thoughts about this session..."
                />
              </FormField>
            </FormGroup>
            <Button
              onClick={handleEnd}
              disabled={ending}
              className="w-full h-12 rounded-xl text-[15px] font-semibold shadow-md shadow-primary/15"
            >
              {ending ? "Saving..." : "Finish session"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border/40 p-4">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <p className="text-2xl font-extrabold tracking-tight mt-1">{value}</p>
    </div>
  );
}

// ─── Exercise card with set logger ──────────────────────────────────────

function ExerciseCard({
  exercise,
  sets,
  userId,
  onAddSet,
  onDeleteSet,
  onRemoveExercise,
}: {
  exercise: Exercise;
  sets: {
    id: string;
    set_number: number;
    weight_kg: number;
    reps: number;
  }[];
  userId: string;
  onAddSet: (weight: number, reps: number) => Promise<void>;
  onDeleteSet: (id: string) => Promise<void>;
  onRemoveExercise: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [saving, setSaving] = useState(false);

  // Prefill from the last set in this session, or from last session ever
  useEffect(() => {
    if (sets.length > 0) {
      const last = sets[sets.length - 1];
      setWeight(last.weight_kg.toString());
      setReps(last.reps.toString());
    } else if (userId) {
      lastSetForExercise(userId, exercise.id)
        .then((last) => {
          if (last) {
            setWeight(last.weight_kg.toString());
            setReps(last.reps.toString());
          }
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id, userId]);

  const handleAdd = async () => {
    const w = parseFloat(weight);
    const r = parseInt(reps, 10);
    if (isNaN(w) || w < 0) {
      toast.error("Enter a valid weight");
      return;
    }
    if (isNaN(r) || r < 1) {
      toast.error("Enter a valid rep count");
      return;
    }
    setSaving(true);
    try {
      await onAddSet(w, r);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl bg-card border border-border/40 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3"
      >
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-bold truncate">{exercise.name}</p>
          <p className="text-[11px] text-muted-foreground capitalize">
            {exercise.muscle_group.replace("_", " ")} · {sets.length} set
            {sets.length === 1 ? "" : "s"}
          </p>
        </div>
        {sets.length === 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveExercise();
            }}
            className="h-7 w-7 rounded-full bg-muted/60 hover:bg-destructive/10 hover:text-destructive flex items-center justify-center active:scale-90 transition-all"
            aria-label="Remove exercise"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground/60" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground/60" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3">
          {/* Existing sets */}
          {sets.length > 0 && (
            <div className="space-y-1.5">
              {sets.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2"
                >
                  <span className="text-[11px] font-bold text-muted-foreground w-6">
                    #{s.set_number}
                  </span>
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-[13px] font-bold">
                      {s.weight_kg} kg
                    </span>
                    <span className="text-[11px] text-muted-foreground">×</span>
                    <span className="text-[13px] font-bold">{s.reps}</span>
                    <span className="text-[11px] text-muted-foreground">reps</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteSet(s.id)}
                    className="h-6 w-6 rounded-full text-muted-foreground/40 hover:text-destructive flex items-center justify-center active:scale-90 transition-all"
                    aria-label="Delete set"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add new set */}
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                Weight (kg)
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="0"
                className="w-full h-11 rounded-xl bg-muted/60 border-0 px-3 text-[15px] font-bold text-center placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                Reps
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                placeholder="0"
                className="w-full h-11 rounded-xl bg-muted/60 border-0 px-3 text-[15px] font-bold text-center placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              />
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving}
              className="h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm shadow-primary/20 active:scale-95 transition-transform disabled:opacity-50"
              aria-label="Log set"
            >
              <Check className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Exercise picker (inside dialog) ────────────────────────────────────

function ExercisePicker({
  exercises,
  onPick,
}: {
  exercises: Exercise[];
  onPick: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return exercises;
    return exercises.filter((e) => e.name.toLowerCase().includes(term));
  }, [exercises, search]);

  return (
    <div className="flex flex-col min-h-0 gap-3 pt-2">
      <FormInput
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search..."
        autoFocus
      />
      <div className="flex-1 overflow-y-auto min-h-0 -mx-1 px-1 space-y-1">
        {filtered.map((ex) => (
          <button
            key={ex.id}
            onClick={() => onPick(ex.id)}
            className={cn(
              "w-full rounded-xl px-3 py-2.5 flex items-center gap-3 bg-muted/40 hover:bg-muted/60 transition-all active:scale-[0.98]"
            )}
          >
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[13px] font-bold truncate">{ex.name}</p>
              <p className="text-[10px] text-muted-foreground capitalize">
                {ex.muscle_group.replace("_", " ")} · {ex.equipment}
              </p>
            </div>
            <Plus className="h-4 w-4 text-primary" />
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-[12px] text-muted-foreground text-center py-6">
            No exercises match.
          </p>
        )}
      </div>
    </div>
  );
}
