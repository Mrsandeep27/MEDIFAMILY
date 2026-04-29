"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, AlertCircle } from "lucide-react";
import { useIncidents } from "@/hooks/use-incidents";
import { useMember } from "@/hooks/use-members";
import { cn } from "@/lib/utils";
import type { IncidentType } from "@/lib/db/schema";

const TYPES: { value: IncidentType; label: string }[] = [
  { value: "fall", label: "Fall" },
  { value: "illness", label: "Illness" },
  { value: "hospital", label: "Hospital" },
  { value: "other", label: "Other" },
];

/**
 * Incident logging — kept deliberately minimal: 4 type chips, when-it-
 * happened (defaults to now), what happened, action taken. Saved as a
 * timestamped + caretaker-signed entry visible on the resident profile.
 *
 * Validation: type is required, and at least one of notes / action_taken
 * must be filled (otherwise the entry is meaningless for compliance).
 */
export default function NewIncidentPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = use(params);
  const router = useRouter();
  const { addIncident } = useIncidents();
  const { member } = useMember(memberId);

  const [type, setType] = useState<IncidentType>("fall");
  const [occurredAt, setOccurredAt] = useState(() => {
    // datetime-local needs YYYY-MM-DDTHH:MM (no seconds, no TZ)
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [notes, setNotes] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [loading, setLoading] = useState(false);

  const ready = notes.trim().length > 0 || actionTaken.trim().length > 0;

  const handleSubmit = async () => {
    if (!ready || loading) return;
    setLoading(true);
    try {
      await addIncident({
        member_id: memberId,
        type,
        // datetime-local has no TZ — treat as local + convert to ISO.
        occurred_at: new Date(occurredAt).toISOString(),
        notes: notes.trim(),
        action_taken: actionTaken.trim(),
      });
      toast.success("Incident logged");
      router.replace(`/residents/${memberId}`);
    } catch (err) {
      console.error("addIncident failed:", err);
      toast.error("Failed to log incident");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-[100vh] pb-28">
      {/* Top */}
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-sm flex items-center justify-between px-4 py-3 border-b border-transparent">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="h-9 w-9 rounded-full bg-muted/60 flex items-center justify-center active:scale-95"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-[13px] font-bold">Report incident</p>
        <span className="h-9 w-9" aria-hidden="true" />
      </div>

      <div className="flex-1 px-5 space-y-5 pt-2">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-9 w-9 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 flex items-center justify-center">
              <AlertCircle className="h-5 w-5" />
            </div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {member?.name || "Resident"} · Room {member?.room_no || "—"}
            </p>
          </div>
          <h1 className="text-[24px] font-bold tracking-tight leading-tight">
            What happened?
          </h1>
        </div>

        {/* Type */}
        <Field label="Type" required>
          <div className="grid grid-cols-2 gap-2">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={cn(
                  "h-12 rounded-xl text-[14px] font-bold transition-colors",
                  type === t.value
                    ? "bg-foreground text-background"
                    : "bg-muted/50 border border-border/50"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </Field>

        {/* Occurred at */}
        <Field label="When">
          <input
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            className="w-full h-[52px] rounded-2xl border border-border/50 bg-card px-4 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </Field>

        {/* Notes */}
        <Field label="What happened" hint="Be specific">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Resident slipped in bathroom, complained of left hip pain, no visible injury."
            rows={4}
            className="w-full rounded-2xl border border-border/50 bg-card px-4 py-3 text-[14px] font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
        </Field>

        {/* Action taken */}
        <Field label="Action taken" hint="What you did">
          <textarea
            value={actionTaken}
            onChange={(e) => setActionTaken(e.target.value)}
            placeholder="e.g. Helped to bed, applied ice pack, informed family + Dr. Sharma."
            rows={3}
            className="w-full rounded-2xl border border-border/50 bg-card px-4 py-3 text-[14px] font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
        </Field>

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          This will be timestamped and signed under your caretaker account
          for the audit trail.
        </p>
      </div>

      {/* Save */}
      <div className="sticky bottom-0 z-20 bg-background/95 backdrop-blur-sm border-t border-border/40 px-4 pt-3 pb-4">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!ready || loading}
          className={cn(
            "w-full h-[52px] rounded-2xl inline-flex items-center justify-center text-[14px] font-extrabold tracking-tight transition-all",
            ready
              ? "bg-foreground text-background active:scale-[0.98] shadow-[0_8px_18px_rgba(11,11,12,0.2)]"
              : "bg-muted/60 text-muted-foreground"
          )}
        >
          {loading ? "Saving..." : ready ? "Save incident" : "Add details first"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-muted-foreground font-mono">
          {label}
          {required && <span className="text-foreground ml-1">*</span>}
        </p>
        {hint && (
          <span className="text-[10.5px] font-medium text-muted-foreground/80">
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
