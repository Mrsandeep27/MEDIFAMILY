"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db/dexie";
import type { Workout } from "@/lib/db/schema";
import { useAuthStore } from "@/stores/auth-store";

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

export function useWorkouts() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;

  // Last 30 days of workouts
  const workouts = useLiveQuery(
    () =>
      userId
        ? db.workouts
            .where("user_id")
            .equals(userId)
            .filter((w) => !w.is_deleted && w.date >= daysAgoStr(30))
            .reverse()
            .sortBy("date")
        : [],
    [userId]
  );

  const addWorkout = async (
    data: Omit<
      Workout,
      | "id"
      | "user_id"
      | "created_at"
      | "updated_at"
      | "sync_status"
      | "is_deleted"
    >
  ): Promise<string> => {
    if (!userId) throw new Error("Not signed in");
    const id = uuidv4();
    const now = new Date().toISOString();
    const workout: Workout = {
      id,
      user_id: userId,
      ...data,
      created_at: now,
      updated_at: now,
      sync_status: "pending",
      is_deleted: false,
    };
    await db.workouts.add(workout);
    return id;
  };

  const deleteWorkout = async (id: string) => {
    await db.workouts.update(id, {
      is_deleted: true,
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    });
  };

  const updateWorkout = async (id: string, patch: Partial<Workout>) => {
    await db.workouts.update(id, {
      ...patch,
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    });
  };

  return {
    workouts: workouts ?? [],
    isLoading: workouts === undefined,
    addWorkout,
    deleteWorkout,
    updateWorkout,
  };
}

/** How many distinct days this week did the user work out? Week = Mon–Sun. */
export function workoutDaysThisWeek(workouts: Workout[]): number {
  const now = new Date();
  const day = now.getDay() === 0 ? 6 : now.getDay() - 1; // Mon=0, Sun=6
  const monday = new Date(now);
  monday.setDate(now.getDate() - day);
  const mondayStr = monday.toISOString().split("T")[0];
  const days = new Set(
    workouts.filter((w) => w.date >= mondayStr && !w.is_deleted).map((w) => w.date)
  );
  return days.size;
}
