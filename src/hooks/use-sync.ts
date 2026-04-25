"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { syncAll, getPendingCount, type SyncResult } from "@/lib/db/sync";
import { useOnline } from "@/hooks/use-online";
import { useAuthStore } from "@/stores/auth-store";
import { SYNC_INTERVAL_MS } from "@/constants/config";
import { toast } from "sonner";

// Global: prevent multiple sync loops across re-renders/components
let syncLoopRunning = false;

// Track consecutive sync failures so we don't toast on every transient blip.
// Resets to 0 whenever a sync succeeds or has zero pending items left.
let consecutiveFailures = 0;
// Don't show the same toast more than once per 10 minutes — even if the user
// is genuinely stuck, repeating the message every 15 min is annoying.
let lastToastAt = 0;
const TOAST_COOLDOWN_MS = 10 * 60 * 1000;

export function useSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const isOnline = useOnline();
  const user = useAuthStore((s) => s.user);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSyncingRef = useRef(false);

  const sync = useCallback(async () => {
    if (!isOnline || !user || isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsSyncing(true);
    try {
      let result = await syncAll();

      // If partial push (>100 items), retry immediately up to 5 times
      let retries = 0;
      while (result.hasMore && retries < 5) {
        retries++;
        const more = await syncAll();
        result = {
          pushed: result.pushed + more.pushed,
          pulled: result.pulled + more.pulled,
          errors: [...result.errors, ...more.errors],
          hasMore: more.hasMore,
        };
      }

      setLastResult(result);
      const count = await getPendingCount();
      setPendingCount(count);

      // Always log errors to console for diagnosis (even if no pending items)
      if (result.errors.length > 0) {
        console.error("[sync] errors:", result.errors);
      }

      // Decide whether to surface a user-facing toast:
      //  - Auth errors: show immediately, user MUST re-login
      //  - Transient errors (5xx, network, 429, 408): never toast — auto-retry
      //    will handle. These are tagged with "Transient" prefix.
      //  - Real per-item rejections: only toast after 3 consecutive failed
      //    cycles, so a one-off bad row doesn't spam the user.
      if (result.errors.length === 0 || count === 0) {
        consecutiveFailures = 0; // success or fully-flushed → reset
      } else {
        const isAuthError = result.errors.some(
          (e) => e.includes("401") || e.includes("403") || e.includes("Unauthorized")
        );
        const onlyTransient = result.errors.every((e) => e.includes("Transient"));

        if (isAuthError) {
          if (Date.now() - lastToastAt > TOAST_COOLDOWN_MS) {
            lastToastAt = Date.now();
            toast.error("Session expired. Please re-login to back up your data.", {
              duration: 10000,
              action: {
                label: "Re-login",
                onClick: () => {
                  window.location.href = "/login";
                },
              },
            });
          }
        } else if (onlyTransient) {
          // Don't bump the counter — transient = not the user's data, just network
          // The next interval cycle will retry automatically.
          consecutiveFailures = Math.max(0, consecutiveFailures - 1);
        } else {
          consecutiveFailures++;
          if (consecutiveFailures >= 3 && Date.now() - lastToastAt > TOAST_COOLDOWN_MS) {
            lastToastAt = Date.now();
            // Truncate to first 3 problematic ids so the toast stays short
            const sample = result.errors
              .filter((e) => !e.includes("Transient"))
              .slice(0, 3)
              .map((e) => e.split(":")[0])
              .join(", ");
            toast.error(`${count} item(s) couldn't sync to cloud. They're safe on this device.`, {
              description: sample ? `Affected: ${sample}` : "We'll keep retrying.",
              duration: 8000,
            });
          }
        }
      }
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [isOnline, user]);

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch {}
  }, []);

  // Auto-sync:
  //  - 3s after mount (push anything queued while offline; pulls only if
  //    it's been a while since last pull — gated inside syncAll)
  //  - Every SYNC_INTERVAL_MS (15 min) as a safety net. Gated too — no-op
  //    when nothing pending and we pulled recently.
  //  - On 'online' reconnect — forced, since server may have new data we
  //    couldn't fetch while offline.
  // Mutation writes (addMember/addRecord/etc) trigger an immediate push
  // via triggerSync() in each mutation hook, so data lands in the cloud
  // within ~1s of being saved. No need to re-sync on focus/visibility.
  useEffect(() => {
    if (!isOnline || !user || syncLoopRunning) return;
    syncLoopRunning = true;

    const initTimeout = setTimeout(() => sync(), 3000);
    intervalRef.current = setInterval(sync, SYNC_INTERVAL_MS);

    const handleOnline = () => {
      // Force a full sync — offline gap means we likely missed remote updates
      import("@/lib/db/sync").then(({ syncAll }) =>
        syncAll({ force: true }).catch(() => {})
      );
    };

    window.addEventListener("online", handleOnline);

    return () => {
      clearTimeout(initTimeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener("online", handleOnline);
      syncLoopRunning = false;
    };
  }, [isOnline, user, sync]);

  return { isSyncing, lastResult, pendingCount, sync, refreshPendingCount };
}
