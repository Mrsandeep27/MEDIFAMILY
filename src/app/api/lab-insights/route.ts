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
A warm, plain-language paragraph (4-6 sentences) explaining what the report says overall, like you're talking to a patient sitting across from you. Cover:
  - The headline ("Most things look fine, but two values caught my eye" OR "Your diabetes control looks excellent this time")
  - Group abnormal findings into themes (heart/cholesterol, sugar, liver, kidney, blood, thyroid) — don't list every marker
  - What's likely going on in human terms ("Your bad cholesterol is creeping up — common with age and oily food")
  - What to do next, in priority order ("First, recheck thyroid in 6 weeks. Diet matters more than you think for the cholesterol number.")
  - End with a calm reassurance OR a clear "please see a doctor about X" if anything is genuinely urgent
Use Hinglish naturally if locale is Hindi. NEVER write "the patient should..." — speak directly to them: "you should...".

OUTPUT: single raw JSON, no markdown, no prose.
{"patient_name":"exact name or null","report_date":"YYYY-MM-DD or null","lab_name":"exact lab name or null","markers":[{"name":"exact marker name as printed","value":"exact value with unit","normal_range":"exact range as printed","status":"normal|low|high|critical","explanation":"what this measures + why it might be off + how serious (for abnormal); short for normal","advice":"specific actionable next step for abnormal, empty string for normal"}],"summary":"2-3 sentence headline of what's important","patient_summary":"4-6 sentence warm doctor-explaining-to-patient paragraph (THIS is the main field a patient reads)","urgent_attention":["only markers that are critically abnormal — empty array if none"]}

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
    const { text, image, locale } = body;

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
