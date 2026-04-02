"use client";

import { useEffect, useRef } from "react";
import { useSettingsStore } from "@/stores/settings-store";
import { requestNotificationPermission, showReminderNotification } from "@/lib/notifications/web-push";

const CHECK_INTERVAL_MS = 60_000; // Check every 60 seconds

/**
 * Hook that:
 * 1. Requests notification permission on first app load (if enabled in settings)
 * 2. Checks reminders every minute and fires browser notifications at the right time
 * 3. Respects quiet hours and notification toggle
 */
export function useNotificationChecker() {
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const quietHoursEnabled = useSettingsStore((s) => s.quietHoursEnabled);
  const quietHoursStart = useSettingsStore((s) => s.quietHoursStart);
  const quietHoursEnd = useSettingsStore((s) => s.quietHoursEnd);
  const firedRef = useRef<Set<string>>(new Set());

  // Request permission once on mount (if notifications are enabled)
  useEffect(() => {
    if (!notificationsEnabled) return;
    requestNotificationPermission();
  }, [notificationsEnabled]);

  // Check reminders every minute
  useEffect(() => {
    if (!notificationsEnabled) return;

    const checkReminders = async () => {
      // Check quiet hours
      if (quietHoursEnabled) {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const [startH, startM] = quietHoursStart.split(":").map(Number);
        const [endH, endM] = quietHoursEnd.split(":").map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        // Handle overnight quiet hours (e.g. 22:00 - 07:00)
        if (startMinutes > endMinutes) {
          if (currentMinutes >= startMinutes || currentMinutes < endMinutes) return;
        } else {
          if (currentMinutes >= startMinutes && currentMinutes < endMinutes) return;
        }
      }

      try {
        const { db } = await import("@/lib/db/dexie");
        const reminders = await db.reminders
          .filter((r) => r.is_active && !r.is_deleted)
          .toArray();

        if (reminders.length === 0) return;

        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"
        const dayMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
        const today = dayMap[now.getDay()];
        const todayDate = now.toISOString().split("T")[0];

        for (const reminder of reminders) {
          // Check if today is a scheduled day
          if (!reminder.days.includes(today)) continue;

          // Check if it's time (within 1-minute window)
          if (reminder.time !== currentTime) continue;

          // Check if already fired for this reminder+date combo
          const firedKey = `${reminder.id}_${todayDate}_${reminder.time}`;
          if (firedRef.current.has(firedKey)) continue;

          // Check if already logged (taken/skipped) today for this reminder
          const logs = await db.reminderLogs
            .filter(
              (l) =>
                l.reminder_id === reminder.id &&
                l.scheduled_at.startsWith(todayDate)
            )
            .toArray();

          if (logs.length > 0) continue;

          // Fire notification
          firedRef.current.add(firedKey);
          showReminderNotification(
            reminder.medicine_name,
            reminder.member_name || "",
            reminder.dosage,
            reminder.before_food
          );
        }
      } catch (err) {
        console.error("Notification check failed:", err);
      }
    };

    // Run immediately + every minute
    checkReminders();
    const interval = setInterval(checkReminders, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [notificationsEnabled, quietHoursEnabled, quietHoursStart, quietHoursEnd]);
}
