/**
 * Care-home share OTP store. In-memory only — sufficient for pilot
 * deployments where a single server process handles the family-side
 * traffic (low volume; one care home = a handful of family-mates per
 * resident, opening the link maybe once a week).
 *
 * Production path: swap the Map for Redis or a small Postgres table.
 * The two functions below are the ONLY contract that callers depend on.
 */

const otpStore = new Map<
  string,
  { hash: string; expiresAt: number; attempts: number }
>();
const lastSentAt = new Map<string, number>();

export async function hashOtp(otp: string, salt: string): Promise<string> {
  const enc = new TextEncoder().encode(`${salt}:${otp}`);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Returns true if OTP can be sent (not rate-limited), false otherwise. */
export function canSend(token: string): boolean {
  const prev = lastSentAt.get(token);
  return !prev || Date.now() - prev > 60_000;
}

export function recordSent(token: string): void {
  lastSentAt.set(token, Date.now());
}

export function storeOtp(token: string, hash: string): void {
  otpStore.set(token, { hash, expiresAt: Date.now() + 5 * 60_000, attempts: 0 });
}

/**
 * Verify an OTP candidate. Returns true on match (and clears the entry),
 * false otherwise. Locks out after 5 failed attempts to prevent brute
 * force, even though the search space is only 1M.
 */
export async function consumeOtp(token: string, otp: string): Promise<boolean> {
  const entry = otpStore.get(token);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(token);
    return false;
  }
  entry.attempts += 1;
  if (entry.attempts > 5) {
    otpStore.delete(token);
    return false;
  }
  const candidate = await hashOtp(otp, token);
  if (candidate === entry.hash) {
    otpStore.delete(token);
    return true;
  }
  return false;
}
