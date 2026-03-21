"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db/dexie";
import type { HealthRecord, RecordType } from "@/lib/db/schema";
import { useAuthStore } from "@/stores/auth-store";
import type { RecordFormData } from "@/lib/utils/validators";

export function useRecords(memberId?: string) {
  const user = useAuthStore((s) => s.user);

  const records = useLiveQuery(
    () => {
      if (!user) return [];
      let query = db.records.where("is_deleted").equals(0);
      if (memberId) {
        query = db.records.where({ member_id: memberId, is_deleted: false });
      }
      return db.records
        .filter((r) => !r.is_deleted && (memberId ? r.member_id === memberId : true))
        .toArray()
        .then((rs) => rs.sort((a, b) =>
          new Date(b.visit_date || b.created_at).getTime() -
          new Date(a.visit_date || a.created_at).getTime()
        ));
    },
    [user?.id, memberId]
  );

  const addRecord = async (
    data: RecordFormData,
    images?: File[]
  ): Promise<string> => {
    if (!user) throw new Error("Not authenticated");
    const id = uuidv4();
    const now = new Date().toISOString();

    const imageBlobs: Blob[] = [];
    const imageUrls: string[] = [];

    if (images && images.length > 0) {
      for (const img of images) {
        const compressed = await compressImage(img);
        imageBlobs.push(compressed);
        imageUrls.push(URL.createObjectURL(compressed));
      }
    }

    const record: HealthRecord = {
      id,
      member_id: data.member_id,
      type: data.type as RecordType,
      title: data.title,
      doctor_name: data.doctor_name,
      hospital_name: data.hospital_name,
      visit_date: data.visit_date,
      diagnosis: data.diagnosis,
      notes: data.notes,
      image_urls: imageUrls,
      local_image_blobs: imageBlobs,
      tags: data.tags,
      created_at: now,
      updated_at: now,
      sync_status: "pending",
      is_deleted: false,
    };

    await db.records.add(record);
    return id;
  };

  const updateRecord = async (
    id: string,
    data: Partial<RecordFormData>,
    newImages?: File[]
  ): Promise<void> => {
    const existing = await db.records.get(id);
    if (!existing) throw new Error("Record not found");

    const updateData: Partial<HealthRecord> = {
      ...data,
      type: data.type as RecordType | undefined,
      updated_at: new Date().toISOString(),
      sync_status: "pending" as const,
    };

    if (newImages && newImages.length > 0) {
      const newBlobs = await Promise.all(newImages.map(compressImage));
      updateData.local_image_blobs = [
        ...(existing.local_image_blobs || []),
        ...newBlobs,
      ];
      updateData.image_urls = [
        ...existing.image_urls,
        ...newBlobs.map((b) => URL.createObjectURL(b)),
      ];
    }

    await db.records.update(id, updateData);
  };

  const deleteRecord = async (id: string): Promise<void> => {
    await db.records.update(id, {
      is_deleted: true,
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    });
  };

  const searchRecords = async (query: string): Promise<HealthRecord[]> => {
    const q = query.toLowerCase();
    return db.records
      .filter(
        (r) =>
          !r.is_deleted &&
          (r.title.toLowerCase().includes(q) ||
            (r.doctor_name?.toLowerCase().includes(q) ?? false) ||
            (r.hospital_name?.toLowerCase().includes(q) ?? false) ||
            (r.diagnosis?.toLowerCase().includes(q) ?? false) ||
            (r.notes?.toLowerCase().includes(q) ?? false) ||
            r.tags.some((t) => t.toLowerCase().includes(q)))
      )
      .toArray();
  };

  return {
    records: records ?? [],
    isLoading: records === undefined,
    addRecord,
    updateRecord,
    deleteRecord,
    searchRecords,
  };
}

export function useRecord(id: string) {
  const record = useLiveQuery(() => db.records.get(id), [id]);
  return { record, isLoading: record === undefined };
}

async function compressImage(file: File | Blob, maxSizeKB = 500): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let { width, height } = img;

      const MAX_DIM = 1920;
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
        width *= ratio;
        height *= ratio;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.8;
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (blob && (blob.size / 1024 > maxSizeKB) && quality > 0.2) {
              quality -= 0.1;
              tryCompress();
            } else {
              resolve(blob || new Blob());
            }
          },
          "image/jpeg",
          quality
        );
      };
      tryCompress();
    };
    img.src = url;
  });
}
