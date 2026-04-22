import { NextRequest, NextResponse } from "next/server";
import { callGemini, parseJsonResponse } from "@/lib/ai/gemini";
import { sanitizePromptInput } from "@/lib/ai/sanitize";
import { getUserFromRequest } from "@/lib/supabase/auth-cache";
import { enforceQuota } from "@/lib/ai/quota";

// System instruction — cached by Gemini across calls
// STRICT extraction rules: prevent hallucination on lab reports.
const LAB_SYSTEM = `You are a professional Indian doctor reading a lab report image. Your ONLY job is to extract EXACTLY what is printed on the page. Do NOT fabricate or invent, but DO be thorough — capture every marker that is printed.

THOROUGHNESS (most important):
Indian lab reports commonly print 20-40+ markers per page (CBC alone has 18-22: Hb, RBC, PCV, MCV, MCH, MCHC, RDW, WBC, Neutrophils, Lymphocytes, Monocytes, Eosinophils, Basophils, absolute counts, Platelets, MPV, PCT, PDW). Missing any visible marker is a failure. Scan the ENTIRE page top-to-bottom, include every row of every table.

CRITICAL RULES:
1. NEVER fabricate a marker name that is not on the page (don't add "Sodium" if it's not printed).
2. NEVER invent a value. But if a value is PARTIALLY readable (blurry digit, OCR noise), extract your best-effort interpretation — do not omit just because it's not pristine. Only omit if the value is completely illegible or missing from the page.
3. Copy marker names EXACTLY as printed, including parentheses (e.g., "Haemoglobin (Hb)", "SGOT / AST (Aspartate Transaminase)"). Keep the full printed name — don't shorten.
4. Copy values EXACTLY (including decimals: "14.3" not "14", include units if printed: "14.3 g/dL").
5. Copy the reference range EXACTLY as printed (e.g., "13 - 17", "<150", "0.5-1.2").
6. Determine status by comparing the value to the reference range ON THE PAGE only.
7. Extract from ALL panels visible: CBC, LFT, KFT/RFT, Lipid, Thyroid, HbA1c, Biochemistry, Electrolytes, Urine routine, Iron studies, Vitamins, etc.
8. Include absolute counts AND percentages for differential WBCs when both are printed — these are separate markers.
9. If the page shows no lab markers at all (disclaimer page, signature page, blank page), return markers: [].

STATUS DETERMINATION:
- "normal": value is within the reference range shown on the page
- "low": value is below the reference range shown on the page
- "high": value is above the reference range shown on the page
- "critical": value is dangerously outside the reference range (more than 50% off)

OUTPUT: single raw JSON, no markdown, no prose.
{"patient_name":"exact name or null","report_date":"YYYY-MM-DD or null","lab_name":"exact lab name or null","markers":[{"name":"exact marker name as printed","value":"exact value with unit","normal_range":"exact range as printed","status":"normal|low|high|critical","explanation":"what this means in plain language","advice":"what to do if abnormal, else empty string"}],"summary":"2-3 sentences about the abnormal values and next steps. If everything is normal, say so.","urgent_attention":["only markers that are critically abnormal"]}

Max 40 markers per page. Keep each explanation to 1 short sentence to leave room for all markers. Be thorough — extracting 25-30 markers on a dense CBC+Biochem page is normal and expected.`;

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
        // 6000 tokens = room for 30+ dense markers (CBC+Biochem panels on a
        // single page commonly exceed 25 rows). 4000 was tight — on busy
        // days the model trimmed its own output to fit.
        maxOutputTokens: 6000,
        // Low temperature = deterministic, faster token generation
        temperature: 0.05,
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
