import { NextRequest, NextResponse } from "next/server";
import { callGemini, parseJsonResponse } from "@/lib/ai/gemini";
import { sanitizePromptInput } from "@/lib/ai/sanitize";
import { getUserFromRequest } from "@/lib/supabase/auth-cache";

// System instruction — cached by Gemini across calls
// STRICT extraction rules: prevent hallucination on lab reports.
const LAB_SYSTEM = `You are a professional Indian doctor reading a lab report image. Your ONLY job is to extract EXACTLY what is printed on the page. Do NOT fabricate, guess, or fill in missing values.

CRITICAL RULES (violation = failure):
1. NEVER invent marker values that are not visible on the page.
2. NEVER add markers that are not printed on the page (no Sodium, Potassium, Glucose unless they appear in the image).
3. If a value is unreadable or partially obscured, OMIT that marker entirely.
4. Copy marker names EXACTLY as printed (e.g., "Haemoglobin (Hb)" not "Hemoglobin").
5. Copy values EXACTLY (including decimals: "14.3" not "14").
6. Copy the reference range EXACTLY as printed (e.g., "13 - 17").
7. Determine status by comparing the value to the reference range ON THE PAGE only.
8. If the report has MULTIPLE test panels (CBC, LFT, Lipid, Thyroid, HbA1c, KFT, Biochemistry, etc.), extract ALL markers from ALL panels visible.
9. If the page shows no lab markers (disclaimer page, signature page, blank page), return markers: [].

STATUS DETERMINATION:
- "normal": value is within the reference range shown on the page
- "low": value is below the reference range shown on the page
- "high": value is above the reference range shown on the page
- "critical": value is dangerously outside the reference range (more than 50% off)

OUTPUT: single raw JSON, no markdown, no prose.
{"patient_name":"exact name or null","report_date":"YYYY-MM-DD or null","lab_name":"exact lab name or null","markers":[{"name":"exact marker name as printed","value":"exact value with unit","normal_range":"exact range as printed","status":"normal|low|high|critical","explanation":"what this means in plain language","advice":"what to do if abnormal, else empty string"}],"summary":"2-3 sentences about the abnormal values and next steps. If everything is normal, say so.","urgent_attention":["only markers that are critically abnormal"]}

Max 30 markers per page. Each explanation max 1 sentence. If unsure about ANY field, omit that marker rather than guess.`;

export async function POST(request: NextRequest) {
  try {
    const authUser = await getUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
        maxOutputTokens: 1000,
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
