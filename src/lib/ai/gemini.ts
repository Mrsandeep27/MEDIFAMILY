/**
 * Gemini API helper with automatic model fallback.
 * Tries multiple models if one fails (429 rate limit, 404 not found, etc.)
 */

// Models to try in order — first working one wins
const VISION_MODELS = [
  "gemini-1.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-pro",
];

const TEXT_MODELS = [
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-2.0-flash",
];

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiOptions {
  temperature?: number;
  maxOutputTokens?: number;
}

export async function callGemini(
  parts: GeminiPart[],
  options: GeminiOptions = {}
): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not set");

  const hasImage = parts.some((p) => p.inlineData);
  const models = hasImage ? VISION_MODELS : TEXT_MODELS;

  const { temperature = 0.1, maxOutputTokens = 2048 } = options;

  let lastError = "";

  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { temperature, maxOutputTokens },
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
        lastError = "Empty response from AI";
        continue;
      }

      const status = response.status;
      const errBody = await response.text().catch(() => "");

      // 429 = rate limited, try next model
      // 404 = model not found, try next model
      // 400 = bad request (model doesn't support this input), try next
      if (status === 429 || status === 404 || status === 400) {
        lastError = `${model}: ${status} ${errBody.slice(0, 100)}`;
        console.warn(`Gemini ${model} failed (${status}), trying next model...`);
        continue;
      }

      // Other errors — don't retry
      lastError = `${model}: ${status}`;
      break;
    } catch (err) {
      lastError = `${model}: ${err instanceof Error ? err.message : String(err)}`;
      continue;
    }
  }

  throw new Error(`All Gemini models failed. Last error: ${lastError}`);
}

/**
 * Parse JSON from AI response text (handles markdown code blocks, extra text, etc.)
 */
export function parseJsonResponse(text: string): Record<string, unknown> {
  // Try to find JSON in the response
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.substring(firstBrace, lastBrace + 1));
    } catch {}
  }
  return {};
}
