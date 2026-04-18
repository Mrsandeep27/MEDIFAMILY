"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { syncAll, getPendingCount, type SyncResult } from "@/lib/db/sync";
import { useOnline } from "@/hooks/use-online";
import { useAuthStore } from "@/stores/auth-store";
import { SYNC_INTERVAL_MS } from "@/constants/config";
import { toast } from "sonner";

// Global: prevent multiple sync loops across re-renders/components
let syncLoopRunning = false;

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

      // Notify user if sync had errors and data is stuck locally
      if (result.errors.length > 0 && count > 0) {
        const isAuthError = result.errors.some(e => e.includes("401") || e.includes("Unauthorized"));
        if (isAuthError) {
          toast.error("Session expired. Please re-login to backup your data.", {
            duration: 10000,
            action: {
              label: "Re-login",
              onClick: () => { window.location.href = "/login"; },
            },
          });
        } else {
          toast.error("Some data failed to sync and is only stored on this device.", {
            duration: 5000,
          });
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
  //  - 2s after mount (push anything queued while offline or from last session)
  //  - Every SYNC_INTERVAL_MS on an interval
  //  - When the browser comes back online (fires both online + visibility)
  //  - When the tab regains focus (user was on another tab and came back)
  useEffect(() => {
    if (!isOnline || !user || syncLoopRunning) return;
    syncLoopRunning = true;

    const initTimeout = setTimeout(() => sync(), 2000);
    intervalRef.current = setInterval(sync, SYNC_INTERVAL_MS);

    const handleFocus = () => sync();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") sync();
    };
    const handleOnline = () => sync();

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);

    return () => {
      clearTimeout(initTimeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);
      syncLoopRunning = false;
    };
  }, [isOnline, user, sync]);

  return { isSyncing, lastResult, pendingCount, sync, refreshPendingCount };
}
