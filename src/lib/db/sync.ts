"use client";

import { db } from "./dexie";
import type { SyncStatus } from "./schema";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";

export interface SyncResult {
  pushed: number;
  pulled: number;
  errors: string[];
  hasMore?: boolean;
}

const TABLES_TO_SYNC = [
  { local: "members", remote: "members" },
  { local: "records", remote: "health_records" },
  { local: "medicines", remote: "medicines" },
  { local: "reminders", remote: "reminders" },
  { local: "reminderLogs", remote: "reminder_logs" },
  { local: "shareLinks", remote: "share_links" },
  { local: "healthMetrics", remote: "health_metrics" },
  // Wellness tables are intentionally local-only until the Prisma schema
  // + Supabase tables land in a follow-up. The feature works offline-first
  // on the current device either way.
] as const;

// Fields that should NOT be sent to the server
const LOCAL_ONLY_FIELDS = new Set([
  "local_image_blobs",
  "photo_blob",
  "sync_status",
  "synced_at",
]);

// Async lock: prevents overlapping syncs (Promise-based, truly atomic)
let activeSyncPromise: Promise<SyncResult> | null = null;

// Debounce for fire-and-forget triggers — coalesces a burst of mutations
// (e.g. saving a record + its medicines + reminders) into one sync call.
let triggerTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Fire-and-forget sync trigger. Debounced to 800ms so multiple rapid
 * mutations (save a record, then add medicines, then reminders) collapse
 * into a single push cycle instead of hammering the API.
 *
 * Errors are swallowed — the interval and focus/online events will retry.
 */
export function triggerSync(): void {
  if (typeof window === "undefined") return;
  if (triggerTimer) clearTimeout(triggerTimer);
  triggerTimer = setTimeout(() => {
    triggerTimer = null;
    syncAll().catch(() => {});
  }, 800);
}

/**
 * Batched sync — ONE API call for push, ONE for pull (instead of 14).
 *
 * Pass `options.force: true` to bypass the "nothing to do" gate. Used
 * for interactive flows (e.g. post-login fresh pull on a new device).
 */
export async function syncAll(
  options: { force?: boolean } = {}
): Promise<SyncResult> {
  // If sync is already running, wait for it instead of starting a new one
  if (activeSyncPromise) return activeSyncPromise;

  activeSyncPromise = _doSync(options.force ?? false);
  try {
    return await activeSyncPromise;
  } finally {
    activeSyncPromise = null;
  }
}

// Get Supabase access token for authenticated API calls
async function getAuthToken(): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      // Check if token expires within 60s — if so, force a refresh
      const expiresAt = data.session.expires_at;
      if (expiresAt && expiresAt - Math.floor(Date.now() / 1000) < 60) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        return refreshed.session?.access_token ?? data.session.access_token;
      }
      return data.session.access_token;
    }
    return null;
  } catch {
    return null;
  }
}

const LAST_PULL_KEY = "medifamily_last_pull_at";

function readLastPullAt(): number {
  if (typeof localStorage === "undefined") return 0;
  const raw = localStorage.getItem(LAST_PULL_KEY);
  return raw ? parseInt(raw, 10) || 0 : 0;
}

function writeLastPullAt(ts: number): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(LAST_PULL_KEY, ts.toString());
}

async function _doSync(force: boolean): Promise<SyncResult> {
  const result: SyncResult = { pushed: 0, pulled: 0, errors: [] };

  // ── EARLY GATE: if nothing to push and we pulled recently, skip entirely.
  // This is the single biggest saving — idle tabs stop pinging Supabase
  // every interval tick when the user hasn't done anything. Push-on-mutation
  // and focus events still bypass this via the `force` flag.
  if (!force) {
    const { MIN_PULL_INTERVAL_MS } = await import("@/constants/config");
    const sinceLastPull = Date.now() - readLastPullAt();
    const hasAnyPending = await getPendingCount().then((n) => n > 0).catch(() => true);
    if (!hasAnyPending && sinceLastPull < MIN_PULL_INTERVAL_MS) {
      return result; // nothing to push, pulled recently — no network call
    }
  }

  const token = await getAuthToken();

  try {
    // ── PUSH: Collect all pending items across all tables ──
    const pushPayload: Record<string, Record<string, unknown>[]> = {};
    const pushTimestamps = new Map<string, string>();

    for (const { local, remote } of TABLES_TO_SYNC) {
      const dexieTable = db.table(local);
      const pendingItems = await dexieTable
        .where("sync_status")
        .equals("pending")
        .toArray();

      if (pendingItems.length > 0) {
        // Cap at 100 to match server limit — remainder syncs next cycle
        pushPayload[remote] = pendingItems.slice(0, 100).map((item: Record<string, unknown>) => {
          const clean: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(item)) {
            if (!LOCAL_ONLY_FIELDS.has(key)) clean[key] = value;
          }
          pushTimestamps.set(item.id as string, item.updated_at as string);
          return clean;
        });
      }
    }

    // Single POST for all tables with pending data
    if (Object.keys(pushPayload).length > 0) {
      try {
        const pushHeaders: Record<string, string> = { "Content-Type": "application/json" };
        if (token) pushHeaders["Authorization"] = `Bearer ${token}`;
        const response = await fetch("/api/sync", {
          method: "POST",
          headers: pushHeaders,
          body: JSON.stringify({ tables: pushPayload }),
        });

        if (response.ok) {
          const data = await response.json();
          result.pushed = data.pushed || 0;
          if (data.errors) result.errors.push(...data.errors);

          // Mark synced — skip failed items and guard against mid-sync edits
          const failedIds = new Set<string>(
            Array.isArray(data.failedIds) ? data.failedIds : []
          );
          const now = new Date().toISOString();
          for (const { local, remote } of TABLES_TO_SYNC) {
            if (pushPayload[remote]) {
              const dexieTable = db.table(local);
              const ids = pushPayload[remote].map((i) => i.id as string);
              for (const id of ids) {
                if (failedIds.has(id)) continue;
                // Only mark synced if item wasn't edited while push was in-flight
                const current = await dexieTable.get(id);
                if (current && current.updated_at === pushTimestamps.get(id)) {
                  await dexieTable.update(id, { sync_status: "synced", synced_at: now });
                }
              }
            }
          }
        } else {
          result.errors.push(`Push failed: HTTP ${response.status}`);
          // Auth failed — pull will fail too, skip it
          if (response.status === 401 || response.status === 403) return result;
        }
      } catch (err) {
        result.errors.push(`Push: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // ── PULL: Single GET with all table timestamps ──
    const sinceMap: Record<string, string> = {};
    for (const { remote } of TABLES_TO_SYNC) {
      sinceMap[remote] = getSyncTimestamp(remote);
    }

    try {
      const pullHeaders: Record<string, string> = {};
      if (token) pullHeaders["Authorization"] = `Bearer ${token}`;
      const response = await fetch("/api/sync?" + new URLSearchParams({
        tables: JSON.stringify(sinceMap),
      }), { headers: pullHeaders });

      if (response.ok) {
        const { data } = await response.json();

        if (data && typeof data === "object") {
          for (const { local, remote } of TABLES_TO_SYNC) {
            const serverItems = data[remote];
            if (!Array.isArray(serverItems) || serverItems.length === 0) continue;

            const dexieTable = db.table(local);
            let latestProcessed = sinceMap[remote];
            let minSkippedTimestamp: string | null = null;

            for (const serverItem of serverItems) {
              try {
                const localItem = await dexieTable.get(serverItem.id);

                // Never overwrite local pending changes — they haven't pushed yet
                // Track skipped timestamps so watermark doesn't advance past them
                if (localItem?.sync_status === "pending") {
                  if (!minSkippedTimestamp || serverItem.updated_at < minSkippedTimestamp) {
                    minSkippedTimestamp = serverItem.updated_at;
                  }
                  continue;
                }

                if (
                  !localItem ||
                  new Date(serverItem.updated_at) > new Date(localItem.updated_at)
                ) {
                  // Preserve local-only fields the server doesn't have
                  const preserved: Record<string, unknown> = {};
                  if (localItem?.local_image_blobs) {
                    preserved.local_image_blobs = localItem.local_image_blobs;
                  }

                  await dexieTable.put({
                    ...serverItem,
                    ...preserved,
                    sync_status: "synced" as SyncStatus,
                    synced_at: new Date().toISOString(),
                  });
                  result.pulled++;
                }

                if (serverItem.updated_at > latestProcessed) {
                  latestProcessed = serverItem.updated_at;
                }
              } catch (err) {
                result.errors.push(`Pull ${serverItem.id}: ${err instanceof Error ? err.message : String(err)}`);
              }
            }

            // Cap watermark at earliest skipped pending item so it's re-fetched next cycle
            const finalWatermark = minSkippedTimestamp && minSkippedTimestamp < latestProcessed
              ? minSkippedTimestamp
              : latestProcessed;
            setSyncTimestamp(remote, finalWatermark);
          }
        }
        // Record successful pull time so the early gate can skip redundant
        // pulls for the next MIN_PULL_INTERVAL_MS.
        writeLastPullAt(Date.now());
      } else {
        result.errors.push(`Pull failed: HTTP ${response.status}`);
        if (response.status === 401 || response.status === 403) return result;
      }
    } catch (err) {
      result.errors.push(`Pull: ${err instanceof Error ? err.message : String(err)}`);
    }
  } catch (err) {
    result.errors.push(`Sync: ${err instanceof Error ? err.message : String(err)}`);
  }

  // If we pushed items but there are still pending ones, schedule an immediate follow-up
  if (result.pushed > 0) {
    const remaining = await getPendingCount();
    if (remaining > 0) {
      result.hasMore = true;
    }
  }

  return result;
}

// Per-table, per-user sync timestamps
// Scoped by user ID so shared devices don't cross-contaminate
function getSyncTimestamp(table: string): string {
  if (typeof window === "undefined") return new Date(0).toISOString();
  const userId = useAuthStore.getState().user?.id;
  const key = userId ? `medifamily_sync_${userId}_${table}` : `medifamily_sync_${table}`;
  return localStorage.getItem(key) || new Date(0).toISOString();
}

function setSyncTimestamp(table: string, timestamp: string): void {
  if (typeof window !== "undefined") {
    const userId = useAuthStore.getState().user?.id;
    const key = userId ? `medifamily_sync_${userId}_${table}` : `medifamily_sync_${table}`;
    localStorage.setItem(key, timestamp);
  }
}

export async function getPendingCount(): Promise<number> {
  let count = 0;
  for (const { local } of TABLES_TO_SYNC) {
    const items = await db.table(local).where("sync_status").equals("pending").count();
    count += items;
  }
  return count;
}
