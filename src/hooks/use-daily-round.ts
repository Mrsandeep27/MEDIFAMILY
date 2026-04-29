"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/dexie";
import type { Reminder, ReminderLog, Member, DayOfWeek } from "@/lib/db/schema";
import { useAuthStore } from "@/stores/auth-store";

export interface RoundItem {
  reminder: Reminder;
  resident: Member;
  /** Most recent log for this reminder for the round date, if any. */
  log: ReminderLog | undefined;
  status: "pending" | "taken" | "missed" | "skipped";
}

export type RoundSlot = "morning" | "afternoon" | "evening" | "night" | "all";

const DAY_KEYS: DayOfWeek[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function getDayKey(d: Date): DayOfWeek {
  return DAY_KEYS[d.getDay()];
}

/**
 * Time-slot ranges (24h). A reminder counts as part of a slot if its
 * "time" field (HH:mm) falls in the range. "all" returns every reminder
 * for today regardless of slot, used when the caretaker wants one
 * unified list.
 */
function inSlot(time: string, slot: RoundSlot): boolean {
  if (slot === "all") return true;
  const [h] = time.split(":").map(Number);
  if (Number.isNaN(h)) return false;
  switch (slot) {
    case "morning":
      return h >= 5 && h < 12;
    case "afternoon":
      return h >= 12 && h < 17;
    case "evening":
      return h >= 17 && h < 21;
    case "night":
      return h >= 21 || h < 5;
  }
}

/** YYYY-MM-DD slice of a Date in local time. Used as the round-date key
 *  so a single round counts logs only for today (not yesterday's). */
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Daily Round derivation.
 *
 * Inputs: round date (defaults to today), time slot, current user.
 * Output: list of RoundItems — one per (active reminder × today's day-of-week)
 * for every resident, with each item's current taken/missed status pulled
 * from reminderLogs scoped to the round date.
 *
 * The list is sorted by time then room number so the caretaker can walk
 * the round in physical order. One tap on an item → log "taken" for that
 * reminder × date.
 */
export function useDailyRound(slot: RoundSlot = "all", date: Date = new Date()) {
  const user = useAuthStore((s) => s.user);

  // Memo: when nothing about the inputs changed, useLiveQuery should
  // return the same query result. Date is normalised to its key so a
  // second-by-second re-render doesn't refetch.
  const day = getDayKey(date);
  const dayDateKey = dateKey(date);

  const items = useLiveQuery(async () => {
    if (!user) return [] as RoundItem[];

    // 1. All active residents owned by this user
    const residents = await db.members
      .where("user_id")
      .equals(user.id)
      .filter((m) => !m.is_deleted && m.is_resident === true && !m.discharged_at)
      .toArray();
    if (residents.length === 0) return [];

    const residentById = new Map(residents.map((r) => [r.id, r] as const));
    const residentIds = new Set(residents.map((r) => r.id));

    // 2. All active reminders for those residents that fire today
    const reminders = await db.reminders
      .filter(
        (r) =>
          !r.is_deleted &&
          r.is_active &&
          residentIds.has(r.member_id) &&
          r.days.includes(day) &&
          inSlot(r.time, slot)
      )
      .toArray();
    if (reminders.length === 0) return [];

    const reminderIds = reminders.map((r) => r.id);

    // 3. Logs for those reminders on the round date. We fetch all and
    //    filter in JS — Dexie can't index by reminder_id + date directly,
    //    and on a 50-resident home this is ~150 logs (cheap).
    const logs = await db.reminderLogs.toArray();
    const todayLogsByReminder = new Map<string, ReminderLog>();
    for (const log of logs) {
      if (!reminderIds.includes(log.reminder_id)) continue;
      if (!log.scheduled_at.startsWith(dayDateKey)) continue;
      // Keep the most recent log per reminder for today (last write wins
      // — matches the toggle UX where a tap creates a fresh log).
      const existing = todayLogsByReminder.get(log.reminder_id);
      if (!existing || log.created_at > existing.created_at) {
        todayLogsByReminder.set(log.reminder_id, log);
      }
    }

    // 4. Assemble + sort
    const out: RoundItem[] = reminders
      .map((reminder) => {
        const resident = residentById.get(reminder.member_id);
        if (!resident) return null;
        const log = todayLogsByReminder.get(reminder.id);
        const status: RoundItem["status"] = log
          ? (log.status as RoundItem["status"])
          : "pending";
        return { reminder, resident, log, status };
      })
      .filter((x): x is RoundItem => x !== null);

    out.sort((a, b) => {
      // Primary: scheduled time
      const t = a.reminder.time.localeCompare(b.reminder.time);
      if (t !== 0) return t;
      // Secondary: room number (so caretaker walks in physical order)
      const aRoom = a.resident.room_no || "";
      const bRoom = b.resident.room_no || "";
      const r = aRoom.localeCompare(bRoom, undefined, { numeric: true });
      if (r !== 0) return r;
      // Tertiary: resident name
      return a.resident.name.localeCompare(b.resident.name);
    });

    return out;
  }, [user?.id, slot, dayDateKey, day]);

  // Progress counters drive the "X / Y completed" UI
  const all = items ?? [];
  const completed = all.filter((i) => i.status === "taken" || i.status === "skipped").length;
  const total = all.length;

  return {
    items: all,
    completed,
    total,
    isLoading: items === undefined,
  };
}
