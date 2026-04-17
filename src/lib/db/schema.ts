// ============================================================
// MediFamily Database Schema — TypeScript Interfaces
// All tables use SyncMeta for offline-first sync tracking
// ============================================================

export type SyncStatus = "pending" | "synced" | "conflict";

export interface SyncMeta {
  sync_status: SyncStatus;
  synced_at?: string;
  is_deleted: boolean;
  updated_at: string;
}

// ============================================================
// Family Members
// ============================================================

export type Relation =
  | "self"
  | "spouse"
  | "father"
  | "mother"
  | "son"
  | "daughter"
  | "grandfather"
  | "grandmother"
  | "brother"
  | "sister"
  | "other";

export type BloodGroup =
  | "A+"
  | "A-"
  | "B+"
  | "B-"
  | "AB+"
  | "AB-"
  | "O+"
  | "O-"
  | "";

export type Gender = "male" | "female" | "other" | "";

export interface Member extends SyncMeta {
  id: string;
  user_id: string;
  name: string;
  relation: Relation;
  date_of_birth?: string;
  blood_group: BloodGroup;
  gender: Gender;
  allergies: string[];
  chronic_conditions: string[];
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  avatar_url?: string;
  abha_number?: string;
  abha_address?: string;
  created_at: string;
}

// ============================================================
// Health Records
// ============================================================

export type RecordType =
  | "prescription"
  | "lab_report"
  | "vaccination"
  | "bill"
  | "discharge_summary"
  | "other";

export interface HealthRecord extends SyncMeta {
  id: string;
  member_id: string;
  type: RecordType;
  title: string;
  doctor_name?: string;
  hospital_name?: string;
  visit_date?: string;
  diagnosis?: string;
  notes?: string;
  image_urls: string[];
  local_image_blobs?: Blob[];
  raw_ocr_text?: string;
  ai_extracted?: Record<string, unknown>;
  tags: string[];
  created_at: string;
}

// ============================================================
// Medicines (extracted from prescriptions)
// ============================================================

export type Frequency =
  | "once_daily"
  | "twice_daily"
  | "thrice_daily"
  | "weekly"
  | "as_needed"
  | "custom";

export interface Medicine extends SyncMeta {
  id: string;
  record_id: string;
  member_id: string;
  name: string;
  dosage?: string;
  frequency?: Frequency;
  duration?: string;
  before_food: boolean;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  created_at: string;
}

// ============================================================
// Reminders
// ============================================================

export type DayOfWeek = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface Reminder extends SyncMeta {
  id: string;
  medicine_id: string;
  member_id: string;
  medicine_name: string;
  member_name: string;
  dosage?: string;
  before_food: boolean;
  time: string; // HH:mm format
  days: DayOfWeek[];
  is_active: boolean;
  created_at: string;
}

// ============================================================
// Reminder Logs (adherence tracking)
// ============================================================

export type ReminderStatus = "taken" | "missed" | "skipped";

export interface ReminderLog extends SyncMeta {
  id: string;
  reminder_id: string;
  scheduled_at: string;
  status: ReminderStatus;
  acted_at?: string;
  created_at: string;
}

// ============================================================
// Share Links (QR code sharing)
// ============================================================

export interface ShareLink extends SyncMeta {
  id: string;
  member_id: string;
  created_by: string;
  token: string;
  record_ids: string[] | null; // null = share all
  expires_at: string;
  is_active: boolean;
  created_at: string;
}

// ============================================================
// Share Access Logs
// ============================================================

export interface ShareAccessLog {
  id: string;
  share_link_id: string;
  accessed_at: string;
  ip_address?: string;
  user_agent?: string;
  city?: string;
}

// ============================================================
// Health Metrics (manual tracking)
// ============================================================

export type MetricType = "bp" | "sugar" | "weight" | "temperature" | "spo2";

export interface HealthMetric extends SyncMeta {
  id: string;
  member_id: string;
  type: MetricType;
  value: Record<string, number>; // e.g. { systolic: 120, diastolic: 80 }
  recorded_at: string;
  notes?: string;
  created_at: string;
}

// ============================================================
// Wellness — daily tracking (water, weight, mood, workouts, food)
// ============================================================

export type Mood = "great" | "good" | "okay" | "low" | "bad";

/** One row per user per day — lightweight habit tracker. */
export interface WellnessEntry extends SyncMeta {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  water_glasses: number;
  weight_kg?: number;
  mood?: Mood;
  energy?: number; // 1-5
  sleep_hours?: number;
  notes?: string;
  created_at: string;
}

export type WorkoutType =
  | "cardio"
  | "strength"
  | "yoga"
  | "walk"
  | "cycle"
  | "sports"
  | "custom";

export type WorkoutIntensity = "light" | "moderate" | "intense";

/** One row per workout session. */
export interface Workout extends SyncMeta {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  type: WorkoutType;
  name?: string; // optional free-text (e.g. "Morning run", "Bench press")
  duration_min: number;
  intensity: WorkoutIntensity;
  distance_km?: number; // cardio only
  sets?: number; // strength only
  reps?: number;
  weight_kg?: number;
  calories_burned?: number;
  notes?: string;
  photo_blob?: Blob;
  photo_url?: string;
  created_at: string;
}

export type Meal = "breakfast" | "lunch" | "dinner" | "snack";

export interface FoodLogItem {
  name: string;
  quantity?: string; // "1 bowl", "2 pieces"
  calories: number;
}

/** One row per meal. */
export interface FoodLog extends SyncMeta {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  meal: Meal;
  items: FoodLogItem[];
  total_calories: number;
  photo_blob?: Blob;
  photo_url?: string;
  notes?: string;
  created_at: string;
}

/** One row per user — user-configurable targets. */
export interface WellnessGoals extends SyncMeta {
  id: string; // = user_id
  user_id: string;
  water_target_glasses: number;
  weight_target_kg?: number;
  workout_days_per_week: number;
  daily_calorie_target?: number;
  calorie_tracking_enabled: boolean;
  created_at: string;
}
