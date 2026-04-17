import type { Exercise, MuscleGroup, Equipment } from "./schema";

/**
 * Built-in exercise library. Seeded into Dexie once, on first enable of
 * Gym Mode, with `is_preset: true` and `user_id: null`.
 *
 * Covers the 40 most common exercises across major muscle groups. Users
 * can add custom ones on top of these.
 */
interface PresetSeed {
  name: string;
  muscle_group: MuscleGroup;
  equipment: Equipment;
}

export const EXERCISE_PRESETS: PresetSeed[] = [
  // Chest
  { name: "Bench Press", muscle_group: "chest", equipment: "barbell" },
  { name: "Incline Bench Press", muscle_group: "chest", equipment: "barbell" },
  { name: "Dumbbell Press", muscle_group: "chest", equipment: "dumbbell" },
  { name: "Dumbbell Fly", muscle_group: "chest", equipment: "dumbbell" },
  { name: "Push-up", muscle_group: "chest", equipment: "bodyweight" },
  { name: "Cable Crossover", muscle_group: "chest", equipment: "cable" },

  // Back
  { name: "Deadlift", muscle_group: "back", equipment: "barbell" },
  { name: "Bent-over Row", muscle_group: "back", equipment: "barbell" },
  { name: "Pull-up", muscle_group: "back", equipment: "bodyweight" },
  { name: "Lat Pulldown", muscle_group: "back", equipment: "cable" },
  { name: "Seated Cable Row", muscle_group: "back", equipment: "cable" },
  { name: "Dumbbell Row", muscle_group: "back", equipment: "dumbbell" },

  // Legs
  { name: "Squat", muscle_group: "legs", equipment: "barbell" },
  { name: "Front Squat", muscle_group: "legs", equipment: "barbell" },
  { name: "Leg Press", muscle_group: "legs", equipment: "machine" },
  { name: "Romanian Deadlift", muscle_group: "legs", equipment: "barbell" },
  { name: "Lunge", muscle_group: "legs", equipment: "dumbbell" },
  { name: "Leg Curl", muscle_group: "legs", equipment: "machine" },
  { name: "Leg Extension", muscle_group: "legs", equipment: "machine" },
  { name: "Calf Raise", muscle_group: "legs", equipment: "machine" },

  // Shoulders
  { name: "Overhead Press", muscle_group: "shoulders", equipment: "barbell" },
  { name: "Dumbbell Shoulder Press", muscle_group: "shoulders", equipment: "dumbbell" },
  { name: "Lateral Raise", muscle_group: "shoulders", equipment: "dumbbell" },
  { name: "Rear Delt Fly", muscle_group: "shoulders", equipment: "dumbbell" },
  { name: "Face Pull", muscle_group: "shoulders", equipment: "cable" },

  // Arms
  { name: "Barbell Curl", muscle_group: "arms", equipment: "barbell" },
  { name: "Dumbbell Curl", muscle_group: "arms", equipment: "dumbbell" },
  { name: "Hammer Curl", muscle_group: "arms", equipment: "dumbbell" },
  { name: "Tricep Pushdown", muscle_group: "arms", equipment: "cable" },
  { name: "Overhead Tricep Extension", muscle_group: "arms", equipment: "dumbbell" },
  { name: "Close-grip Bench Press", muscle_group: "arms", equipment: "barbell" },
  { name: "Dips", muscle_group: "arms", equipment: "bodyweight" },

  // Core
  { name: "Plank", muscle_group: "core", equipment: "bodyweight" },
  { name: "Crunches", muscle_group: "core", equipment: "bodyweight" },
  { name: "Hanging Leg Raise", muscle_group: "core", equipment: "bodyweight" },
  { name: "Russian Twist", muscle_group: "core", equipment: "bodyweight" },
  { name: "Cable Woodchopper", muscle_group: "core", equipment: "cable" },

  // Full body / misc
  { name: "Kettlebell Swing", muscle_group: "full_body", equipment: "kettlebell" },
  { name: "Burpee", muscle_group: "full_body", equipment: "bodyweight" },
  { name: "Farmer's Walk", muscle_group: "full_body", equipment: "dumbbell" },
];

/** Build seed Exercise rows ready to insert into Dexie. */
export function buildPresetExercises(now: string): Exercise[] {
  return EXERCISE_PRESETS.map((p, i) => ({
    id: `preset-${i}-${p.name.toLowerCase().replace(/\s+/g, "-")}`,
    user_id: null,
    name: p.name,
    muscle_group: p.muscle_group,
    equipment: p.equipment,
    is_preset: true,
    created_at: now,
    updated_at: now,
    sync_status: "synced",
    is_deleted: false,
  }));
}
