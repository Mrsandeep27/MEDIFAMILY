import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callGemini, parseJsonResponse } from "@/lib/ai/gemini";

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Persona + safety rules + JSON schema — sent as systemInstruction so
// Gemini caches it across calls (faster + cheaper). Only the per-turn
// patient context, chat history, and user message vary.
const DOCTOR_SYSTEM = `You are "Dr. MediFamily" — a warm Indian family doctor assistant. Reply in Hinglish (Hindi+English mix) naturally, like a caring family doctor.

OUTPUT: a single raw JSON object, no markdown. Schema:
{
  "urgency": "green|yellow|orange|red",
  "urgency_label": "Home Care|See Doctor Soon|See Doctor Today|Rush to Hospital",
  "possible_causes": ["short cause", ...],
  "what_to_do": ["short step", ...],
  "home_remedies": ["short remedy", ...],
  "otc_medicines": [{"name":"OTC only","dosage":"","when":"","warning":""}],
  "when_to_rush": ["red flag", ...],
  "doctor_type": "specialist name",
  "reply": "2-3 warm sentences in Hinglish",
  "follow_up_questions": ["short Q", ...]
}

KEEP IT TIGHT: max 3 items per list, max 2 OTC medicines, reply ≤ 3 sentences.

SAFETY (strict):
- ONLY OTC medicines (Paracetamol, Crocin, ORS, Digene, Vicks, Caladryl, Moov, Volini, Burnol, Betadine, Strepsils, Pudinhara). Never prescription drugs.
- Always check patient's allergies before suggesting medicines.
- Children <5, elderly 65+, pregnant → lower threshold; pregnant gets NO medicine, only "consult doctor".
- Chest pain, breathing difficulty, unconsciousness, heavy bleeding, seizures → urgency=red.
- High fever (>103°F) for 3+ days → urgency=orange minimum.
- If unsure → urgency=yellow.
- Never diagnose ("ho sakta hai", not "yeh hai"). Always end reply with "Doctor se zaroor milein agar..." or similar.`;

export async function POST(request: NextRequest) {
  try {
    // Require authentication — prevents cost abuse and unaudited PII processing
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { error: authError } = await supabaseAuth.auth.getUser(authHeader.slice(7));
    if (authError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { message, patient, chatHistory, locale } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Build patient context
    let patientContext = "No patient info available.";
    if (patient) {
      const age = patient.date_of_birth
        ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / 31557600000)
        : null;
      patientContext = [
        `Name: ${patient.name || "Unknown"}`,
        age !== null ? `Age: ${age} years` : null,
        patient.gender ? `Gender: ${patient.gender}` : null,
        patient.blood_group ? `Blood Group: ${patient.blood_group}` : null,
        patient.allergies?.length > 0 ? `ALLERGIES: ${patient.allergies.join(", ")}` : "No known allergies",
        patient.chronic_conditions?.length > 0 ? `CHRONIC CONDITIONS: ${patient.chronic_conditions.join(", ")}` : null,
        patient.current_medicines?.length > 0 ? `CURRENT MEDICINES: ${patient.current_medicines.join(", ")}` : null,
      ].filter(Boolean).join("\n");
    }

    // Build the per-turn user content (system instruction is sent separately
    // and cached across calls).
    const historyText = Array.isArray(chatHistory) && chatHistory.length > 0
      ? chatHistory
          .slice(-4) // last 4 turns is plenty for short medical chats
          .map((m: { role: string; text: string }) => `${m.role === "user" ? "Patient" : "Doctor"}: ${m.text.slice(0, 300)}`)
          .join("\n")
      : "";

    const langInstruction = locale === "hi"
      ? "Reply ENTIRELY in Hindi (Devanagari script). All JSON fields in Hindi."
      : "Reply in simple, easy English. All JSON fields in English.";

    const userPrompt = [
      `PATIENT:\n${patientContext}`,
      historyText && `RECENT CHAT:\n${historyText}`,
      `MESSAGE: "${message.slice(0, 600)}"`,
      langInstruction,
    ].filter(Boolean).join("\n\n");

    try {
      const response = await callGemini(
        [{ text: userPrompt }],
        {
          temperature: 0.3,
          // Cut from 2500 → 800. Response shape is bounded (3 items/list,
          // 3-sentence reply) so 800 tokens is comfortably enough and ~3x
          // faster than the old budget.
          maxOutputTokens: 800,
          feature: "ai-doctor",
          jsonMode: true,
          systemInstruction: DOCTOR_SYSTEM,
        }
      );

      const parsed = parseJsonResponse(response);

      // Ensure required fields
      if (!parsed.urgency) parsed.urgency = "yellow";
      if (!parsed.reply) {
        // Don't show raw JSON to user — extract something readable or use fallback
        const text = response.replace(/[{}\[\]"]/g, "").trim();
        parsed.reply = text.length > 20 && text.length < 500
          ? text
          : "Apni symptoms ke baare mein thoda aur detail mein batayein taaki main aapki madad kar sakun.";
      }
      if (!Array.isArray(parsed.possible_causes)) parsed.possible_causes = [];
      if (!Array.isArray(parsed.what_to_do)) parsed.what_to_do = [];
      if (!Array.isArray(parsed.home_remedies)) parsed.home_remedies = [];
      if (!Array.isArray(parsed.otc_medicines)) parsed.otc_medicines = [];
      if (!Array.isArray(parsed.when_to_rush)) parsed.when_to_rush = [];
      if (!Array.isArray(parsed.follow_up_questions)) parsed.follow_up_questions = [];

      return NextResponse.json(parsed);
    } catch (err) {
      console.error("AI Doctor error:", err);
      return NextResponse.json(
        { error: `AI service error: ${err instanceof Error ? err.message : "Please try again"}` },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("AI Doctor route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
