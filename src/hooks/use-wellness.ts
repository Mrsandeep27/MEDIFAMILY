"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db/dexie";
import type {
  WellnessEntry,
  WellnessGoals,
  Mood,
} from "@/lib/db/schema";
import { useAuthStore } from "@/stores/auth-store";

const DEFAULT_GOALS: Omit<WellnessGoals, "id" | "user_id" | "created_at" | "updated_at" | "sync_status" | "is_deleted"> = {
  water_target_ml: 2000, // 2.0 L — standard adult recommendation
  workout_days_per_week: 4,
  calorie_tracking_enabled: false,
  gym_mode_enabled: false,
};

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

export function useWellness() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;

  // Today's entry (live)
  const today = todayStr();
  const todayEntry = useLiveQuery(
    () =>
      userId
        ? db.wellnessEntries
            .where("[user_id+date]")
            .equals([userId, today])
            .filter((e) => !e.is_deleted)
            .first()
        : undefined,
    [userId, today]
  );

  // Last 30 days of entries (for charts + streaks)
  const recentEntries = useLiveQuery(
    () =>
      userId
        ? db.wellnessEntries
            .where("user_id")
            .equals(userId)
            .filter((e) => !e.is_deleted && e.date >= daysAgoStr(30))
            .toArray()
        : [],
    [userId]
  );

  // Goals — create default if missing
  const goals = useLiveQuery(
    () =>
      userId
        ? db.wellnessGoals
            .where("user_id")
            .equals(userId)
            .filter((g) => !g.is_deleted)
            .first()
        : undefined,
    [userId]
  );

  const ensureGoals = async (): Promise<WellnessGoals> => {
    if (!userId) throw new Error("Not signed in");
    const existing = await db.wellnessGoals
      .where("user_id")
      .equals(userId)
      .filter((g) => !g.is_deleted)
      .first();
    if (existing) return existing;
    const now = new Date().toISOString();
    const newGoals: WellnessGoals = {
      id: userId,
      user_id: userId,
      ...DEFAULT_GOALS,
      created_at: now,
      updated_at: now,
      sync_status: "pending",
      is_deleted: false,
    };
    await db.wellnessGoals.put(newGoals);
    return newGoals;
  };

  const updateGoals = async (patch: Partial<WellnessGoals>) => {
    if (!userId) return;
    const existing = await ensureGoals();
    await db.wellnessGoals.update(existing.id, {
      ...patch,
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    });
  };

  // Upsert today's entry
  const upsertTodayEntry = async (patch: Partial<WellnessEntry>) => {
    if (!userId) return;
    const date = todayStr();
    const existing = await db.wellnessEntries
      .where("[user_id+date]")
      .equals([userId, date])
      .filter((e) => !e.is_deleted)
      .first();

    const now = new Date().toISOString();
    if (existing) {
      await db.wellnessEntries.update(existing.id, {
        ...patch,
        updated_at: now,
        sync_status: "pending",
      });
    } else {
      const entry: WellnessEntry = {
        id: uuidv4(),
        user_id: userId,
        date,
        water_ml: 0,
        ...patch,
        created_at: now,
        updated_at: now,
        sync_status: "pending",
        is_deleted: false,
      };
      await db.wellnessEntries.add(entry);
    }
  };

  /** Adjust today's water by `delta` millilitres. Clamps to [0, 10000]. */
  const addWater = async (delta: number) => {
    const current = todayEntry?.water_ml ?? 0;
    const next = Math.max(0, Math.min(10000, current + delta));
    await upsertTodayEntry({ water_ml: next });
  };

  const setWeight = async (kg: number) => {
    await upsertTodayEntry({ weight_kg: kg });
  };

  const setMood = async (mood: Mood, energy?: number) => {
    await upsertTodayEntry({ mood, energy });
  };

  return {
    userId,
    today,
    todayEntry,
    recentEntries: recentEntries ?? [],
    goals,
    isLoading: recentEntries === undefined,
    addWater,
    setWeight,
    setMood,
    upsertTodayEntry,
    ensureGoals,
    updateGoals,
  };
}

/**
 * Streak = count of consecutive days (ending today or yesterday) with any
 * meaningful entry (water > 0, weight logged, or mood set).
 */
export function computeStreak(entries: WellnessEntry[]): number {
  if (!entries.length) return 0;
  const byDate = new Map(entries.map((e) => [e.date, e]));
  let streak = 0;
  const cursor = new Date();
  // Tolerant check: if today empty, look at yesterday first
  const todayKey = cursor.toISOString().split("T")[0];
  if (!hasActivity(byDate.get(todayKey))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  for (;;) {
    const key = cursor.toISOString().split("T")[0];
    if (hasActivity(byDate.get(key))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function hasActivity(e: WellnessEntry | undefined): boolean {
  if (!e) return false;
  return (e.water_ml ?? 0) > 0 || e.weight_kg != null || e.mood != null;
}

/**
 * Health score (0–100): weighted blend of this week's behavior.
 *  - Water: 30% (avg ml / target ml)
 *  - Workouts: 40% (days this week / weekly target)
 *  - Weight consistency: 15% (# days weighed / 7)
 *  - Mood: 15% (avg mood score / max)
 */
export function computeHealthScore(
  entries: WellnessEntry[],
  workoutDaysThisWeek: number,
  waterTargetMl: number,
  weeklyWorkoutTarget: number
): number {
  const last7 = entries.filter((e) => e.date >= daysAgoStr(6));
  if (last7.length === 0 && workoutDaysThisWeek === 0) return 0;

  const avgWaterMl =
    last7.reduce((s, e) => s + (e.water_ml || 0), 0) /
    Math.max(1, last7.length);
  const waterPct = Math.min(1, avgWaterMl / Math.max(1, waterTargetMl));

  const workoutPct = Math.min(1, workoutDaysThisWeek / Math.max(1, weeklyWorkoutTarget));

  const daysWeighed = last7.filter((e) => e.weight_kg != null).length;
  const weighPct = daysWeighed / 7;

  const moodMap: Record<Mood, number> = {
    great: 5,
    good: 4,
    okay: 3,
    low: 2,
    bad: 1,
  };
  const moodScores = last7
    .map((e) => (e.mood ? moodMap[e.mood] : 0))
    .filter((v) => v > 0);
  const avgMood =
    moodScores.reduce((s, v) => s + v, 0) / Math.max(1, moodScores.length);
  const moodPct = moodScores.length > 0 ? avgMood / 5 : 0;

  const score =
    waterPct * 0.3 + workoutPct * 0.4 + weighPct * 0.15 + moodPct * 0.15;
  return Math.round(score * 100);
}
