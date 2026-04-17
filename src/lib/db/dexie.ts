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
  WellnessEntry,
  Workout,
  FoodLog,
  WellnessGoals,
  Exercise,
  Routine,
  GymSession,
  GymSet,
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
  wellnessEntries!: Table<WellnessEntry>;
  workouts!: Table<Workout>;
  foodLogs!: Table<FoodLog>;
  wellnessGoals!: Table<WellnessGoals>;
  exercises!: Table<Exercise>;
  routines!: Table<Routine>;
  gymSessions!: Table<GymSession>;
  gymSets!: Table<GymSet>;

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

    // v3: Wellness tracking (water, weight, mood, workouts, food, goals)
    this.version(3).stores({
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
      wellnessEntries:
        "id, user_id, date, sync_status, is_deleted, [user_id+date], [user_id+is_deleted]",
      workouts:
        "id, user_id, date, type, sync_status, is_deleted, [user_id+date], [user_id+is_deleted]",
      foodLogs:
        "id, user_id, date, meal, sync_status, is_deleted, [user_id+date], [user_id+is_deleted]",
      wellnessGoals: "id, user_id, sync_status, is_deleted",
    });

    // v4: Water tracking in ml (was glasses). Migrate any existing rows:
    //  entry.water_glasses -> entry.water_ml (glasses * 250)
    //  goals.water_target_glasses -> goals.water_target_ml (glasses * 250)
    this.version(4).upgrade(async (tx) => {
      await tx
        .table("wellnessEntries")
        .toCollection()
        .modify((e: Record<string, unknown>) => {
          if (e.water_ml == null) {
            const glasses = typeof e.water_glasses === "number" ? e.water_glasses : 0;
            e.water_ml = glasses * 250;
          }
          delete e.water_glasses;
        });
      await tx
        .table("wellnessGoals")
        .toCollection()
        .modify((g: Record<string, unknown>) => {
          if (g.water_target_ml == null) {
            const glasses =
              typeof g.water_target_glasses === "number" ? g.water_target_glasses : 8;
            g.water_target_ml = glasses * 250;
          }
          delete g.water_target_glasses;
        });
    });

    // v5: Gym Mode — exercises, routines, sessions, sets
    this.version(5).stores({
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
      wellnessEntries:
        "id, user_id, date, sync_status, is_deleted, [user_id+date], [user_id+is_deleted]",
      workouts:
        "id, user_id, date, type, sync_status, is_deleted, [user_id+date], [user_id+is_deleted]",
      foodLogs:
        "id, user_id, date, meal, sync_status, is_deleted, [user_id+date], [user_id+is_deleted]",
      wellnessGoals: "id, user_id, sync_status, is_deleted",
      exercises:
        "id, user_id, name, muscle_group, is_preset, sync_status, is_deleted",
      routines:
        "id, user_id, name, sync_status, is_deleted, [user_id+is_deleted]",
      gymSessions:
        "id, user_id, date, routine_id, sync_status, is_deleted, [user_id+date]",
      gymSets:
        "id, session_id, exercise_id, sync_status, [session_id+exercise_id]",
    });
  }
}

export const db = new MediFamilyDB();
