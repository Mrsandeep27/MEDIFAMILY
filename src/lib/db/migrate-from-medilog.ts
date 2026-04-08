"use client";

import Dexie from "dexie";
import { db } from "./dexie";

const MIGRATION_FLAG = "medifamily-migration-from-medilog-v1";
const OLD_DB_NAME = "medilog";

/**
 * One-time migration: copy all data from the old `medilog` IndexedDB
 * to the new `medifamily` IndexedDB. The app was renamed from MediLog
 * to MediFamily and the Dexie DB name changed too — without this
 * migration, existing users see all their data as missing.
 *
 * Safe to call multiple times — guarded by a localStorage flag.
 */
export async function migrateFromMediLog(): Promise<void> {
  if (typeof window === "undefined") return;

  // Already migrated? Skip.
  if (localStorage.getItem(MIGRATION_FLAG) === "done") return;

  try {
    // Check if the old database exists at all
    const databases = await indexedDB.databases?.().catch(() => []);
    const hasOldDb = databases?.some((d) => d.name === OLD_DB_NAME);

    if (!hasOldDb) {
      // Nothing to migrate (fresh install). Mark as done so we don't re-check.
      localStorage.setItem(MIGRATION_FLAG, "done");
      return;
    }

    // Open the old database with the same schema as the new one.
    // We declare all the same stores so Dexie can read from them.
    const oldDb = new Dexie(OLD_DB_NAME);
    oldDb.version(1).stores({
      members: "id, user_id, name, relation, sync_status, is_deleted",
      records:
        "id, member_id, type, visit_date, title, sync_status, is_deleted, *tags",
      medicines:
        "id, record_id, member_id, name, is_active, sync_status, is_deleted",
      reminders:
        "id, medicine_id, member_id, is_active, time, sync_status, is_deleted",
      reminderLogs: "id, reminder_id, scheduled_at, status, sync_status",
      shareLinks: "id, member_id, token, is_active, expires_at, sync_status",
      shareAccessLogs: "id, share_link_id, accessed_at",
      healthMetrics:
        "id, member_id, type, recorded_at, sync_status, is_deleted",
    });

    await oldDb.open();

    const tableNames = [
      "members",
      "records",
      "medicines",
      "reminders",
      "reminderLogs",
      "shareLinks",
      "shareAccessLogs",
      "healthMetrics",
    ] as const;

    let totalCopied = 0;

    for (const tableName of tableNames) {
      try {
        const oldTable = oldDb.table(tableName);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newTable = (db as unknown as Record<string, any>)[tableName];
        if (!oldTable || !newTable) continue;

        const rows = await oldTable.toArray();
        if (rows.length === 0) continue;

        // bulkPut overwrites duplicates by primary key (id) — safe if user
        // already added some data after the rename.
        await newTable.bulkPut(rows);
        totalCopied += rows.length;
      } catch (err) {
        console.warn(`[migration] Failed to copy ${tableName}:`, err);
      }
    }

    oldDb.close();

    if (totalCopied > 0) {
      console.log(`[migration] Copied ${totalCopied} rows from medilog → medifamily`);
    }

    // Mark as done — don't run again
    localStorage.setItem(MIGRATION_FLAG, "done");

    // Note: we intentionally do NOT delete the old database. If something
    // went wrong the user can recover by clearing the flag and re-running.
    // After a few weeks of stable releases we can add a cleanup.
  } catch (err) {
    console.error("[migration] Failed:", err);
    // Don't set the flag — let it retry on next load
  }
}
