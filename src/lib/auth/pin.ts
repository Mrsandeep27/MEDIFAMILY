/**
 * PIN authentication using Web Crypto API (SHA-256)
 * Falls back to simple hash in insecure contexts (HTTP dev)
 */

export async function hashPin(pin: string): Promise<string> {
  // crypto.subtle requires secure context (HTTPS or localhost)
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Fallback for insecure contexts (dev over HTTP)
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return "fallback_" + Math.abs(hash).toString(16);
}

export async function verifyPin(
  pin: string,
  storedHash: string
): Promise<boolean> {
  const hash = await hashPin(pin);
  return hash === storedHash;
}
