"use client";

import { db } from "@/lib/db/dexie";

export interface ExportData {
  exportedAt: string;
  version: "1.0";
  members: unknown[];
  records: unknown[];
  medicines: unknown[];
  reminders: unknown[];
  reminderLogs: unknown[];
  healthMetrics: unknown[];
}

export async function exportAllData(): Promise<ExportData> {
  const [members, records, medicines, reminders, reminderLogs, healthMetrics] =
    await Promise.all([
      db.members.filter((m) => !m.is_deleted).toArray(),
      db.records.filter((r) => !r.is_deleted).toArray(),
      db.medicines.filter((m) => !m.is_deleted).toArray(),
      db.reminders.filter((r) => !r.is_deleted).toArray(),
      db.reminderLogs.toArray(),
      db.healthMetrics.filter((m) => !m.is_deleted).toArray(),
    ]);

  // Remove blobs from records for JSON export
  const cleanRecords = records.map(({ local_image_blobs, ...rest }) => rest);

  return {
    exportedAt: new Date().toISOString(),
    version: "1.0",
    members,
    records: cleanRecords,
    medicines,
    reminders,
    reminderLogs,
    healthMetrics,
  };
}

export function downloadJSON(data: ExportData): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `medilog-export-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCSV(data: ExportData): void {
  const rows: string[][] = [];

  // Header
  rows.push([
    "Member",
    "Record Type",
    "Title",
    "Doctor",
    "Hospital",
    "Visit Date",
    "Diagnosis",
    "Notes",
  ]);

  const memberMap = Object.fromEntries(
    (data.members as Array<{ id: string; name: string }>).map((m) => [m.id, m.name])
  );

  for (const record of data.records as Array<{
    member_id: string;
    type: string;
    title: string;
    doctor_name?: string;
    hospital_name?: string;
    visit_date?: string;
    diagnosis?: string;
    notes?: string;
  }>) {
    rows.push([
      memberMap[record.member_id] || "",
      record.type,
      record.title,
      record.doctor_name || "",
      record.hospital_name || "",
      record.visit_date || "",
      record.diagnosis || "",
      (record.notes || "").replace(/\n/g, " "),
    ]);
  }

  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `medilog-records-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
