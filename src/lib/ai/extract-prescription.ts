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
  patient_name?: string;
  doctor_name?: string;
  hospital_name?: string;
  visit_date?: string;
  diagnosis?: string;
  vitals?: string;
  medicines: ExtractedMedicine[];
  instructions?: string[];
  raw_text: string;
  notes?: string;
  error?: string;
}

/**
 * Preprocess image for better AI reading:
 * - Resize to max 1500px (enough detail without being too large)
 * - Enhance contrast (makes faded handwriting more readable)
 * - Convert to JPEG at 0.9 quality
 */
async function preprocessImage(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        // Fallback to raw base64 if canvas not available
        blobToRawBase64(blob).then(resolve).catch(reject);
        return;
      }

      // Resize to max 1500px on longest side
      const MAX = 1500;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const scale = MAX / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      canvas.width = width;
      canvas.height = height;

      // Draw original
      ctx.drawImage(img, 0, 0, width, height);

      // Enhance contrast — read pixels, apply contrast stretch
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // Find min/max brightness for auto-contrast
      let minBright = 255, maxBright = 0;
      for (let i = 0; i < data.length; i += 4) {
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        if (brightness < minBright) minBright = brightness;
        if (brightness > maxBright) maxBright = brightness;
      }

      // Apply contrast stretch (only if image isn't already high-contrast)
      const range = maxBright - minBright;
      if (range > 20 && range < 230) {
        const factor = 255 / range;
        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.min(255, Math.max(0, (data[i] - minBright) * factor));       // R
          data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - minBright) * factor)); // G
          data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - minBright) * factor)); // B
        }
        ctx.putImageData(imageData, 0, 0);

        // Slight sharpening: increase contrast of text vs background
        ctx.globalCompositeOperation = "multiply";
        ctx.drawImage(canvas, 0, 0);
        ctx.globalCompositeOperation = "source-over";
      }

      // Export as JPEG data URL
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = () => {
      // Fallback to raw base64
      blobToRawBase64(blob).then(resolve).catch(reject);
    };
    img.src = URL.createObjectURL(blob);
  });
}

/**
 * Simple fallback: convert blob to base64 without preprocessing.
 */
async function blobToRawBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Extract prescription data using Gemini Vision (primary) + OCR text (supplementary).
 *
 * @param ocrText  - OCR text (can be empty if OCR failed)
 * @param imageBlob - Original image blob to send to Gemini Vision (optional but recommended)
 * @param apiEndpoint - API endpoint (defaults to /api/extract)
 */
export async function extractPrescription(
  ocrText: string,
  imageBlob?: Blob | null,
  apiEndpoint?: string
): Promise<ExtractionResult> {
  const endpoint = apiEndpoint || "/api/extract";

  try {
    const { createClient } = await import("@/lib/supabase/client");
    const { data: { session } } = await createClient().auth.getSession();

    // Build request body
    const body: { text?: string; image?: string } = {};

    // Preprocess and convert image if available
    if (imageBlob) {
      try {
        body.image = await preprocessImage(imageBlob);
      } catch {
        // If preprocessing fails, try raw base64
        try {
          body.image = await blobToRawBase64(imageBlob);
        } catch {
          // Fall back to text-only
        }
      }
    }

    // Always include OCR text as supplementary context
    if (ocrText) {
      body.text = ocrText;
    }

    // Need at least one of image or text
    if (!body.image && !body.text) {
      return {
        medicines: [],
        raw_text: "",
        error: "No image or text to process",
      };
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return {
        medicines: [],
        raw_text: ocrText,
        error: errData.error || `API error: ${response.status}`,
      };
    }

    const data = await response.json();

    // Merge instructions into notes for display
    const instructions: string[] = Array.isArray(data.instructions) ? data.instructions : [];
    const notesParts = [data.notes, ...instructions].filter(Boolean);

    return {
      patient_name: data.patient_name || undefined,
      doctor_name: data.doctor_name || undefined,
      hospital_name: data.hospital_name || undefined,
      visit_date: data.visit_date || undefined,
      diagnosis: data.diagnosis || undefined,
      vitals: data.vitals || undefined,
      instructions,
      notes: notesParts.length > 0 ? notesParts.join("\n• ") : undefined,
      raw_text: ocrText,
      medicines: (data.medicines || []).map((m: ExtractedMedicine) => ({
        name: m.name || "",
        dosage: m.dosage || undefined,
        frequency: m.frequency || undefined,
        duration: m.duration || undefined,
        before_food: m.before_food ?? false,
      })),
    };
  } catch (err) {
    console.error("AI extraction failed:", err);
    return {
      medicines: [],
      raw_text: ocrText,
      error: "Failed to connect to AI service",
    };
  }
}
