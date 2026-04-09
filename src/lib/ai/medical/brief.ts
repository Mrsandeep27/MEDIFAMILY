"use client";

/**
 * Patient Medical Brief Builder (CLIENT-SIDE)
 * ─────────────────────────────────────────────
 * Builds a compact, structured snapshot of a patient from Dexie that gets
 * sent to the AI Doctor on every chat request. The brief is the AI's
 * "ground truth" — it must reference these facts when relevant and never
 * contradict them.
 *
 * Hard caps (so the brief stays small and fast):
 *   - max 5 active medicines
 *   - max 5 recent visits (last 6 months)
 *   - max 8 vital readings (last 30 days)
 *   - max 3 abnormal lab flags
 *   - each text field truncated
 *
 * Token budget: typical ~250-400 tokens, capped at ~600.
 */

import { db } from "@/lib/db/dexie";
import allergyConflicts from "./reference/allergy-conflicts.json";
import pregnancyUnsafe from "./reference/pregnancy-unsafe.json";

const MAX_MEDS = 5;
const MAX_VISITS = 5;
const MAX_VITALS = 8;
const VISIT_DAYS = 180;
const VITAL_DAYS = 30;
const TEXT_CAP = 100;

export interface PatientBrief {
  text: string;             // formatted plain-text brief for the LLM
  contraindications: string[]; // computed list of "DO NOT suggest X" lines
  isPregnant: boolean;
  ageYears: number | null;
}

function trim(s: string | undefined | null, max = TEXT_CAP): string {
  if (!s) return "";
  const cleaned = String(s).replace(/\s+/g, " ").trim();
  return cleaned.length > max ? cleaned.slice(0, max - 1) + "…" : cleaned;
}

function ageFromDob(dob: string | undefined): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 31557600000);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function formatVital(metricType: string, value: Record<string, number>): string {
  switch (metricType) {
    case "bp": return `${value.systolic ?? "?"}/${value.diastolic ?? "?"} mmHg`;
    case "sugar": return `${value.mg_dl ?? value.value ?? "?"} mg/dL`;
    case "weight": return `${value.kg ?? value.value ?? "?"} kg`;
    case "temperature": return `${value.fahrenheit ?? value.value ?? "?"}°F`;
    case "spo2": return `${value.percent ?? value.value ?? "?"}%`;
    default: return JSON.stringify(value);
  }
}

/**
 * Inspect a patient's allergies + pregnancy status and produce explicit
 * "DO NOT suggest X" lines that the LLM cannot ignore.
 */
function computeContraindications(
  allergies: string[],
  isPregnant: boolean
): string[] {
  const out: string[] = [];
  const conflicts = (allergyConflicts as { conflicts: Record<string, string[]> }).conflicts;

  for (const allergy of allergies) {
    const key = allergy.toLowerCase().trim();
    for (const [allergyKey, drugs] of Object.entries(conflicts)) {
      if (key.includes(allergyKey)) {
        out.push(`⚠️ DO NOT suggest ${drugs.slice(0, 4).join(", ")} (patient allergic to ${allergyKey})`);
      }
    }
  }

  if (isPregnant) {
    const drugs = (pregnancyUnsafe as { drugs: string[] }).drugs;
    out.push(`⚠️ PREGNANT — DO NOT suggest ANY medicine. Always say "consult doctor". Specifically avoid: ${drugs.slice(0, 8).join(", ")}.`);
  }

  return out;
}

/**
 * Build the brief for one member. All Dexie queries run in parallel.
 * Returns a stable string suitable for prompt injection plus structured
 * metadata used by the safety detector.
 */
export async function buildPatientBrief(memberId: string): Promise<PatientBrief | null> {
  if (!memberId) return null;

  const member = await db.members.get(memberId);
  if (!member || member.is_deleted) return null;

  // Run all reads in parallel
  const [allMedicines, allRecords, allMetrics] = await Promise.all([
    db.medicines.where("member_id").equals(memberId).filter((m) => !m.is_deleted).toArray(),
    db.records.where("member_id").equals(memberId).filter((r) => !r.is_deleted).toArray(),
    db.healthMetrics.where("member_id").equals(memberId).filter((h) => !h.is_deleted).toArray(),
  ]);

  const age = ageFromDob(member.date_of_birth);
  const allergies = member.allergies || [];
  const chronic = member.chronic_conditions || [];

  // Pregnancy heuristic: chronic_conditions contains "pregnant" or "pregnancy"
  const isPregnant = chronic.some((c) => /pregnan/i.test(c));

  // ── Active medicines (most recent first, capped) ──────────────────────
  const activeMeds = allMedicines
    .filter((m) => m.is_active)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, MAX_MEDS)
    .map((m) => {
      const parts = [trim(m.name, 40)];
      if (m.dosage) parts.push(trim(m.dosage, 30));
      if (m.frequency) parts.push(m.frequency.replace(/_/g, " "));
      if (m.before_food) parts.push("before food");
      return "- " + parts.join(", ");
    });

  // ── Recent visits (last 6 months, capped) ─────────────────────────────
  const visitCutoff = daysAgo(VISIT_DAYS).toISOString().slice(0, 10);
  const recentVisits = allRecords
    .filter((r) => (r.visit_date || r.created_at.slice(0, 10)) >= visitCutoff)
    .sort((a, b) => (b.visit_date || b.created_at).localeCompare(a.visit_date || a.created_at))
    .slice(0, MAX_VISITS)
    .map((r) => {
      const date = (r.visit_date || r.created_at.slice(0, 10));
      const parts = [date];
      if (r.doctor_name) parts.push(`Dr. ${trim(r.doctor_name, 30)}`);
      if (r.type && r.type !== "other") parts.push(r.type.replace(/_/g, " "));
      if (r.diagnosis) parts.push(trim(r.diagnosis, 80));
      else if (r.title) parts.push(trim(r.title, 80));
      return "- " + parts.join(" · ");
    });

  // ── Recent vitals (last 30 days, capped) ──────────────────────────────
  const vitalCutoff = daysAgo(VITAL_DAYS).toISOString();
  const recentVitals = allMetrics
    .filter((h) => h.recorded_at >= vitalCutoff)
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
    .slice(0, MAX_VITALS);

  // Group by type so we don't blast 8 BP readings if there are also weights
  const vitalsByType = new Map<string, typeof recentVitals>();
  for (const v of recentVitals) {
    const arr = vitalsByType.get(v.type) || [];
    arr.push(v);
    vitalsByType.set(v.type, arr);
  }
  const vitalLines: string[] = [];
  for (const [type, readings] of vitalsByType) {
    const top = readings.slice(0, 3); // up to 3 per metric type
    const formatted = top.map((r) => `${formatVital(type, r.value)} (${r.recorded_at.slice(0, 10)})`);
    vitalLines.push(`- ${type.toUpperCase()}: ${formatted.join(", ")}`);
  }

  // ── Contraindications (computed) ──────────────────────────────────────
  const contraindications = computeContraindications(allergies, isPregnant);

  // ── Assemble the text brief ───────────────────────────────────────────
  const lines: string[] = [];
  const demo = [
    member.name,
    age !== null ? `${age}y` : null,
    member.gender,
    member.blood_group,
  ].filter(Boolean).join(", ");
  lines.push(`PATIENT: ${demo}`);

  if (allergies.length > 0) lines.push(`ALLERGIES: ${allergies.slice(0, 6).join(", ")}`);
  if (chronic.length > 0) lines.push(`CHRONIC: ${chronic.slice(0, 6).join(", ")}`);

  if (activeMeds.length > 0) {
    lines.push(`\nACTIVE MEDICINES (${activeMeds.length}):`);
    lines.push(...activeMeds);
  }

  if (vitalLines.length > 0) {
    lines.push(`\nRECENT VITALS (last ${VITAL_DAYS}d):`);
    lines.push(...vitalLines);
  }

  if (recentVisits.length > 0) {
    lines.push(`\nRECENT VISITS (last ${VISIT_DAYS}d):`);
    lines.push(...recentVisits);
  }

  if (contraindications.length > 0) {
    lines.push(`\nCONTRAINDICATIONS:`);
    lines.push(...contraindications);
  }

  return {
    text: lines.join("\n"),
    contraindications,
    isPregnant,
    ageYears: age,
  };
}
