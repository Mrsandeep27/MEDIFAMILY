"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";
import { syncAll } from "@/lib/db/sync";

// Tables whose sync watermark must be reset when family membership changes —
// otherwise we won't pull the family-mate's pre-existing rows because their
// updated_at is older than our last pull. A reset forces a full re-sync of
// the visible-to-this-user world after the family scope changes.
const FAMILY_SCOPED_TABLES = [
  "members",
  "health_records",
  "medicines",
  "reminders",
  "reminder_logs",
  "share_links",
  "health_metrics",
] as const;

function resetSyncWatermarks(userId: string): void {
  if (typeof localStorage === "undefined") return;
  for (const table of FAMILY_SCOPED_TABLES) {
    localStorage.removeItem(`medifamily_sync_${userId}_${table}`);
    localStorage.removeItem(`medifamily_sync_${table}`); // legacy key
  }
  localStorage.removeItem("medifamily_last_pull_at");
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  return headers;
}

export interface FamilyGroupMember {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: "admin" | "member";
  joined_at: string;
}

export interface FamilyGroup {
  id: string;
  name: string;
  invite_code: string;
  role: "admin" | "member";
  created_by: string;
  members: FamilyGroupMember[];
}

export function useFamilyGroup() {
  const user = useAuthStore((s) => s.user);
  const [families, setFamilies] = useState<FamilyGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFamilies = useCallback(async () => {
    if (!user) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/family", { headers });
      if (res.ok) {
        const data = await res.json();
        setFamilies(data.families || []);
      }
    } catch (err) {
      console.error("Failed to fetch families:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchFamilies();
  }, [fetchFamilies]);

  const createFamily = async (name: string): Promise<FamilyGroup | null> => {
    if (!user) return null;
    const headers = await getAuthHeaders();
    const res = await fetch("/api/family", {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "create", name }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to create family");
    }

    const { family } = await res.json();
    setFamilies((prev) => [...prev, family]);
    return family;
  };

  const joinFamily = async (inviteCode: string): Promise<FamilyGroup | null> => {
    if (!user) return null;
    const headers = await getAuthHeaders();
    const res = await fetch("/api/family", {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "join", invite_code: inviteCode }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to join family");
    }

    const { family } = await res.json();
    setFamilies((prev) => [...prev, family]);
    // After joining, our sync scope expanded to include family-mates'
    // historical data. Reset watermarks + force a full pull so all their
    // existing members/records appear locally without waiting for an
    // updated_at-bumping edit.
    resetSyncWatermarks(user.id);
    syncAll({ force: true }).catch((e) => console.error("post-join sync failed:", e));
    return family;
  };

  const leaveFamily = async (familyId: string): Promise<void> => {
    if (!user) return;
    const headers = await getAuthHeaders();
    const res = await fetch("/api/family", {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "leave", family_id: familyId }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to leave family");
    }

    setFamilies((prev) => prev.filter((f) => f.id !== familyId));
    // Sync scope shrinks after leaving — reset watermarks so we don't keep
    // the now-out-of-scope rows in stale local cache. (They aren't deleted
    // locally, but a full pull keeps things consistent on next mutation.)
    resetSyncWatermarks(user.id);
    syncAll({ force: true }).catch((e) => console.error("post-leave sync failed:", e));
  };

  // Get all member user IDs from all family groups (for querying shared data)
  const familyUserIds = Array.from(
    new Set(families.flatMap((f) => f.members.map((m) => m.user_id)))
  );

  // Manual full re-pull. Use this when the user wants to force a refresh
  // after joining — or to recover if a join happened on an older client
  // that didn't reset watermarks automatically.
  const refreshSharedData = async (): Promise<void> => {
    if (!user) return;
    resetSyncWatermarks(user.id);
    await syncAll({ force: true });
  };

  return {
    families,
    isLoading,
    createFamily,
    joinFamily,
    leaveFamily,
    refreshFamilies: fetchFamilies,
    refreshSharedData,
    familyUserIds,
  };
}
