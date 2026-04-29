"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db/dexie";
import type { CareHomeShare } from "@/lib/db/schema";
import { useAuthStore } from "@/stores/auth-store";
import { triggerSync } from "@/lib/db/sync";

function randomToken(len = 32): string {
  // URL-safe random — base36 of 16 random bytes is enough for unguessable
  // tokens. crypto.getRandomValues for proper entropy.
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, len);
}

export interface CreateShareInput {
  member_id: string;
  authorized_phone: string; // 10-digit Indian mobile
  expires_at?: string | null;
}

/**
 * Care-home family shares — read-only links gated by phone OTP. Caretaker
 * generates a link, picks the family member's phone; family opens the
 * link, enters that phone, gets an OTP, sees the resident view.
 */
export function useCareShares(memberId?: string) {
  const user = useAuthStore((s) => s.user);

  const shares = useLiveQuery(
    async () => {
      if (!user) return [] as CareHomeShare[];
      const all = await (memberId
        ? db.careHomeShares.where("member_id").equals(memberId)
        : db.careHomeShares
      )
        .filter((s) => !s.is_deleted)
        .toArray();
      all.sort((a, b) => b.created_at.localeCompare(a.created_at));
      return all;
    },
    [user?.id, memberId]
  );

  const createShare = async (input: CreateShareInput): Promise<CareHomeShare> => {
    if (!user) throw new Error("Not authenticated");
    const id = uuidv4();
    const now = new Date().toISOString();
    const share: CareHomeShare = {
      id,
      member_id: input.member_id,
      token: randomToken(32),
      authorized_phone: input.authorized_phone.replace(/\D/g, ""),
      expires_at: input.expires_at ?? null,
      revoked_at: null,
      last_accessed_at: null,
      created_by: user.id,
      created_at: now,
      updated_at: now,
      sync_status: "pending",
      synced_at: undefined,
      is_deleted: false,
    };
    await db.careHomeShares.add(share);
    triggerSync();
    return share;
  };

  const revokeShare = async (id: string): Promise<void> => {
    const now = new Date().toISOString();
    await db.careHomeShares.update(id, {
      revoked_at: now,
      updated_at: now,
      sync_status: "pending",
    });
    triggerSync();
  };

  return {
    shares: shares ?? [],
    isLoading: shares === undefined,
    createShare,
    revokeShare,
  };
}
