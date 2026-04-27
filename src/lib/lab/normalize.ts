/**
 * Marker-name normalization for lab report comparison.
 *
 * Different labs print the same marker under different names: "HbA1c",
 * "Glycated Haemoglobin", "GHb", "HBA1C - Glycated Hb". For trend
 * comparison to work, we need a canonical key so the same marker across
 * two reports lines up.
 *
 * Strategy: rule-based first pass for the common cases (CBC, lipids,
 * LFT, KFT, thyroid, HbA1c). Anything unrecognized falls back to a
 * canonicalized form of the printed name.
 */

const MARKER_ALIASES: Record<string, string[]> = {
  // ─── CBC / Hematology ────────────────────────────────────────────
  hemoglobin: ["hemoglobin", "haemoglobin", "hb", "hgb", "haemoglobin (hb)", "hemoglobin (hb)"],
  rbc_count: ["rbc count", "rbc", "erythrocyte count", "erythrocyte (rbc) count", "red blood cell count", "red cell count"],
  pcv: ["pcv", "packed cell volume", "hematocrit", "haematocrit", "hct", "pcv (packed cell volume)"],
  mcv: ["mcv", "mean corpuscular volume", "mcv (mean corpuscular volume)"],
  mch: ["mch", "mean corpuscular hb", "mean corpuscular hemoglobin", "mch (mean corpuscular hb)"],
  mchc: ["mchc", "mean corpuscular hb concn", "mean corpuscular hemoglobin concentration", "mchc (mean corpuscular hb concn.)"],
  rdw: ["rdw", "rdw cv", "red cell distribution width", "rdw (red cell distribution width)"],
  wbc_count: ["wbc count", "wbc", "total leucocytes", "total leukocytes", "total wbc count", "total leucocytes (wbc) count", "total leukocytes (wbc) count"],
  abs_neutrophils: ["absolute neutrophils count", "abs neutrophils", "absolute neutrophil count", "anc"],
  abs_lymphocytes: ["absolute lymphocyte count", "abs lymphocytes", "absolute lymphocytes count"],
  abs_monocytes: ["absolute monocyte count", "abs monocytes", "absolute monocytes count"],
  abs_eosinophils: ["absolute eosinophil count", "abs eosinophils", "absolute eosinophils count"],
  abs_basophils: ["absolute basophil count", "abs basophils", "absolute basophils count"],
  neutrophils_pct: ["neutrophils", "neutrophils %", "neutrophils percent"],
  lymphocytes_pct: ["lymphocytes", "lymphocytes %", "lymphocytes percent"],
  monocytes_pct: ["monocytes", "monocytes %", "monocytes percent"],
  eosinophils_pct: ["eosinophils", "eosinophils %", "eosinophils percent"],
  basophils_pct: ["basophils", "basophils %", "basophils percent"],
  platelet_count: ["platelet count", "platelets", "plt"],
  mpv: ["mpv", "mean platelet volume", "mpv (mean platelet volume)"],
  pdw: ["pdw", "platelet distribution width", "pdw (platelet distribution width)"],
  pct: ["pct", "platelet haematocrit", "plateletcrit", "pct (platelet haematocrit)"],

  // ─── Diabetes / Glucose ──────────────────────────────────────────
  hba1c: ["hba1c", "hba1c - glycated haemoglobin", "hba1c - glycated hb", "glycated hemoglobin", "glycated haemoglobin", "ghb", "a1c"],
  fasting_glucose: ["fasting glucose", "fasting blood sugar", "fbs", "glucose fasting", "blood glucose fasting", "fasting plasma glucose"],
  pp_glucose: ["pp glucose", "post prandial glucose", "post prandial blood sugar", "ppbs", "postprandial glucose", "2hr pp glucose"],
  random_glucose: ["random glucose", "random blood sugar", "rbs", "glucose random"],
  mean_blood_glucose: ["mean blood glucose", "estimated average glucose", "eag"],

  // ─── Lipids ──────────────────────────────────────────────────────
  total_cholesterol: ["total cholesterol", "cholesterol total", "cholesterol - total", "cholesterol", "serum cholesterol"],
  ldl: ["ldl", "ldl cholesterol", "ldl-cholesterol", "low density lipoprotein", "ldl direct"],
  hdl: ["hdl", "hdl cholesterol", "hdl-cholesterol", "high density lipoprotein"],
  vldl: ["vldl", "vldl cholesterol", "vldl-cholesterol", "very low density lipoprotein"],
  triglycerides: ["triglycerides", "tg", "serum triglycerides"],
  non_hdl: ["non hdl cholesterol", "non-hdl", "non hdl"],
  chol_hdl_ratio: ["cholesterol / hdl ratio", "total cholesterol / hdl", "chol/hdl"],

  // ─── Liver (LFT) ────────────────────────────────────────────────
  sgot: ["sgot", "ast", "aspartate transaminase", "aspartate aminotransferase", "sgot / ast", "sgot / ast (aspartate transaminase)"],
  sgpt: ["sgpt", "alt", "alanine aminotransferase", "alanine transaminase", "sgpt / alt", "sgpt / alt (alanine aminotransferase)"],
  alkaline_phosphatase: ["alkaline phosphatase", "alp", "alk phos"],
  bilirubin_total: ["total bilirubin", "bilirubin total", "bilirubin - total", "serum bilirubin total"],
  bilirubin_direct: ["direct bilirubin", "bilirubin direct", "conjugated bilirubin"],
  bilirubin_indirect: ["indirect bilirubin", "bilirubin indirect", "unconjugated bilirubin"],
  total_protein: ["total protein", "serum total protein", "protein total"],
  albumin: ["albumin", "serum albumin"],
  globulin: ["globulin", "serum globulin"],
  ggt: ["ggt", "gamma gt", "gamma glutamyl transferase"],

  // ─── Kidney (KFT/RFT) ───────────────────────────────────────────
  creatinine: ["creatinine", "serum creatinine", "creatinine serum"],
  urea: ["urea", "blood urea", "serum urea", "bun"],
  uric_acid: ["uric acid", "serum uric acid"],
  egfr: ["egfr", "estimated gfr", "gfr"],
  sodium: ["sodium", "na", "serum sodium"],
  potassium: ["potassium", "k", "serum potassium"],
  chloride: ["chloride", "cl", "serum chloride"],
  calcium: ["calcium", "serum calcium", "calcium total"],

  // ─── Thyroid ─────────────────────────────────────────────────────
  tsh: ["tsh", "thyroid stimulating hormone", "thyroid stimulating hormone (tsh)"],
  t3: ["t3", "total t3", "triiodothyronine"],
  t4: ["t4", "total t4", "thyroxine"],
  ft3: ["ft3", "free t3", "free triiodothyronine"],
  ft4: ["ft4", "free t4", "free thyroxine"],

  // ─── Vitamins / minerals ────────────────────────────────────────
  vitamin_d: ["vitamin d", "25-oh vitamin d", "25 hydroxy vitamin d", "vitamin d3", "vitamin d total"],
  vitamin_b12: ["vitamin b12", "b12", "cyanocobalamin", "cobalamin"],
  iron: ["iron", "serum iron", "iron serum"],
  ferritin: ["ferritin", "serum ferritin"],
  tibc: ["tibc", "total iron binding capacity"],
};

// Build a reverse lookup: alias → canonical key.
// Canonicalization strips all non-alphanumeric so "HbA1c", "HBA1C",
// "hba1c - glycated hb" all match the same alias entry.
const aliasToCanonical = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(MARKER_ALIASES)) {
  for (const alias of aliases) {
    aliasToCanonical.set(canonicalize(alias), canonical);
  }
}

function canonicalize(s: string): string {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Normalize a printed marker name to a canonical key for trend matching.
 * Falls back to the canonicalized printed name if the marker isn't in the
 * known alias table — that way un-mapped markers still match across two
 * reports as long as the lab uses the same printed name on both.
 */
export function normalizeMarkerName(printed: string): string {
  const key = canonicalize(printed);
  return aliasToCanonical.get(key) || key;
}

/**
 * Parse a marker value like "14.3", "14.3 g/dL", "0", "06" to a number.
 * Returns NaN for non-numeric values (qualitative markers, "Adequate",
 * "Normocytic", etc.) — callers must handle that case.
 */
export function parseNumericValue(v: string | number | null | undefined): number {
  if (typeof v === "number") return v;
  if (!v) return NaN;
  // Strip units, whitespace, leading zeros (so "06" → 6, not invalid).
  const m = String(v).match(/-?\d+\.?\d*/);
  return m ? Number(m[0]) : NaN;
}
