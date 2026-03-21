"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db/dexie";
import type { ShareLink } from "@/lib/db/schema";
import { useAuthStore } from "@/stores/auth-store";
import { SHARE_LINK_DEFAULT_HOURS } from "@/constants/config";

export function useShareLinks(memberId?: string) {
  const user = useAuthStore((s) => s.user);

  const shareLinks = useLiveQuery(
    () =>
      db.shareLinks
        .filter(
          (l) =>
            !l.is_deleted &&
            (memberId ? l.member_id === memberId : true) &&
            l.is_active
        )
        .toArray(),
    [memberId]
  );

  const createShareLink = async (
    memberIdParam: string,
    recordIds: string[] | null = null,
    expiryHours: number = SHARE_LINK_DEFAULT_HOURS
  ): Promise<ShareLink> => {
    if (!user) throw new Error("Not authenticated");

    const id = uuidv4();
    const token = generateToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiryHours * 60 * 60 * 1000);

    const link: ShareLink = {
      id,
      member_id: memberIdParam,
      created_by: user.id,
      token,
      record_ids: recordIds,
      expires_at: expiresAt.toISOString(),
      is_active: true,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      sync_status: "pending",
      is_deleted: false,
    };

    await db.shareLinks.add(link);
    return link;
  };

  const revokeShareLink = async (id: string): Promise<void> => {
    await db.shareLinks.update(id, {
      is_active: false,
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    });
  };

  const deleteShareLink = async (id: string): Promise<void> => {
    await db.shareLinks.update(id, {
      is_deleted: true,
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    });
  };

  return {
    shareLinks: shareLinks ?? [],
    isLoading: shareLinks === undefined,
    createShareLink,
    revokeShareLink,
    deleteShareLink,
  };
}

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  for (let i = 0; i < 32; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
}
