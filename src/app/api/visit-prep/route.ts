import { NextRequest, NextResponse } from "next/server";
import { callGemini } from "@/lib/ai/gemini";

const SYSTEM_PROMPT = `You are a smart medical assistant helping patients prepare for doctor visits.

Given a patient brief with their conditions, medicines, vitals trends, and recent records, generate:
1. Three specific questions the patient should ask their doctor (based on actual data trends, not generic)
2. A one-line visit summary (what has changed since last visit)

OUTPUT: single raw JSON, no markdown.
{
  "questions": ["Specific question based on patient data"],
  "visit_summary": "One line: what changed and what needs attention"
}

Rules:
- Questions must reference ACTUAL data from the brief (e.g. "Your BP has been trending up from 130 to 148 — ask about adjusting Amlodipine dose")
- Never generic questions like "ask about side effects"
- If vitals are worsening, flag it in questions
- If medicines have been active for a long time without change, suggest a review
- Max 3 questions. Each under 2 sentences.
- visit_summary: max 1 sentence, factual, no fluff`;

export async function POST(req: NextRequest) {
  try {
    const { brief } = await req.json();

    if (!brief || typeof brief !== "string") {
      return NextResponse.json({ error: "Missing brief" }, { status: 400 });
    }

    const result = await callGemini(
      [{ text: brief }],
      {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.3,
        maxOutputTokens: 500,
        feature: "visit-prep",
        jsonMode: true,
      }
    );

    let parsed;
    try {
      parsed = JSON.parse(result);
    } catch {
      // Try to extract JSON from markdown code blocks
      const match = result.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        parsed = JSON.parse(match[1]);
      } else {
        parsed = { questions: [], visit_summary: "" };
      }
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[visit-prep]", err);
    return NextResponse.json(
      { questions: [], visit_summary: "" },
      { status: 200 }
    );
  }
}
