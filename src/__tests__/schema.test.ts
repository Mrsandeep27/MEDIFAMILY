import { describe, it, expect } from "vitest";
import type {
  Member,
  HealthRecord,
  Medicine,
  Reminder,
  ReminderLog,
  ShareLink,
  HealthMetric,
  SyncStatus,
  Relation,
  BloodGroup,
  Gender,
  RecordType,
  Frequency,
  DayOfWeek,
  ReminderStatus,
  MetricType,
} from "@/lib/db/schema";

describe("Schema Types", () => {
  it("SyncStatus has valid values", () => {
    const statuses: SyncStatus[] = ["pending", "synced", "conflict"];
    expect(statuses).toHaveLength(3);
  });

  it("Member type is well-formed", () => {
    const member: Member = {
      id: "test-id",
      user_id: "user-1",
      name: "Test User",
      relation: "self",
      blood_group: "B+",
      gender: "male",
      allergies: ["Penicillin"],
      chronic_conditions: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: "pending",
      is_deleted: false,
    };
    expect(member.id).toBeTruthy();
    expect(member.name).toBe("Test User");
    expect(member.relation).toBe("self");
  });

  it("HealthRecord type is well-formed", () => {
    const record: HealthRecord = {
      id: "rec-1",
      member_id: "mem-1",
      type: "prescription",
      title: "Test Prescription",
      image_urls: [],
      tags: ["test"],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: "synced",
      is_deleted: false,
    };
    expect(record.type).toBe("prescription");
    expect(record.tags).toContain("test");
  });

  it("Medicine type is well-formed", () => {
    const med: Medicine = {
      id: "med-1",
      record_id: "rec-1",
      member_id: "mem-1",
      name: "Paracetamol",
      dosage: "500mg",
      frequency: "twice_daily",
      before_food: false,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: "pending",
      is_deleted: false,
    };
    expect(med.name).toBe("Paracetamol");
    expect(med.is_active).toBe(true);
  });

  it("Reminder type is well-formed", () => {
    const reminder: Reminder = {
      id: "rem-1",
      medicine_id: "med-1",
      member_id: "mem-1",
      medicine_name: "Paracetamol",
      member_name: "Sandeep",
      before_food: false,
      time: "08:00",
      days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: "pending",
      is_deleted: false,
    };
    expect(reminder.time).toMatch(/^\d{2}:\d{2}$/);
    expect(reminder.days).toHaveLength(7);
  });

  it("All DayOfWeek values are valid", () => {
    const days: DayOfWeek[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    expect(days).toHaveLength(7);
  });

  it("All RecordType values are valid", () => {
    const types: RecordType[] = ["prescription", "lab_report", "vaccination", "bill", "discharge_summary", "other"];
    expect(types).toHaveLength(6);
  });

  it("All Frequency values are valid", () => {
    const freqs: Frequency[] = ["once_daily", "twice_daily", "thrice_daily", "weekly", "as_needed", "custom"];
    expect(freqs).toHaveLength(6);
  });

  it("All ReminderStatus values are valid", () => {
    const statuses: ReminderStatus[] = ["taken", "missed", "skipped"];
    expect(statuses).toHaveLength(3);
  });

  it("All MetricType values are valid", () => {
    const types: MetricType[] = ["bp", "sugar", "weight", "temperature", "spo2"];
    expect(types).toHaveLength(5);
  });

  it("All Relation values are valid", () => {
    const rels: Relation[] = ["self", "spouse", "father", "mother", "son", "daughter", "grandfather", "grandmother", "brother", "sister", "other"];
    expect(rels).toHaveLength(11);
  });

  it("All BloodGroup values are valid", () => {
    const groups: BloodGroup[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", ""];
    expect(groups).toHaveLength(9);
  });

  it("All Gender values are valid", () => {
    const genders: Gender[] = ["male", "female", "other", ""];
    expect(genders).toHaveLength(4);
  });

  it("ShareLink type is well-formed", () => {
    const link: ShareLink = {
      id: "sl-1",
      member_id: "mem-1",
      created_by: "user-1",
      token: "abc123",
      record_ids: ["rec-1", "rec-2"],
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: "pending",
      is_deleted: false,
    };
    expect(link.token).toBeTruthy();
    expect(link.record_ids).toHaveLength(2);
  });

  it("HealthMetric type is well-formed", () => {
    const metric: HealthMetric = {
      id: "hm-1",
      member_id: "mem-1",
      type: "bp",
      value: { systolic: 120, diastolic: 80 },
      recorded_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: "pending",
      is_deleted: false,
    };
    expect(metric.value.systolic).toBe(120);
    expect(metric.value.diastolic).toBe(80);
  });
});
