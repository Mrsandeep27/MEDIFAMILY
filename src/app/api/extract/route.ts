import { NextRequest, NextResponse } from "next/server";
import { callGemini, parseJsonResponse } from "@/lib/ai/gemini";

const EXTRACTION_PROMPT = `You are a medical prescription parser for Indian prescriptions. Extract structured data from the OCR text below.

Return JSON in this exact format (no markdown, no code blocks, just raw JSON):
{
  "doctor_name": "string or null",
  "hospital_name": "string or null",
  "visit_date": "YYYY-MM-DD or null",
  "diagnosis": "string or null",
  "medicines": [
    {
      "name": "medicine name",
      "dosage": "e.g. 500mg, 10ml",
      "frequency": "once_daily|twice_daily|thrice_daily|weekly|as_needed|custom",
      "duration": "e.g. 5 days, 2 weeks",
      "before_food": true/false
    }
  ],
  "notes": "any other important notes from the prescription"
}

Rules:
- Extract ALL medicines mentioned
- For frequency mapping: OD/QD = once_daily, BD/BID = twice_daily, TDS/TID = thrice_daily
- "before food" / "empty stomach" / "AC" = before_food: true
- "after food" / "PC" = before_food: false (default)
- Parse Hindi/Hinglish text too (common in Indian prescriptions)
- If a field is not found, use null
- Dates in DD/MM/YYYY should be converted to YYYY-MM-DD`;

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    if (text.length > 10000) {
      return NextResponse.json({ error: "Text too long (max 10,000 chars)" }, { status: 400 });
    }

    try {
      const response = await callGemini(
        [{ text: `${EXTRACTION_PROMPT}\n\nOCR Text:\n${text}` }],
        { temperature: 0.1, maxOutputTokens: 1024, feature: "extract" }
      );

      const parsed = parseJsonResponse(response);
      if (!Array.isArray(parsed.medicines)) parsed.medicines = [];

      return NextResponse.json(parsed);
    } catch (err) {
      console.error("Extract AI error:", err);
      return NextResponse.json(
        { error: `AI failed: ${err instanceof Error ? err.message : "Please try again"}` },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("Extract API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
