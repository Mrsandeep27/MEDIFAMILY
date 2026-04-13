/**
 * Shared prompt injection sanitizer for all AI endpoints.
 * Redacts common injection patterns from user-controlled text
 * before it reaches the LLM.
 */
export function sanitizePromptInput(text: string, maxLength: number = 4000): string {
  return text
    .replace(/ignore\s+(all|previous|above|every|your|the)/gi, "[REDACTED]")
    .replace(/you\s+are\s+(now|no\s+longer|not|a)/gi, "[REDACTED]")
    .replace(/forget\s+(all|everything|your|previous|the)/gi, "[REDACTED]")
    .replace(/override|disregard|bypass|jailbreak|pretend|roleplay/gi, "[REDACTED]")
    .replace(/system\s*(prompt|instruction|message)/gi, "[REDACTED]")
    .replace(/act\s+as\s+(a|an|if|though)/gi, "[REDACTED]")
    .replace(/new\s+instructions?:?/gi, "[REDACTED]")
    .replace(/do\s+not\s+follow/gi, "[REDACTED]")
    .slice(0, maxLength);
}
