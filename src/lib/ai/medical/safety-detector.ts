/**
 * Safety Detector (SERVER-SIDE)
 * ──────────────────────────────
 * Pure-JS scan over the AI Doctor's response to catch unsafe outputs
 * before they reach the user. Triggers after every AI response — if a
 * violation is found, a rule_candidate is queued so the admin can lock
 * down the missing constraint.
 *
 * IMPORTANT: this runs on EVERY response. It must be fast (<5ms) and
 * never throw. No DB calls. No LLM calls. Pure string + JSON scanning.
 */

import allergyConflictsJson from "./reference/allergy-conflicts.json";
import pregnancyUnsafeJson from "./reference/pregnancy-unsafe.json";
import otcDrugsJson from "./reference/otc-drugs.json";
import redFlagsJson from "./reference/red-flags.json";

interface AIResponse {
  urgency?: string;
  reply?: string;
  otc_medicines?: Array<{ name?: string; dosage?: string; warning?: string }>;
  what_to_do?: string[];
  home_remedies?: string[];
}

interface PatientContext {
  allergies?: string[];
  isPregnant?: boolean;
  ageYears?: number | null;
}

export interface SafetyViolation {
  reason: string;     // human-readable, used as trigger_reason
  severity: "high" | "critical";
  category: string;   // safety | red_flag | grounding
}

const allergyMap = (allergyConflictsJson as { conflicts: Record<string, string[]> }).conflicts;
const pregnancyDrugs = (pregnancyUnsafeJson as { drugs: string[] }).drugs;
const otcSet = new Set<string>();
for (const d of (otcDrugsJson as { drugs: Array<{ name: string; aliases: string[] }> }).drugs) {
  otcSet.add(d.name.toLowerCase());
  for (const a of d.aliases) otcSet.add(a.toLowerCase());
}
const redFlagPatterns = (redFlagsJson as { patterns: Array<{ match: string[]; reason: string }> }).patterns;

/**
 * Collect every drug name the AI suggested across structured + freeform fields.
 */
function collectMentionedDrugs(response: AIResponse): string[] {
  const out: string[] = [];
  if (Array.isArray(response.otc_medicines)) {
    for (const m of response.otc_medicines) {
      if (m?.name) out.push(String(m.name).toLowerCase());
    }
  }
  // Also scan freeform fields for drug-name leakage in case the model put
  // them in the reply or what_to_do instead of the structured field.
  const freeText = [
    response.reply || "",
    ...(Array.isArray(response.what_to_do) ? response.what_to_do : []),
    ...(Array.isArray(response.home_remedies) ? response.home_remedies : []),
  ].join(" ").toLowerCase();
  // Look for any common drug name in freeform — don't worry about false positives,
  // we only flag genuinely contraindicated ones below.
  for (const otc of otcSet) {
    if (freeText.includes(otc)) out.push(otc);
  }
  return Array.from(new Set(out));
}

export function detectSafetyViolations(
  response: AIResponse,
  patient: PatientContext,
  userMessage: string
): SafetyViolation[] {
  const violations: SafetyViolation[] = [];
  const drugs = collectMentionedDrugs(response);

  // ── 1. Allergy violations ─────────────────────────────────────────────
  if (patient.allergies && patient.allergies.length > 0 && drugs.length > 0) {
    for (const allergy of patient.allergies) {
      const aLower = allergy.toLowerCase();
      for (const [allergyKey, conflictDrugs] of Object.entries(allergyMap)) {
        if (!aLower.includes(allergyKey)) continue;
        for (const drug of drugs) {
          for (const conflict of conflictDrugs) {
            if (drug.includes(conflict.toLowerCase()) || conflict.toLowerCase().includes(drug)) {
              violations.push({
                reason: `AI suggested "${drug}" but patient is allergic to ${allergyKey} (conflicts with ${conflict})`,
                severity: "critical",
                category: "safety",
              });
            }
          }
        }
      }
    }
  }

  // ── 2. Pregnancy violations ───────────────────────────────────────────
  if (patient.isPregnant && drugs.length > 0) {
    for (const drug of drugs) {
      for (const unsafe of pregnancyDrugs) {
        if (drug.includes(unsafe.toLowerCase()) || unsafe.toLowerCase().includes(drug)) {
          violations.push({
            reason: `AI suggested "${drug}" to a pregnant patient (pregnancy-unsafe)`,
            severity: "critical",
            category: "safety",
          });
        }
      }
    }
  }

  // ── 3. Pediatric aspirin (Reye's syndrome) ────────────────────────────
  if (patient.ageYears !== null && patient.ageYears !== undefined && patient.ageYears < 18) {
    for (const drug of drugs) {
      if (drug.includes("aspirin") || drug.includes("ecosprin") || drug.includes("disprin")) {
        violations.push({
          reason: `AI suggested aspirin to a ${patient.ageYears}-year-old (Reye's syndrome risk)`,
          severity: "critical",
          category: "safety",
        });
      }
    }
  }

  // ── 4. Red flag in user message but AI urgency is green/yellow ────────
  const msgLower = userMessage.toLowerCase();
  for (const pat of redFlagPatterns) {
    for (const phrase of pat.match) {
      if (msgLower.includes(phrase.toLowerCase())) {
        if (response.urgency === "green" || response.urgency === "yellow") {
          violations.push({
            reason: `User mentioned "${phrase}" (${pat.reason}) but AI urgency was "${response.urgency}" — should be red`,
            severity: "critical",
            category: "red_flag",
          });
        }
      }
    }
  }

  // ── 5. Non-OTC drug in structured otc_medicines field ─────────────────
  if (Array.isArray(response.otc_medicines)) {
    for (const med of response.otc_medicines) {
      if (!med?.name) continue;
      const name = String(med.name).toLowerCase().trim();
      if (!name) continue;
      // Skip if any token of the drug name matches an OTC alias
      const tokens = name.split(/[\s,()-]+/);
      const isOtc = tokens.some((tok) => otcSet.has(tok)) || Array.from(otcSet).some((otc) => name.includes(otc));
      if (!isOtc) {
        violations.push({
          reason: `AI listed "${name}" as OTC but it is not in the approved OTC list`,
          severity: "high",
          category: "safety",
        });
      }
    }
  }

  return violations;
}
