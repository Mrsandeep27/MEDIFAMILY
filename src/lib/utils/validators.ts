import { z } from "zod";

// ============================================================
// Reusable primitives
// ============================================================

// Phone number (Indian +91)
export const phoneSchema = z
  .string()
  .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number");

// OTP
export const otpSchema = z
  .string()
  .length(6, "OTP must be 6 digits")
  .regex(/^\d{6}$/, "OTP must contain only digits");

// PIN
export const pinSchema = z
  .string()
  .length(4, "PIN must be 4 digits")
  .regex(/^\d{4}$/, "PIN must contain only digits");

// Date string — YYYY-MM-DD with real calendar validation
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const dateStringSchema = z
  .string()
  .refine(
    (v) => {
      if (!v) return true; // allow empty
      if (!ISO_DATE_RE.test(v)) return false;
      const d = new Date(v + "T00:00:00");
      return !isNaN(d.getTime()) && d.toISOString().startsWith(v);
    },
    "Date must be a valid YYYY-MM-DD"
  );

// Aadhaar — exactly 12 digits
export const aadhaarSchema = z
  .string()
  .length(12, "Aadhaar must be 12 digits")
  .regex(/^\d{12}$/, "Aadhaar must contain only digits");

// ABHA Health ID — alphanumeric with optional dots, 4-32 chars
export const healthIdSchema = z
  .string()
  .min(4, "Health ID too short")
  .max(32, "Health ID too long")
  .regex(/^[a-zA-Z0-9.]+$/, "Health ID can only contain letters, numbers, and dots");

// Transaction ID — non-empty string, max 256
export const txnIdSchema = z.string().min(1, "Transaction ID required").max(256);

// ============================================================
// Form schemas
// ============================================================

// Family member — minimal: only name + relation required
export const memberSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  relation: z.enum([
    "self",
    "spouse",
    "father",
    "mother",
    "son",
    "daughter",
    "grandfather",
    "grandmother",
    "brother",
    "sister",
    "other",
  ]),
  date_of_birth: dateStringSchema.optional().or(z.literal("")),
  blood_group: z
    .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])
    .optional()
    .or(z.literal("")),
  gender: z.enum(["male", "female", "other"]).optional().or(z.literal("")),
  allergies: z.array(z.string().max(100)).max(50, "Maximum 50 allergies"),
  chronic_conditions: z.array(z.string().max(100)).max(50, "Maximum 50 conditions"),
  emergency_contact_name: z.string().max(100).optional().or(z.literal("")),
  emergency_contact_phone: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => !v || /^[6-9]\d{9}$/.test(v),
      "Enter a valid 10-digit mobile number"
    ),
});

export type MemberFormData = z.infer<typeof memberSchema>;

// Health record
export const recordSchema = z.object({
  member_id: z.string().min(1, "Select a family member"),
  type: z.enum([
    "prescription",
    "lab_report",
    "vaccination",
    "bill",
    "discharge_summary",
    "other",
  ]),
  title: z.string().min(1, "Title is required").max(200),
  doctor_name: z.string().max(200).optional(),
  hospital_name: z.string().max(200).optional(),
  visit_date: dateStringSchema.optional().or(z.literal("")),
  diagnosis: z.string().max(2000).optional(),
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string().max(50)).max(20, "Maximum 20 tags"),
});

export type RecordFormData = z.infer<typeof recordSchema>;

// ============================================================
// API-level schemas (server-side validation)
// ============================================================

export const feedbackSchema = z.object({
  user_id: z.string().uuid("Invalid user ID").optional().nullable(),
  user_email: z.string().email("Invalid email").max(254).optional().nullable(),
  user_name: z.string().max(100).optional().nullable(),
  category: z.enum(["bug", "feature", "review", "other"]).default("review"),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  message: z.string().min(3, "Message too short").max(2000, "Message too long"),
  page: z.string().max(200).optional().nullable(),
  device: z.string().max(200).optional().nullable(),
});

export const feedbackPatchSchema = z.object({
  id: z.string().uuid("Feedback ID required"),
  status: z.enum(["new", "reviewed", "resolved", "archived"]).optional(),
  admin_note: z.string().max(2000).optional(),
});

export const visitPrepSchema = z.object({
  brief: z.string().min(10, "Brief too short").max(4000, "Brief too long"),
});

export const abhaActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("generate-aadhaar-otp"),
    aadhaar: aadhaarSchema,
  }),
  z.object({
    action: z.literal("verify-aadhaar-otp"),
    txnId: txnIdSchema,
    otp: otpSchema,
  }),
  z.object({
    action: z.literal("generate-mobile-otp"),
    txnId: txnIdSchema,
    mobile: phoneSchema,
  }),
  z.object({
    action: z.literal("verify-mobile-create"),
    txnId: txnIdSchema,
    otp: otpSchema,
  }),
  z.object({
    action: z.literal("create-health-id"),
    txnId: txnIdSchema,
    healthId: healthIdSchema,
    firstName: z.string().min(1).max(100),
    lastName: z.string().max(100).optional(),
  }),
  z.object({
    action: z.literal("search-abha"),
    healthId: healthIdSchema,
  }),
  z.object({
    action: z.literal("login-mobile-otp"),
    healthId: healthIdSchema,
  }),
  z.object({
    action: z.literal("login-aadhaar-otp"),
    healthId: healthIdSchema,
  }),
  z.object({
    action: z.literal("confirm-auth"),
    txnId: txnIdSchema,
    otp: otpSchema,
  }),
  z.object({
    action: z.literal("get-profile"),
    xToken: z.string().min(1, "xToken required").max(4096),
  }),
]);
