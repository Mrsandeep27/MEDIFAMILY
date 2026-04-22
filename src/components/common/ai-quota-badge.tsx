"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sparkles } from "lucide-react";

type QuotaInfo = {
  used: number;
  limit: number | null;
  remaining: number | null;
  exceeded: boolean;
  unlimited: boolean;
  resetsAt: string;
};

/**
 * Home-screen chip showing this month's AI-action usage.
 * Hidden for unlimited users (pilot care homes).
 */
export function AIQuotaBadge() {
  const [info, setInfo] = useState<QuotaInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchQuota = async () => {
      try {
        const { data: { session } } = await createClient().auth.getSession();
        if (!session?.access_token) {
          if (!cancelled) setLoading(false);
          return;
        }
        const res = await fetch("/api/ai-quota", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) {
          if (!cancelled) setLoading(false);
          return;
        }
        const data: QuotaInfo = await res.json();
        if (!cancelled) setInfo(data);
      } catch {
        // Silent — quota badge is non-essential
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchQuota();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !info || info.unlimited) return null;

  const { used, limit, remaining, exceeded } = info;
  const limitVal = limit ?? 15;
  const pct = Math.min(100, Math.round((used / limitVal) * 100));

  const tone = exceeded
    ? "bg-red-500/15 text-red-100 border-red-300/30"
    : pct >= 80
      ? "bg-amber-500/15 text-amber-100 border-amber-300/30"
      : "bg-primary-foreground/10 text-primary-foreground/90 border-primary-foreground/20";

  const label = exceeded
    ? `AI cap reached · ${used}/${limitVal} · resets 1st`
    : remaining === 1
      ? `1 AI action left this month`
      : `${used} of ${limitVal} AI actions used this month`;

  return (
    <div
      className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-medium ${tone}`}
    >
      <Sparkles className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1">{label}</span>
    </div>
  );
}
