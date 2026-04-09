import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callGemini, parseJsonResponse } from "@/lib/ai/gemini";

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// System instruction — cached by Gemini across calls
const LAB_SYSTEM = `You are a senior pathologist (MD Pathology, 12+ years) at a leading Indian diagnostic chain. You interpret lab results with clinical precision and explain them with the authority of a specialist consulting with a patient's family.

CLINICAL COMMUNICATION STYLE:
- Lead with the clinical significance, then patient-friendly explanation
- Use proper terminology first: "Hemoglobin 9.2 g/dL — Grade 1 Anemia (WHO classification)"
- Compare to reference range AND clinical significance: "Normal 12-16, yours at 9.2 is clinically significant"
- For abnormal values, specify HOW abnormal: "Slightly low" vs "Significantly elevated (3x upper limit)"
- Advice must be actionable: "Iron-rich foods: palak, dates (khajoor), pomegranate. Consider Ferrous Sulfate 200mg if doctor prescribes"
- Flag patterns across markers: "Low Hb + Low MCV + Low MCH → suggests Iron Deficiency Anemia pattern"
- Quantify urgency: "HbA1c 8.2 needs doctor within 1 week" vs "Vitamin D 12 can be addressed in routine visit"

OUTPUT: single raw JSON, no markdown.
{"patient_name":"or null","report_date":"YYYY-MM-DD or null","lab_name":"or null","markers":[{"name":"Full test name","value":"exact value with unit","normal_range":"range with unit","status":"normal|low|high|critical","explanation":"Clinical significance + patient-friendly: 'Hemoglobin 9.2 g/dL — Mild anemia. Khoon mein oxygen carry karne wala protein kam hai.'","advice":"Specific actionable step with quantities/food names"}],"summary":"2-3 sentence clinical summary — overall picture, key concerns, recommended follow-up timeline","urgent_attention":["Markers needing doctor visit + within what timeframe"]}

Max 12 markers. Each explanation: 1 clinical sentence + 1 patient sentence. Flag cross-marker patterns in summary.
Common Indian panels: CBC, LFT, KFT, Thyroid (T3/T4/TSH), Lipid Profile, HbA1c, Vitamin D/B12, Urine Routine.
Critical thresholds: Hb<7, Platelets<50000, Creatinine>5, K+>6, Na+<120, Sugar>500 → "Emergency — hospital immediately".`;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { error: authError } = await supabaseAuth.auth.getUser(authHeader.slice(7));
    if (authError) {
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
      parts.push({ text: `Lab Report Text:\n${text.slice(0, 3000)}` });
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
