"use client";

import { db } from "./dexie";
import type { SyncStatus } from "./schema";

export interface SyncResult {
  pushed: number;
  pulled: number;
  errors: string[];
}

const TABLES_TO_SYNC = [
  { local: "members", remote: "members" },
  { local: "records", remote: "health_records" },
  { local: "medicines", remote: "medicines" },
  { local: "reminders", remote: "reminders" },
  { local: "reminderLogs", remote: "reminder_logs" },
  { local: "shareLinks", remote: "share_links" },
  { local: "healthMetrics", remote: "health_metrics" },
] as const;

// Fields that should NOT be sent to the server
const LOCAL_ONLY_FIELDS = new Set(["local_image_blobs", "sync_status", "synced_at"]);

export async function syncAll(): Promise<SyncResult> {
  const result: SyncResult = { pushed: 0, pulled: 0, errors: [] };

  for (const { local, remote } of TABLES_TO_SYNC) {
    try {
      // Push pending items
      const pushResult = await pushTable(local, remote);
      result.pushed += pushResult.pushed;
      result.errors.push(...pushResult.errors);

      // Pull updated items
      const pullResult = await pullTable(local, remote);
      result.pulled += pullResult.pulled;
      result.errors.push(...pullResult.errors);
    } catch (err) {
      result.errors.push(`${local}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}

async function pushTable(
  localTable: string,
  remoteTable: string
): Promise<{ pushed: number; errors: string[] }> {
  const result = { pushed: 0, errors: [] as string[] };
  const dexieTable = db.table(localTable);

  const pendingItems = await dexieTable
    .filter((item: { sync_status: SyncStatus }) => item.sync_status === "pending")
    .toArray();

  if (pendingItems.length === 0) return result;

  // Strip local-only fields
  const cleanItems = pendingItems.map((item: Record<string, unknown>) => {
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(item)) {
      if (!LOCAL_ONLY_FIELDS.has(key)) {
        clean[key] = value;
      }
    }
    return clean;
  });

  try {
    const response = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: remoteTable, items: cleanItems }),
    });

    if (!response.ok) {
      result.errors.push(`Push ${localTable}: HTTP ${response.status}`);
      return result;
    }

    const data = await response.json();
    result.pushed = data.pushed || 0;
    if (data.errors) result.errors.push(...data.errors);

    // Mark as synced
    for (const item of pendingItems) {
      await dexieTable.update(item.id, {
        sync_status: "synced",
        synced_at: new Date().toISOString(),
      });
    }
  } catch (err) {
    result.errors.push(`Push ${localTable}: ${err instanceof Error ? err.message : String(err)}`);
  }

  return result;
}

async function pullTable(
  localTable: string,
  remoteTable: string
): Promise<{ pulled: number; errors: string[] }> {
  const result = { pulled: 0, errors: [] as string[] };
  const dexieTable = db.table(localTable);

  // Get last sync time
  const lastSynced = await dexieTable
    .orderBy("synced_at")
    .reverse()
    .first()
    .catch(() => null);
  const since = lastSynced?.synced_at || "2000-01-01T00:00:00Z";

  try {
    const response = await fetch(
      `/api/sync?table=${remoteTable}&since=${encodeURIComponent(since)}`
    );

    if (!response.ok) {
      result.errors.push(`Pull ${localTable}: HTTP ${response.status}`);
      return result;
    }

    const { data } = await response.json();

    if (data && Array.isArray(data)) {
      for (const serverItem of data) {
        const localItem = await dexieTable.get(serverItem.id);
        if (
          !localItem ||
          new Date(serverItem.updated_at) > new Date(localItem.updated_at)
        ) {
          await dexieTable.put({
            ...serverItem,
            sync_status: "synced",
            synced_at: new Date().toISOString(),
          });
          result.pulled++;
        }
      }
    }
  } catch (err) {
    result.errors.push(`Pull ${localTable}: ${err instanceof Error ? err.message : String(err)}`);
  }

  return result;
}

export async function getPendingCount(): Promise<number> {
  let count = 0;
  for (const { local } of TABLES_TO_SYNC) {
    const items = await db
      .table(local)
      .filter((item: { sync_status: SyncStatus }) => item.sync_status === "pending")
      .count();
    count += items;
  }
  return count;
}
