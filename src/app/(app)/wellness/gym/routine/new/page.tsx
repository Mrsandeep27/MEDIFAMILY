"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Check, Search, GripVertical, X } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import {
  FormField,
  FormGroup,
  FormInput,
  FormStickyAction,
} from "@/components/ui/form-primitives";
import { useExercises, useRoutines } from "@/hooks/use-gym";
import type { MuscleGroup } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MUSCLE_FILTERS: { value: MuscleGroup | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "chest", label: "Chest" },
  { value: "back", label: "Back" },
  { value: "legs", label: "Legs" },
  { value: "shoulders", label: "Shoulders" },
  { value: "arms", label: "Arms" },
  { value: "core", label: "Core" },
  { value: "full_body", label: "Full" },
];

export default function NewRoutinePage() {
  const router = useRouter();
  const { exercises, isLoading } = useExercises();
  const { addRoutine } = useRoutines();

  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<MuscleGroup | "all">("all");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return exercises.filter((e) => {
      if (filter !== "all" && e.muscle_group !== filter) return false;
      if (term && !e.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [exercises, filter, search]);

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const reorder = (from: number, to: number) => {
    setSelectedIds((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Give your routine a name");
      return;
    }
    if (selectedIds.length === 0) {
      toast.error("Pick at least one exercise");
      return;
    }
    setSaving(true);
    try {
      await addRoutine(name.trim(), selectedIds);
      toast.success("Routine saved");
      router.replace("/wellness/gym");
    } catch {
      toast.error("Failed to save routine");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div>
        <AppHeader title="New routine" showBack />
        <LoadingSpinner className="py-12" />
      </div>
    );
  }

  const selectedExercises = selectedIds
    .map((id) => exercises.find((e) => e.id === id))
    .filter(Boolean);

  return (
    <div className="pb-32">
      <AppHeader title="New routine" showBack />

      <div className="p-4">
        <FormGroup title="Routine">
          <FormField label="Name">
            <FormInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Push Day, Leg Day"
              maxLength={60}
            />
          </FormField>
        </FormGroup>

        {/* Selected list */}
        {selectedExercises.length > 0 && (
          <FormGroup
            title={`Selected (${selectedExercises.length})`}
          >
            <div className="space-y-2">
              {selectedExercises.map((ex, i) => (
                <div
                  key={ex!.id}
                  className="rounded-xl bg-primary/5 border border-primary/20 px-3 py-2.5 flex items-center gap-2"
                >
                  <div className="flex flex-col items-center justify-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => i > 0 && reorder(i, i - 1)}
                      disabled={i === 0}
                      className="text-muted-foreground/40 disabled:opacity-20 active:scale-90 transition-transform"
                      aria-label="Move up"
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                  </div>
                  <span className="text-[11px] font-bold text-muted-foreground w-5 text-right">
                    {i + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold truncate">{ex!.name}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">
                      {ex!.muscle_group.replace("_", " ")} · {ex!.equipment}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle(ex!.id)}
                    className="h-7 w-7 rounded-full bg-muted/60 hover:bg-destructive/10 hover:text-destructive flex items-center justify-center active:scale-90 transition-all"
                    aria-label="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </FormGroup>
        )}

        {/* Search + filter */}
        <FormGroup title="Add exercises">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <FormInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exercises..."
              className="pl-11"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 py-1">
            {MUSCLE_FILTERS.map((opt) => {
              const active = filter === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setFilter(opt.value)}
                  className={cn(
                    "shrink-0 h-9 px-4 rounded-full text-[12px] font-bold transition-all active:scale-95",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5 mt-2">
            {filtered.length === 0 ? (
              <p className="text-[12px] text-muted-foreground text-center py-6">
                No exercises match. Try a different search.
              </p>
            ) : (
              filtered.map((ex) => {
                const selected = selectedIds.includes(ex.id);
                return (
                  <button
                    key={ex.id}
                    onClick={() => toggle(ex.id)}
                    className={cn(
                      "w-full rounded-xl px-3 py-2.5 flex items-center gap-3 transition-all active:scale-[0.98]",
                      selected
                        ? "bg-primary/10 border border-primary/30"
                        : "bg-muted/40 hover:bg-muted/60"
                    )}
                  >
                    <div
                      className={cn(
                        "h-6 w-6 rounded-md flex items-center justify-center shrink-0 transition-colors",
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "bg-background border border-border"
                      )}
                    >
                      {selected && <Check className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-[13px] font-bold truncate">{ex.name}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">
                        {ex.muscle_group.replace("_", " ")} · {ex.equipment}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </FormGroup>
      </div>

      <FormStickyAction>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-2xl text-[15px] font-semibold shadow-lg shadow-primary/15 transition-transform active:scale-[0.98]"
          style={{ height: "52px" }}
        >
          {saving
            ? "Saving..."
            : selectedIds.length > 0
            ? `Save routine (${selectedIds.length})`
            : "Save routine"}
        </Button>
      </FormStickyAction>
    </div>
  );
}
