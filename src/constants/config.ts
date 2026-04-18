export const APP_NAME = "MediFamily";
export const APP_TAGLINE = "Your whole family's health, in your pocket.";
export const APP_DESCRIPTION =
  "Free offline-first family health app. Store prescriptions, track medicines, and manage health records for your entire family. Works without internet. Made for India.";

// PIN Lock
export const PIN_LENGTH = 4;
export const PIN_LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// Sync — auto cloud sync cadence. Aggressive enough that users see their
// data in Supabase within a couple minutes, conservative enough to avoid
// hammering the API on every page. Event-based triggers (focus, online,
// post-mutation) cover the short gaps.
export const SYNC_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

// Reminders
export const REMINDER_CHECK_INTERVAL_MS = 60 * 1000; // 1 minute
export const REMINDER_SNOOZE_MINUTES = 30;
export const REMINDER_MISSED_AFTER_MINUTES = 60;
export const QUIET_HOURS_START = "22:00";
export const QUIET_HOURS_END = "07:00";

// Share links
export const SHARE_LINK_DEFAULT_HOURS = 24;
export const SHARE_LINK_OPTIONS_HOURS = [1, 6, 24, 72, 168]; // 1hr, 6hr, 24hr, 3d, 7d

// Image
export const MAX_IMAGE_SIZE_KB = 500;
export const MAX_IMAGES_PER_RECORD = 10;

// Record types
export const RECORD_TYPE_LABELS: Record<string, string> = {
  prescription: "Prescription",
  lab_report: "Lab Report",
  vaccination: "Vaccination",
  bill: "Medical Bill",
  discharge_summary: "Discharge Summary",
  other: "Other",
};

// Relations
export const RELATION_LABELS: Record<string, string> = {
  self: "Self",
  spouse: "Spouse",
  father: "Father",
  mother: "Mother",
  son: "Son",
  daughter: "Daughter",
  grandfather: "Grandfather",
  grandmother: "Grandmother",
  brother: "Brother",
  sister: "Sister",
  other: "Other",
};

// Blood groups
export const BLOOD_GROUPS = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
] as const;

// Frequency labels
export const FREQUENCY_LABELS: Record<string, string> = {
  once_daily: "Once daily",
  twice_daily: "Twice daily",
  thrice_daily: "Three times daily",
  weekly: "Weekly",
  as_needed: "As needed",
  custom: "Custom",
};
