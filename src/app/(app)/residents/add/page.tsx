"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Shield } from "lucide-react";
import { useResidents } from "@/hooks/use-residents";
import { cn } from "@/lib/utils";

const CONDITION_PRESETS = [
  "Diabetes",
  "Hypertension",
  "Heart",
  "Dementia",
  "Mobility",
  "Stroke",
  "Arthritis",
  "Kidney",
];

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

/**
 * Mobile-first add-resident form. Required: name + room. Everything else
 * optional — caretaker can fill in later from the resident profile.
 * Fewer fields = faster typing on a phone in a busy home.
 */
export default function AddResidentPage() {
  const router = useRouter();
  const { addResident } = useResidents();
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [roomNo, setRoomNo] = useState("");
  const [dob, setDob] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [conditions, setConditions] = useState<string[]>([]);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const ready = name.trim().length > 0 && roomNo.trim().length > 0;

  const toggleCondition = (c: string) => {
    setConditions((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  const handleSubmit = async () => {
    if (!ready || loading) return;
    if (contactPhone && !/^[6-9]\d{9}$/.test(contactPhone)) {
      toast.error("Enter a valid 10-digit phone");
      return;
    }
    setLoading(true);
    try {
      await addResident({
        name: name.trim(),
        date_of_birth: dob,
        room_no: roomNo.trim(),
        blood_group: bloodGroup,
        conditions,
        emergency_contact_name: contactName.trim(),
        emergency_contact_phone: contactPhone.trim(),
      });
      toast.success(`${name.split(" ")[0]} added — room ${roomNo}`);
      router.replace("/residents");
    } catch (err) {
      console.error("addResident failed:", err);
      toast.error(
        err instanceof Error ? `Failed: ${err.message}` : "Failed to add"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-[100vh] pb-28">
      {/* Sticky top */}
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-sm flex items-center justify-between px-4 py-3 border-b border-transparent">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="h-9 w-9 rounded-full bg-muted/60 flex items-center justify-center active:scale-95 transition-transform"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-[13px] font-bold">Add resident</p>
        <span className="h-9 w-9" aria-hidden="true" />
      </div>

      <div className="flex-1 px-5 space-y-5 pt-2">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            New resident
          </p>
          <h1 className="text-[26px] font-bold tracking-tight leading-tight mt-1.5">
            Just two things to start
          </h1>
          <p className="text-[13px] text-muted-foreground leading-relaxed mt-1.5">
            Name and room number. The rest you can fill in later from the
            resident&apos;s profile.
          </p>
        </div>

        {/* Name */}
        <Field label="Full name" required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Mrs. Sharma"
            autoFocus
            className={cn(
              "w-full h-[52px] rounded-2xl border bg-card px-4 text-[15px] font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors",
              name ? "border-foreground/20" : "border-border/50"
            )}
          />
        </Field>

        {/* Room */}
        <Field label="Room number" required>
          <input
            value={roomNo}
            onChange={(e) => setRoomNo(e.target.value)}
            placeholder="e.g. 101"
            className={cn(
              "w-full h-[52px] rounded-2xl border bg-card px-4 text-[15px] font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors",
              roomNo ? "border-foreground/20" : "border-border/50"
            )}
          />
        </Field>

        {/* DOB */}
        <Field label="Date of birth" hint="Optional">
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className={cn(
              "w-full h-[52px] rounded-2xl border bg-card px-4 text-[15px] font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors",
              dob ? "border-foreground/20" : "border-border/50"
            )}
          />
        </Field>

        {/* Blood group */}
        <Field label="Blood group" hint="Optional">
          <div className="flex flex-wrap gap-2">
            {BLOOD_GROUPS.map((g) => (
              <Chip
                key={g}
                active={bloodGroup === g}
                onClick={() => setBloodGroup(g === bloodGroup ? "" : g)}
                label={g}
              />
            ))}
          </div>
        </Field>

        {/* Conditions */}
        <Field label="Conditions" hint="Optional · pick any">
          <div className="flex flex-wrap gap-2">
            {CONDITION_PRESETS.map((c) => (
              <Chip
                key={c}
                active={conditions.includes(c)}
                onClick={() => toggleCondition(c)}
                label={c}
              />
            ))}
          </div>
        </Field>

        {/* Next of kin */}
        <Field label="Next of kin" hint="Optional · for emergencies">
          <div className="rounded-2xl border border-border/50 bg-muted/30 p-3 space-y-2">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-[#DFF3E7] text-[#1F6A49] flex items-center justify-center shrink-0">
                <Shield className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-[12.5px] font-bold">Family member to call</p>
                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                  Used for incident notifications and the share link.
                </p>
              </div>
            </div>
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Contact name (e.g. son, daughter)"
              className="w-full h-11 rounded-xl bg-card border border-border/40 px-3.5 text-[14px] font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={contactPhone}
              onChange={(e) =>
                setContactPhone(e.target.value.replace(/\D/g, ""))
              }
              placeholder="10-digit mobile"
              className="w-full h-11 rounded-xl bg-card border border-border/40 px-3.5 text-[14px] font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </Field>
      </div>

      {/* Sticky save */}
      <div className="sticky bottom-0 z-20 bg-background/95 backdrop-blur-sm border-t border-border/40 px-4 pt-3 pb-4">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!ready || loading}
          className={cn(
            "w-full h-[52px] rounded-2xl inline-flex items-center justify-center gap-2 text-[14px] font-extrabold tracking-tight transition-all",
            ready
              ? "bg-foreground text-background active:scale-[0.98] shadow-[0_8px_18px_rgba(11,11,12,0.2)]"
              : "bg-muted/60 text-muted-foreground"
          )}
        >
          {loading ? (
            <>
              <div className="h-4 w-4 border-[2.5px] border-background/40 border-t-background rounded-full animate-spin" />
              Saving...
            </>
          ) : ready ? (
            <>
              Save & add another
              <ChevronRight className="h-4 w-4" />
            </>
          ) : (
            "Enter name and room number"
          )}
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

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center h-10 px-4 rounded-full text-[13px] font-bold transition-colors",
        active
          ? "bg-foreground text-background"
          : "bg-muted/50 text-foreground/80 border border-border/50 hover:bg-muted"
      )}
    >
      {label}
    </button>
  );
}
