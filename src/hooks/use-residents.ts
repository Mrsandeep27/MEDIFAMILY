"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db/dexie";
import type { Member, Relation } from "@/lib/db/schema";
import { useAuthStore } from "@/stores/auth-store";
import { triggerSync } from "@/lib/db/sync";

export interface ResidentFormData {
  name: string;
  date_of_birth?: string;
  room_no?: string;
  blood_group?: string;
  conditions?: string[];
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  admission_date?: string;
}

/**
 * Active residents for the current care-home user, sorted by room number
 * (lexicographic — "101", "102", "201" sort correctly; "A1", "A2", "B1"
 * also work). Discharged residents are excluded — they're retained in
 * Dexie for compliance but hidden from daily workflows.
 */
export function useResidents() {
  const user = useAuthStore((s) => s.user);

  const residents = useLiveQuery(
    () => {
      if (!user) return [] as Member[];
      return db.members
        .where("user_id")
        .equals(user.id)
        .filter((m) => !m.is_deleted && m.is_resident === true && !m.discharged_at)
        .toArray()
        .then((rows) => {
          rows.sort((a, b) => {
            const aRoom = (a.room_no || "").trim();
            const bRoom = (b.room_no || "").trim();
            if (aRoom && bRoom) return aRoom.localeCompare(bRoom, undefined, { numeric: true });
            if (aRoom) return -1;
            if (bRoom) return 1;
            return a.name.localeCompare(b.name);
          });
          return rows;
        });
    },
    [user?.id]
  );

  const addResident = async (data: ResidentFormData): Promise<string> => {
    if (!user) throw new Error("Not authenticated");
    const id = uuidv4();
    const now = new Date().toISOString();
    const member: Member = {
      id,
      user_id: user.id,
      name: data.name.trim(),
      // Residents reuse the "other" relation slot so existing schema
      // constraints + UI components keep working without changes.
      relation: "other" as Relation,
      date_of_birth: data.date_of_birth || undefined,
      blood_group: (data.blood_group as Member["blood_group"]) || "",
      gender: "",
      allergies: [],
      chronic_conditions: data.conditions || [],
      emergency_contact_name: data.emergency_contact_name || undefined,
      emergency_contact_phone: data.emergency_contact_phone || undefined,
      avatar_url: undefined,
      is_resident: true,
      room_no: data.room_no?.trim() || undefined,
      admission_date: data.admission_date || now.slice(0, 10),
      discharged_at: undefined,
      created_at: now,
      updated_at: now,
      sync_status: "pending",
      synced_at: undefined,
      is_deleted: false,
    };
    await db.members.add(member);
    triggerSync();
    return id;
  };

  const dischargeResident = async (
    id: string,
    reason: string
  ): Promise<void> => {
    const now = new Date().toISOString();
    await db.members.update(id, {
      discharged_at: now,
      discharge_reason: reason,
      updated_at: now,
      sync_status: "pending",
    });
    triggerSync();
  };

  return {
    residents: residents ?? [],
    isLoading: residents === undefined,
    addResident,
    dischargeResident,
  };
}
