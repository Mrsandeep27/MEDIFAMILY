"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db/dexie";
import type { Incident, IncidentType } from "@/lib/db/schema";
import { useAuthStore } from "@/stores/auth-store";
import { triggerSync } from "@/lib/db/sync";

export interface IncidentFormData {
  member_id: string;
  type: IncidentType;
  occurred_at: string; // ISO timestamp
  notes: string;
  action_taken: string;
}

/**
 * Incidents for a specific resident (or all if memberId omitted), newest
 * first. Backed by Dexie's [member_id+is_deleted] compound index for
 * fast resident-profile lookups.
 */
export function useIncidents(memberId?: string) {
  const user = useAuthStore((s) => s.user);

  const incidents = useLiveQuery(
    async () => {
      if (!user) return [] as Incident[];
      const all = await (memberId
        ? db.incidents.where("member_id").equals(memberId)
        : db.incidents
      )
        .filter((i) => !i.is_deleted)
        .toArray();
      all.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
      return all;
    },
    [user?.id, memberId]
  );

  const addIncident = async (data: IncidentFormData): Promise<string> => {
    if (!user) throw new Error("Not authenticated");
    const id = uuidv4();
    const now = new Date().toISOString();
    const incident: Incident = {
      id,
      member_id: data.member_id,
      type: data.type,
      occurred_at: data.occurred_at,
      notes: data.notes.trim(),
      action_taken: data.action_taken.trim(),
      caretaker_id: user.id,
      created_at: now,
      updated_at: now,
      sync_status: "pending",
      synced_at: undefined,
      is_deleted: false,
    };
    await db.incidents.add(incident);
    triggerSync();
    return id;
  };

  return {
    incidents: incidents ?? [],
    isLoading: incidents === undefined,
    addIncident,
  };
}
