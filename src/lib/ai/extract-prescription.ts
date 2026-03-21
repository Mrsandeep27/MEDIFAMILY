"use client";

import type { Frequency } from "@/lib/db/schema";

export interface ExtractedMedicine {
  name: string;
  dosage?: string;
  frequency?: Frequency;
  duration?: string;
  before_food: boolean;
}

export interface ExtractionResult {
  doctor_name?: string;
  hospital_name?: string;
  visit_date?: string;
  diagnosis?: string;
  medicines: ExtractedMedicine[];
  raw_text: string;
  notes?: string;
}

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

export async function extractPrescription(
  ocrText: string,
  apiEndpoint?: string
): Promise<ExtractionResult> {
  const endpoint = apiEndpoint || "/api/extract";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: ocrText,
        prompt: EXTRACTION_PROMPT,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      ...data,
      raw_text: ocrText,
      medicines: (data.medicines || []).map((m: ExtractedMedicine) => ({
        ...m,
        before_food: m.before_food ?? false,
      })),
    };
  } catch (err) {
    console.error("AI extraction failed:", err);
    // Return basic result with just OCR text
    return {
      medicines: [],
      raw_text: ocrText,
    };
  }
}
