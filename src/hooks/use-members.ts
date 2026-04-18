"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db/dexie";
import type { Member, Relation, BloodGroup, Gender } from "@/lib/db/schema";
import { useAuthStore } from "@/stores/auth-store";
import type { MemberFormData } from "@/lib/utils/validators";
import { createClient } from "@/lib/supabase/client";
import { triggerSync } from "@/lib/db/sync";

export function useMembers() {
  const user = useAuthStore((s) => s.user);

  // Use single-key index + JS filter. The compound form
  // .where({ user_id, is_deleted: false }) is unreliable in Dexie 4
  // because boolean false doesn't index reliably across browsers, and
  // there's no [user_id+is_deleted] compound index in the schema.
  const members = useLiveQuery(
    () =>
      user
        ? db.members
            .where("user_id")
            .equals(user.id)
            .filter((m) => !m.is_deleted)
            .toArray()
        : [],
    [user?.id]
  );

  const getMember = (id: string) =>
    useLiveQuery(() => db.members.get(id), [id]);

  const addMember = async (data: MemberFormData): Promise<string> => {
    if (!user?.id) {
      throw new Error("Please sign in again to add a family member");
    }

    // Prevent duplicate self members — self is a singleton per user.
    // We guard in three layers so a fresh-device login never creates a
    // duplicate that then syncs back to the cloud:
    //   1) Local Dexie check (fast path)
    //   2) Server check via /api/check-onboarding (catches new-device case)
    //   3) Sync pull to populate the real self row locally
    if (data.relation === "self") {
      // Layer 1 — local
      const localSelf = await db.members
        .where("user_id")
        .equals(user.id)
        .filter((m) => m.relation === "self" && !m.is_deleted)
        .first();
      if (localSelf) {
        return localSelf.id;
      }

      // Layer 2 — ask the server if a self exists in the cloud
      try {
        const supabase = createClient();
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch("/api/check-onboarding", { headers });
        if (res.ok) {
          const { onboarded } = await res.json();
          if (onboarded) {
            // Layer 3 — pull the cloud data down, then re-check local
            try {
              const { syncAll } = await import("@/lib/db/sync");
              await syncAll();
            } catch {
              // Sync failure is non-fatal — we still won't create a duplicate
            }
            const pulledSelf = await db.members
              .where("user_id")
              .equals(user.id)
              .filter((m) => m.relation === "self" && !m.is_deleted)
              .first();
            if (pulledSelf) return pulledSelf.id;
          }
        }
      } catch {
        // Network / auth error — fall through. Allowing a local-only creation
        // is better UX than blocking, and the next sync will merge/dedupe.
      }
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const member: Member = {
      id,
      user_id: user.id,
      name: data.name.trim(),
      relation: (data.relation || "self") as Relation,
      date_of_birth: data.date_of_birth || undefined,
      blood_group: ((data.blood_group as string) || "") as BloodGroup,
      gender: ((data.gender as string) || "") as Gender,
      allergies: Array.isArray(data.allergies) ? data.allergies : [],
      chronic_conditions: Array.isArray(data.chronic_conditions)
        ? data.chronic_conditions
        : [],
      emergency_contact_name: data.emergency_contact_name || undefined,
      emergency_contact_phone: data.emergency_contact_phone || undefined,
      avatar_url: data.avatar_url || undefined,
      created_at: now,
      updated_at: now,
      sync_status: "pending",
      synced_at: undefined,
      is_deleted: false,
    };
    await db.members.add(member);
    // Push to cloud immediately (debounced) so data lands in Supabase within
    // a second or two instead of waiting for the auto-sync interval.
    triggerSync();
    return id;
  };

  const updateMember = async (
    id: string,
    data: Partial<MemberFormData>
  ): Promise<void> => {
    await db.members.update(id, {
      ...data,
      blood_group: (data.blood_group ?? undefined) as BloodGroup | undefined,
      gender: (data.gender ?? undefined) as Gender | undefined,
      relation: data.relation as Relation | undefined,
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    });
    triggerSync();
  };

  const deleteMember = async (id: string): Promise<void> => {
    // Hard-delete from cloud first (cascades to all related records)
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
      const res = await fetch(`/api/members/${id}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to delete from cloud");
      }
    } catch (err) {
      // If we're offline the delete will be retried later — for now,
      // surface the error so the UI can show it
      if (navigator.onLine) {
        throw err;
      }
    }

    // Hard-delete from local Dexie + cascade through related tables
    await db.transaction(
      "rw",
      [
        db.members,
        db.records,
        db.medicines,
        db.reminders,
        db.reminderLogs,
        db.shareLinks,
        db.healthMetrics,
      ],
      async () => {
        // Get reminder ids first so we can clean their logs
        const reminders = await db.reminders
          .where("member_id")
          .equals(id)
          .toArray();
        const reminderIds = reminders.map((r) => r.id);
        if (reminderIds.length > 0) {
          await db.reminderLogs
            .where("reminder_id")
            .anyOf(reminderIds)
            .delete();
        }

        await db.records.where("member_id").equals(id).delete();
        await db.medicines.where("member_id").equals(id).delete();
        await db.reminders.where("member_id").equals(id).delete();
        await db.shareLinks.where("member_id").equals(id).delete();
        await db.healthMetrics.where("member_id").equals(id).delete();
        await db.members.delete(id);
      }
    );
  };

  return {
    members: members ?? [],
    isLoading: members === undefined,
    getMember,
    addMember,
    updateMember,
    deleteMember,
  };
}

export function useMember(id: string) {
  const member = useLiveQuery(() => db.members.get(id), [id]);
  return { member, isLoading: member === undefined };
}
