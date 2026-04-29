import { prisma } from "@/lib/db/prisma";
import {
  MONTHLY_AI_QUOTA,
  AI_FEATURES,
  DEFAULT_MEMBER_CAP,
} from "@/constants/config";

// Type guard — the userOverride model may not exist on the Prisma client
// if a deployment is running with a stale generated client (build cache).
// We treat an absent model as "no overrides" rather than crashing the
// request with TypeError "Cannot read properties of undefined".
type UserOverrideRow = {
  ai_quota_limit: number | null;
  member_cap: number | null;
  plan: string | null;
} | null;

async function safeLookupOverride(userId: string): Promise<UserOverrideRow> {
  try {
    // Property access on a missing model throws synchronously — guard with ?.
    // Then await with a catch for any async errors (table missing, RLS, etc.)
    const client = prisma as unknown as {
      userOverride?: {
        findUnique: (args: {
          where: { user_id: string };
        }) => Promise<UserOverrideRow>;
      };
    };
    if (!client.userOverride) return null;
    return await client.userOverride
      .findUnique({ where: { user_id: userId } })
      .catch(() => null);
  } catch {
    return null;
  }
}

export type QuotaStatus = {
  used: number;
  limit: number;
  remaining: number;
  exceeded: boolean;
  unlimited: boolean;
  resetsAt: string;
  plan: string | null;
};

function firstOfMonthUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function firstOfNextMonthUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

// Fallback env-var allowlist — kept for backward compatibility. The DB
// user_overrides table takes precedence when a row exists for the user.
function isUnlimitedByEnv(userId: string): boolean {
  const list = (process.env.AI_QUOTA_UNLIMITED_USERS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.includes(userId);
}

export async function getQuotaStatus(userId: string): Promise<QuotaStatus> {
  const resetsAt = firstOfNextMonthUTC().toISOString();

  // DB override lookup (admin-set). Keys: -1 = unlimited, positive = custom, null = default.
  // Wrapped — never throws even if the userOverride model is missing from the
  // Prisma client (e.g. stale build cache after schema change).
  const override = await safeLookupOverride(userId);

  const effectiveLimit =
    override?.ai_quota_limit === -1
      ? Infinity
      : typeof override?.ai_quota_limit === "number"
        ? override.ai_quota_limit
        : MONTHLY_AI_QUOTA;

  const envUnlimited = isUnlimitedByEnv(userId);
  const plan = override?.plan ?? null;

  if (effectiveLimit === Infinity || envUnlimited) {
    return {
      used: 0,
      limit: Infinity,
      remaining: Infinity,
      exceeded: false,
      unlimited: true,
      resetsAt,
      plan,
    };
  }

  // Usage count — also wrapped so a flaky DB call can't 500 the AI route.
  // If we can't read the count, fall back to "0 used" — a brief over-grant
  // is far preferable to blocking a real user.
  let used = 0;
  try {
    used = await prisma.apiUsage.count({
      where: {
        user_id: userId,
        success: true,
        feature: { in: AI_FEATURES as unknown as string[] },
        created_at: { gte: firstOfMonthUTC() },
      },
    });
  } catch (err) {
    console.warn("[quota] api_usage count failed; allowing request:", err);
  }

  const remaining = Math.max(0, effectiveLimit - used);
  return {
    used,
    limit: effectiveLimit,
    remaining,
    exceeded: used >= effectiveLimit,
    unlimited: false,
    resetsAt,
    plan,
  };
}

/**
 * Returns null if the user is within quota; otherwise returns a response body
 * the API route can send straight back with status 429.
 */
export async function enforceQuota(
  userId: string
): Promise<{ status: 429; body: QuotaExceededBody } | null> {
  // Final safety net — any unexpected error reading quota state must NOT
  // 500 the AI request. Default to "allow" if we can't tell. We'd rather
  // serve one extra request than block a paying user with a stack trace.
  let status: QuotaStatus;
  try {
    status = await getQuotaStatus(userId);
  } catch (err) {
    console.warn("[quota] enforceQuota lookup failed; allowing request:", err);
    return null;
  }
  if (status.exceeded) {
    return {
      status: 429,
      body: {
        error: "QUOTA_EXCEEDED",
        message: `You've used all ${status.limit} AI actions this month. The cap resets on the 1st.`,
        used: status.used,
        limit: status.limit,
        resetsAt: status.resetsAt,
      },
    };
  }
  return null;
}

export type QuotaExceededBody = {
  error: "QUOTA_EXCEEDED";
  message: string;
  used: number;
  limit: number;
  resetsAt: string;
};

// ─── Member cap (Family-plan member limit) ────────────────────────────────

export type MemberQuotaStatus = {
  used: number;
  limit: number;
  remaining: number;
  exceeded: boolean;
  unlimited: boolean;
  plan: string | null;
};

/**
 * How many active (non-deleted) members the user has, vs their cap.
 *
 * Cap resolution: admin override on user_overrides.member_cap takes
 * precedence (-1 = unlimited, positive = custom). Falls back to
 * DEFAULT_MEMBER_CAP for everyone else (currently 6).
 *
 * Used by the /family/add gate — when exceeded, the UI shows an
 * "upgrade to get more members" prompt instead of redirecting users
 * to the Care Home tier (which is for caretakers, not families).
 */
export async function getMemberQuotaStatus(
  userId: string
): Promise<MemberQuotaStatus> {
  const override = await safeLookupOverride(userId);

  const effectiveLimit =
    override?.member_cap === -1
      ? Infinity
      : typeof override?.member_cap === "number"
        ? override.member_cap
        : DEFAULT_MEMBER_CAP;

  const plan = override?.plan ?? null;

  if (effectiveLimit === Infinity) {
    return {
      used: 0,
      limit: Infinity,
      remaining: Infinity,
      exceeded: false,
      unlimited: true,
      plan,
    };
  }

  // Count active members. If the lookup fails (DB blip, missing
  // model, etc.) we fall back to "0 used" — better to allow one
  // extra add than block a paying user with a stack trace.
  let used = 0;
  try {
    used = await prisma.member.count({
      where: { user_id: userId, is_deleted: false },
    });
  } catch (err) {
    console.warn("[member-quota] count failed; allowing add:", err);
  }

  const remaining = Math.max(0, effectiveLimit - used);
  return {
    used,
    limit: effectiveLimit,
    remaining,
    exceeded: used >= effectiveLimit,
    unlimited: false,
    plan,
  };
}
