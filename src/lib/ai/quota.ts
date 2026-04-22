import { prisma } from "@/lib/db/prisma";
import { MONTHLY_AI_QUOTA, AI_FEATURES } from "@/constants/config";

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
  const override = await prisma.userOverride.findUnique({ where: { user_id: userId } }).catch(() => null);

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

  const used = await prisma.apiUsage.count({
    where: {
      user_id: userId,
      success: true,
      feature: { in: AI_FEATURES as unknown as string[] },
      created_at: { gte: firstOfMonthUTC() },
    },
  });

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
  const status = await getQuotaStatus(userId);
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
