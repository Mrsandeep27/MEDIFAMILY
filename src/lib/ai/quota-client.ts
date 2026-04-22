import { toast } from "sonner";

export type QuotaExceededPayload = {
  error: "QUOTA_EXCEEDED";
  message: string;
  used: number;
  limit: number;
  resetsAt: string;
};

/**
 * Call this in every AI feature's `catch` branch. If the response was a
 * 429 QUOTA_EXCEEDED, shows a single consistent toast explaining the cap
 * and pointing the user toward the upgrade waitlist. Returns true if the
 * payload was a quota error (so caller can stop further error handling).
 */
export function handleQuotaError(payload: unknown): boolean {
  if (
    !payload ||
    typeof payload !== "object" ||
    (payload as { error?: string }).error !== "QUOTA_EXCEEDED"
  ) {
    return false;
  }
  const { used, limit, resetsAt } = payload as QuotaExceededPayload;
  const resetDate = new Date(resetsAt);
  const resetLabel = resetDate.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
  toast.error(
    `You've used all ${limit} AI actions this month (${used}/${limit}).`,
    {
      description: `Free cap resets ${resetLabel}. Tap "I want more" to join the upgrade waitlist — pricing launches soon.`,
      duration: 10000,
      action: {
        label: "I want more",
        onClick: () => {
          // Records interest signal — for now, just a mailto. Later this will
          // open the upgrade flow / /pricing page once that's built.
          window.location.href =
            "mailto:inventory.bharathcyclehub@gmail.com?subject=MediFamily%20-%20I%20need%20more%20AI%20scans&body=Hi%20Sandeep%2C%20I%20hit%20the%2015%2Fmonth%20AI%20cap.%20Please%20let%20me%20know%20when%20paid%20plans%20are%20available.";
        },
      },
    }
  );
  return true;
}
