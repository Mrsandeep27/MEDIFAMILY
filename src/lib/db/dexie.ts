import Dexie, { type Table } from "dexie";
import type {
  Member,
  HealthRecord,
  Medicine,
  Reminder,
  ReminderLog,
  ShareLink,
  ShareAccessLog,
  HealthMetric,
} from "./schema";

class MediFamilyDB extends Dexie {
  members!: Table<Member>;
  records!: Table<HealthRecord>;
  medicines!: Table<Medicine>;
  reminders!: Table<Reminder>;
  reminderLogs!: Table<ReminderLog>;
  shareLinks!: Table<ShareLink>;
  shareAccessLogs!: Table<ShareAccessLog>;
  healthMetrics!: Table<HealthMetric>;

  constructor() {
    super("medifamily");

    this.version(1).stores({
      members: "id, user_id, name, relation, sync_status, is_deleted",
      records:
        "id, member_id, type, visit_date, title, sync_status, is_deleted, *tags",
      medicines:
        "id, record_id, member_id, name, is_active, sync_status, is_deleted",
      reminders:
        "id, medicine_id, member_id, is_active, time, sync_status, is_deleted",
      reminderLogs: "id, reminder_id, scheduled_at, status, sync_status",
      shareLinks: "id, member_id, token, is_active, expires_at, sync_status",
      shareAccessLogs: "id, share_link_id, accessed_at",
      healthMetrics:
        "id, member_id, type, recorded_at, sync_status, is_deleted",
    });

    // v2: Add compound indexes for common filtered queries
    this.version(2).stores({
      members: "id, user_id, name, relation, sync_status, is_deleted, [user_id+is_deleted]",
      records:
        "id, member_id, type, visit_date, title, sync_status, is_deleted, *tags, [member_id+is_deleted], [member_id+type]",
      medicines:
        "id, record_id, member_id, name, is_active, sync_status, is_deleted, [member_id+is_active], [member_id+is_deleted]",
      reminders:
        "id, medicine_id, member_id, is_active, time, sync_status, is_deleted, [member_id+is_active], [member_id+is_deleted]",
      reminderLogs: "id, reminder_id, scheduled_at, status, sync_status",
      shareLinks: "id, member_id, token, is_active, expires_at, sync_status, [member_id+is_active]",
      shareAccessLogs: "id, share_link_id, accessed_at",
      healthMetrics:
        "id, member_id, type, recorded_at, sync_status, is_deleted, [member_id+type], [member_id+is_deleted]",
    });
  }
}

export const db = new MediFamilyDB();
