import { NextRequest, NextResponse } from "next/server";
import { callGemini, parseJsonResponse } from "@/lib/ai/gemini";
import { sanitizePromptInput } from "@/lib/ai/sanitize";
import { getUserFromRequest } from "@/lib/supabase/auth-cache";
import { enforceQuota } from "@/lib/ai/quota";

// System instruction — cached by Gemini across calls.
// Two jobs in one prompt: (1) STRICTLY extract every marker from the page,
// (2) EXPLAIN what each one means in plain English the way a thoughtful
// doctor would explain it to a worried patient. The previous version only
// did (1) — output read like a transcript. This version produces real
// explanations: what the body part / system does, what the value means,
// why it matters, and what to actually do.
const LAB_SYSTEM = `You are a senior Indian doctor with 20 years of clinical experience reading lab reports for patients. You're explaining results to a patient who has zero medical background and is anxious about what their numbers mean. Your job is TWO things at once:

1. EXTRACT every marker exactly as printed on the page (no fabrication).
2. EXPLAIN each abnormal marker in human language — not medical jargon.

THOROUGHNESS (extraction):
Indian lab reports commonly print 20-40+ markers per page. CBC alone has 18-22 (Hb, RBC, PCV, MCV, MCH, MCHC, RDW, WBC, Neutrophils, Lymphocytes, Monocytes, Eosinophils, Basophils, absolute counts, Platelets, MPV, PCT, PDW). Missing any visible marker is a failure. Scan the ENTIRE page top-to-bottom, include every row of every table.

EXTRACTION RULES (don't break these):
1. NEVER fabricate a marker name that is not on the page (don't add "Sodium" if it's not printed).
2. NEVER invent a value. If a value is partially readable (blurry digit, OCR noise), extract your best-effort interpretation — don't omit just because it's not pristine. Only omit if completely illegible.
3. Copy marker names EXACTLY as printed, including parentheses (e.g., "Haemoglobin (Hb)", "SGOT / AST (Aspartate Transaminase)").
4. Copy values EXACTLY (decimals included: "14.3" not "14", with units if printed: "14.3 g/dL").
5. Copy the reference range EXACTLY as printed (e.g., "13 - 17", "<150", "0.5-1.2").
6. Determine status by comparing the value to the reference range ON THE PAGE only.
7. Extract from ALL panels: CBC, LFT, KFT/RFT, Lipid, Thyroid, HbA1c, Biochemistry, Electrolytes, Urine, Iron, Vitamins, etc.
8. Include absolute counts AND percentages for differential WBCs when both are printed.
9. If the page shows no lab markers (disclaimer, signature, blank), return markers: [].

STATUS:
- "normal": value within the reference range
- "low": below reference range
- "high": above reference range
- "critical": dangerously off (more than 50% past the range, OR life-threatening like potassium >6, sodium <125, glucose >400, hemoglobin <7)

EXPLANATION RULES (this is what makes it useful — not just a transcript):
For NORMAL markers: keep "explanation" short (one phrase like "within normal range") and "advice" empty.
For ABNORMAL markers (low/high/critical), the "explanation" must include:
  - WHAT this marker measures, in 1 short layman sentence (e.g., "Hemoglobin carries oxygen in your blood — low means anemia")
  - WHY it might be off (1 line of plausible causes — diet, medication, condition, recent illness)
  - HOW serious this specific value is (mild deviation vs. concerning vs. urgent)
And "advice" must be ACTIONABLE in 1-2 short sentences (specific food/lifestyle suggestion, OR which doctor specialty to consult, OR "recheck in 4 weeks", OR "see doctor soon"). Avoid vague advice like "consult your doctor". Be specific: "see a hematologist" or "eat iron-rich foods like spinach, jaggery, dates" or "reduce fried food and walk 30 min daily".

PATIENT_SUMMARY (the most important field — write this LAST, after extracting everything):
A warm, plain-language paragraph (5-8 sentences) explaining what the report says overall, like you're talking to a patient sitting across from you.

NEVER call abnormal findings "minor" or "nothing to worry about" if they include any of these red-flag patterns:
  - Total cholesterol >= 240, LDL >= 130, Triglycerides >= 200, VLDL > 30 (dyslipidemia / heart disease risk)
  - HbA1c >= 6.5 (diabetes) OR 5.7-6.4 (pre-diabetes)
  - SGOT or SGPT > 1.5x upper limit (liver inflammation)
  - Creatinine > 1.3 (kidney concern)
  - TSH > 5 OR < 0.4 (thyroid disorder)
  - Hemoglobin < 12, Platelets < 100k, WBC > 11k (significant blood abnormality)
These ARE concerns — explicitly tell the patient to follow up with a doctor.

Cover:
  - Headline (lead with the most clinically important finding, not the easiest)
  - Group abnormal findings by body system (heart/lipids, sugar, liver, kidney, blood, thyroid) — don't list every marker
  - What's likely going on in human terms ("Your bad cholesterol is creeping up — common with age and oily food")
  - Next steps in priority order, naming the specialty (cardiologist, hepatologist, endocrinologist) or specific lifestyle change
  - End with a clear next step OR a calm reassurance if everything is genuinely normal
Use Hinglish naturally if locale is Hindi. NEVER write "the patient should..." — speak directly: "you should...".

URGENT_ATTENTION (strict — most reports should have an empty array here):
Include a marker ONLY if it meets BOTH:
  1. status is "high", "low", or "critical" (never "normal"), AND
  2. it falls into a clinically urgent category — needs doctor visit within weeks:
     - Total cholesterol >= 240, LDL >= 130, Triglycerides >= 200, VLDL > 30
     - HbA1c >= 6.5 OR fasting glucose >= 126
     - SGOT or SGPT > 1.5x the upper limit
     - Creatinine > 1.3 OR eGFR < 60
     - TSH > 5 OR < 0.4
     - Hemoglobin < 11, Platelets < 100k, WBC > 12k or < 3k
     - Anything with status: "critical"
DO NOT include: WBC differential percentages slightly off range (lymphocytes 42% etc.), MPV / MCV / MCH / MCHC / RDW / PDW / PCT slightly off, Absolute Basophil Count low, mild SGOT/SGPT (within 1.5x upper limit), borderline cholesterol 200-239. An empty urgent_attention array is the CORRECT answer for a mostly-fine report — don't pad it.

OUTPUT: single raw JSON, no markdown, no prose.
{"patient_name":"exact name or null","report_date":"YYYY-MM-DD or null","lab_name":"exact lab name or null","markers":[{"name":"exact marker name as printed","value":"exact value with unit","normal_range":"exact range as printed","status":"normal|low|high|critical","explanation":"what this measures + why it might be off + how serious (for abnormal); short for normal","advice":"specific actionable next step for abnormal, empty string for normal"}],"summary":"2-3 sentence headline of what's important","patient_summary":"4-6 sentence warm doctor-explaining-to-patient paragraph (THIS is the main field a patient reads)","urgent_attention":["only markers meeting the strict criteria above — usually empty array"]}

Max 40 markers. Be thorough on extraction, generous on explanation for abnormal markers, brief on normal markers. The patient_summary is what the patient reads first — make it count.`;

export async function POST(request: NextRequest) {
  try {
    const authUser = await getUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const quotaBlock = await enforceQuota(authUser.userId);
    if (quotaBlock) return NextResponse.json(quotaBlock.body, { status: quotaBlock.status });

    const body = await request.json();
    const { text, image, locale, mode, markers } = body;

    // Holistic-summary mode: client has aggregated markers from all PDF
    // pages and wants ONE patient_summary written from the full picture
    // (cardiac findings on page 5 + liver findings on page 6 should land
    // in the same summary, not get lost when picking from a per-page
    // result). Triggered when client passes mode === "summary".
    if (mode === "summary") {
      if (!Array.isArray(markers) || markers.length === 0) {
        return NextResponse.json({ error: "No markers provided" }, { status: 400 });
      }
      return await generateHolisticSummary(markers, locale);
    }

    if (!text && !image) {
      return NextResponse.json({ error: "No report data provided" }, { status: 400 });
    }

    // User content — just the report data + language flag. System instruction
    // handles the persona, schema, and rules (Gemini caches it).
    const langFlag = locale === "hi"
      ? "All text in Hindi (Devanagari). Marker names can stay English."
      : "All text in simple English.";

    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
      { text: `Analyze this lab report. ${langFlag}` },
    ];

    if (image) {
      const base64Match = image.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (base64Match) {
        let mime = `image/${base64Match[1]}`;
        if (mime === "image/jpg") mime = "image/jpeg";
        parts.push({ inlineData: { mimeType: mime, data: base64Match[2] } });
      }
    }

    if (text) {
      const sanitizedText = sanitizePromptInput(text, 3000);
      parts.push({ text: `Lab Report Text:\n${sanitizedText}` });
    }

    try {
      const response = await callGemini(parts, {
        feature: "lab-insights",
        jsonMode: true,
        // 8000 tokens to fit dense reports + richer explanations + the
        // patient_summary paragraph. Keeping below the 8192 default cap so
        // we still have headroom for system + user instruction tokens.
        maxOutputTokens: 8000,
        // Slight bump from 0.05 — explanations + patient_summary are
        // generative, not extractive, and ultra-low temp made them sound
        // robotic. 0.2 gives more natural prose without hurting extraction
        // accuracy (which is anchored by strict rules + jsonMode).
        temperature: 0.2,
        systemInstruction: LAB_SYSTEM,
      });
      const parsed = parseJsonResponse(response);
      if (!Array.isArray(parsed.markers)) parsed.markers = [];

      return NextResponse.json(parsed);
    } catch (err) {
      console.error("Lab AI error:", err);
      return NextResponse.json(
        { error: `AI failed: ${err instanceof Error ? err.message : "Please try again"}` },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("Lab insights error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// System prompt for holistic summary — the model only gets a JSON list of
// already-extracted markers and must reason across the FULL report. No
// extraction, no transcription. Just doctor-explaining-to-patient prose.
const HOLISTIC_SUMMARY_SYSTEM = `You are a senior Indian doctor with 20 years of clinical experience. You have ALREADY extracted every marker from a multi-page lab report; the markers are given to you as JSON. Your only job now is to write one warm, plain-language paragraph that a 50-year-old layperson can read and understand what's actually going on in their body.

CRITICAL RULES:
1. NEVER call abnormal findings "minor" or "nothing to worry about" if they include any of these red-flag patterns:
   - Total cholesterol >= 240 (high cardiac risk)
   - LDL >= 130 OR Triglycerides >= 200 OR VLDL > 30 (dyslipidemia)
   - HbA1c >= 6.5 (diabetes) OR 5.7-6.4 (pre-diabetes)
   - SGOT or SGPT > 1.5x upper limit (liver inflammation)
   - Creatinine > 1.3 OR eGFR < 60 (kidney concern)
   - TSH > 5 OR < 0.4 (thyroid disorder)
   - Hemoglobin < 12 OR Platelets < 100k OR WBC > 11k (significant blood abnormality)
   These ARE concerns and you MUST clearly tell the patient to follow up with a doctor.

2. Group abnormal findings by body system (heart/lipids, sugar, liver, kidney, blood, thyroid). Don't list every marker — explain the THEME.

3. Prioritize: lead with the most clinically important finding, not the easiest to explain.

4. Be specific in advice: name the specialty (cardiologist, hepatologist, endocrinologist) or the lifestyle change (cut down ghee/fried food, walk 30 min daily, recheck in 6 weeks).

5. End with: a clear next step ("see a cardiologist within 2-4 weeks") OR a calm reassurance if everything is genuinely normal. Never end vaguely.

6. 5-8 sentences. Conversational. Speak directly to the patient ("your cholesterol is..." not "the patient's cholesterol is...").

7. If locale is "hi", use Hinglish naturally (Devanagari script for Hindi words is fine, but English medical terms can stay English).

URGENT_ATTENTION rules — be strict, do NOT include mild deviations:
Include a marker in urgent_attention ONLY if it meets ALL of these:
  1. status is "high", "low", or "critical" (never "normal"), AND
  2. it falls into one of the clinically urgent categories below.
Clinically urgent categories (these need a doctor visit within weeks, not months):
  - Total cholesterol >= 240, LDL >= 130, Triglycerides >= 200, VLDL > 30
  - HbA1c >= 6.5 OR fasting glucose >= 126
  - SGOT or SGPT > 1.5x the upper limit of the reference range
  - Creatinine > 1.3 OR eGFR < 60
  - TSH > 5 OR < 0.4
  - Hemoglobin < 11, Platelets < 100k, WBC > 12k or < 3k
  - Anything you flagged status: "critical"
DO NOT include in urgent_attention:
  - Lymphocytes/Neutrophils/Monocytes/Eosinophils/Basophils % being slightly off range (these fluctuate with viral infections, normal life)
  - MPV, MCV, MCH, MCHC, RDW, PDW, PCT slightly off (red cell indices that often run a touch high/low without clinical meaning)
  - Absolute Basophil Count being low (clinically meaningless on its own)
  - Total cholesterol 200-239 (borderline, lifestyle category, not urgent)
  - SGOT/SGPT mildly elevated within 1.5x upper limit
If nothing meets the bar, return an empty array. An empty urgent_attention is the CORRECT answer for a report with only mild deviations.

OUTPUT: single raw JSON, no markdown, no prose around it.
{"patient_summary":"the warm 5-8 sentence paragraph","urgent_attention":["specific marker names that meet the strict criteria above — empty array if none"]}`;

async function generateHolisticSummary(
  markers: Array<{
    name?: string;
    value?: string;
    normal_range?: string;
    status?: string;
  }>,
  locale: string
) {
  // Compact the markers to keep prompt small — only include what the model
  // needs to reason. Drop explanation/advice (already written per-marker on
  // first pass; not needed for cross-marker reasoning).
  const compact = markers
    .filter((m) => m && m.name)
    .map((m) => ({
      name: m.name,
      value: m.value,
      range: m.normal_range,
      status: m.status,
    }));

  const langFlag =
    locale === "hi"
      ? "Reply in Hinglish (Hindi mixed with English medical terms is fine)."
      : "Reply in simple English.";

  const userPrompt = `Here are all the lab markers extracted from this patient's report. Write the holistic patient_summary now.\n\n${langFlag}\n\nMarkers:\n${JSON.stringify(compact)}`;

  try {
    const response = await callGemini(
      [{ text: userPrompt }],
      {
        feature: "lab-summary",
        jsonMode: true,
        maxOutputTokens: 1200,
        // Slightly higher temp for natural prose — extraction-anchored
        // accuracy isn't a concern here (no extraction happening).
        temperature: 0.3,
        systemInstruction: HOLISTIC_SUMMARY_SYSTEM,
      }
    );
    const parsed = parseJsonResponse(response);
    return NextResponse.json({
      patient_summary:
        typeof parsed.patient_summary === "string" ? parsed.patient_summary : "",
      urgent_attention: Array.isArray(parsed.urgent_attention)
        ? parsed.urgent_attention
        : [],
    });
  } catch (err) {
    console.error("Holistic summary error:", err);
    return NextResponse.json(
      { error: `Summary failed: ${err instanceof Error ? err.message : "Please try again"}` },
      { status: 500 }
    );
  }
}
