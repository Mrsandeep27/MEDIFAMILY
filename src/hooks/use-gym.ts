"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db/dexie";
import type {
  Exercise,
  GymSession,
  GymSet,
  MuscleGroup,
  Equipment,
  Routine,
} from "@/lib/db/schema";
import { buildPresetExercises } from "@/lib/db/exercise-presets";
import { useAuthStore } from "@/stores/auth-store";

const nowIso = () => new Date().toISOString();
const todayStr = () => new Date().toISOString().split("T")[0];

/** Seed preset exercises if the library is empty. Safe to call repeatedly. */
export async function seedPresetsIfNeeded() {
  const count = await db.exercises.filter((e) => e.is_preset).count();
  if (count > 0) return;
  const now = nowIso();
  await db.exercises.bulkAdd(buildPresetExercises(now));
}

// ─── Exercises ──────────────────────────────────────────────────────────

export function useExercises() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;

  const exercises = useLiveQuery(
    () =>
      db.exercises
        .filter(
          (e) =>
            !e.is_deleted &&
            (e.is_preset || (userId ? e.user_id === userId : false))
        )
        .toArray()
        .then((list) =>
          list.sort((a, b) => a.name.localeCompare(b.name))
        ),
    [userId]
  );

  const addCustomExercise = async (
    name: string,
    muscle_group: MuscleGroup,
    equipment: Equipment
  ): Promise<string> => {
    if (!userId) throw new Error("Not signed in");
    const id = uuidv4();
    const now = nowIso();
    const exercise: Exercise = {
      id,
      user_id: userId,
      name: name.trim(),
      muscle_group,
      equipment,
      is_preset: false,
      created_at: now,
      updated_at: now,
      sync_status: "pending",
      is_deleted: false,
    };
    await db.exercises.add(exercise);
    return id;
  };

  return {
    exercises: exercises ?? [],
    isLoading: exercises === undefined,
    addCustomExercise,
  };
}

// ─── Routines ───────────────────────────────────────────────────────────

export function useRoutines() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;

  const routines = useLiveQuery(
    () =>
      userId
        ? db.routines
            .where("user_id")
            .equals(userId)
            .filter((r) => !r.is_deleted)
            .toArray()
            .then((list) =>
              list.sort((a, b) => (a.created_at > b.created_at ? -1 : 1))
            )
        : [],
    [userId]
  );

  const addRoutine = async (
    name: string,
    exerciseIds: string[],
    description?: string
  ): Promise<string> => {
    if (!userId) throw new Error("Not signed in");
    const id = uuidv4();
    const now = nowIso();
    const routine: Routine = {
      id,
      user_id: userId,
      name: name.trim(),
      description: description?.trim() || undefined,
      exercise_ids: exerciseIds,
      created_at: now,
      updated_at: now,
      sync_status: "pending",
      is_deleted: false,
    };
    await db.routines.add(routine);
    return id;
  };

  const updateRoutine = async (id: string, patch: Partial<Routine>) => {
    await db.routines.update(id, {
      ...patch,
      updated_at: nowIso(),
      sync_status: "pending",
    });
  };

  const deleteRoutine = async (id: string) => {
    await db.routines.update(id, {
      is_deleted: true,
      updated_at: nowIso(),
      sync_status: "pending",
    });
  };

  return {
    routines: routines ?? [],
    isLoading: routines === undefined,
    addRoutine,
    updateRoutine,
    deleteRoutine,
  };
}

// ─── Sessions + Sets ────────────────────────────────────────────────────

export function useGymSessions() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;

  const sessions = useLiveQuery(
    () =>
      userId
        ? db.gymSessions
            .where("user_id")
            .equals(userId)
            .filter((s) => !s.is_deleted)
            .reverse()
            .sortBy("started_at")
        : [],
    [userId]
  );

  const startSession = async (
    routineId?: string,
    routineName?: string
  ): Promise<string> => {
    if (!userId) throw new Error("Not signed in");
    const id = uuidv4();
    const now = nowIso();
    const session: GymSession = {
      id,
      user_id: userId,
      routine_id: routineId,
      routine_name: routineName,
      date: todayStr(),
      started_at: now,
      created_at: now,
      updated_at: now,
      sync_status: "pending",
      is_deleted: false,
    };
    await db.gymSessions.add(session);
    return id;
  };

  const endSession = async (id: string, notes?: string) => {
    const session = await db.gymSessions.get(id);
    if (!session) return;
    const endedAt = new Date();
    const started = new Date(session.started_at);
    const duration = Math.max(
      1,
      Math.round((endedAt.getTime() - started.getTime()) / 60000)
    );
    await db.gymSessions.update(id, {
      ended_at: endedAt.toISOString(),
      duration_min: duration,
      notes: notes?.trim() || undefined,
      updated_at: nowIso(),
      sync_status: "pending",
    });
  };

  const deleteSession = async (id: string) => {
    await db.gymSessions.update(id, {
      is_deleted: true,
      updated_at: nowIso(),
      sync_status: "pending",
    });
    // Also soft-delete sets (kept joined for analytics later)
    const sets = await db.gymSets
      .where("session_id")
      .equals(id)
      .toArray();
    for (const s of sets) {
      await db.gymSets.update(s.id, {
        is_deleted: true,
        updated_at: nowIso(),
        sync_status: "pending",
      });
    }
  };

  return {
    sessions: sessions ?? [],
    isLoading: sessions === undefined,
    startSession,
    endSession,
    deleteSession,
  };
}

export function useGymSessionSets(sessionId: string | null) {
  const sets = useLiveQuery(
    () =>
      sessionId
        ? db.gymSets
            .where("session_id")
            .equals(sessionId)
            .filter((s) => !s.is_deleted)
            .sortBy("created_at")
        : [],
    [sessionId]
  );

  const addSet = async (
    data: Omit<GymSet, "id" | "created_at" | "updated_at" | "sync_status" | "is_deleted">
  ): Promise<string> => {
    const id = uuidv4();
    const now = nowIso();
    const set: GymSet = {
      id,
      ...data,
      created_at: now,
      updated_at: now,
      sync_status: "pending",
      is_deleted: false,
    };
    await db.gymSets.add(set);
    return id;
  };

  const deleteSet = async (id: string) => {
    await db.gymSets.update(id, {
      is_deleted: true,
      updated_at: nowIso(),
      sync_status: "pending",
    });
  };

  const updateSet = async (id: string, patch: Partial<GymSet>) => {
    await db.gymSets.update(id, {
      ...patch,
      updated_at: nowIso(),
      sync_status: "pending",
    });
  };

  return {
    sets: sets ?? [],
    isLoading: sets === undefined,
    addSet,
    deleteSet,
    updateSet,
  };
}

/** Get the most recent (weight, reps) logged for a given exercise by this user,
 *  used to prefill the next set. */
export async function lastSetForExercise(
  userId: string,
  exerciseId: string
): Promise<GymSet | null> {
  const sets = await db.gymSets
    .where("exercise_id")
    .equals(exerciseId)
    .filter((s) => !s.is_deleted && !s.is_warmup)
    .reverse()
    .sortBy("created_at");
  // Filter to this user's sets by joining to sessions
  for (const s of sets) {
    const session = await db.gymSessions.get(s.session_id);
    if (session?.user_id === userId && !session.is_deleted) return s;
  }
  return null;
}
