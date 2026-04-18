"use client";

import { useRef, useState } from "react";
import { Camera, ChevronRight, Plus, Shield } from "lucide-react";
import { toast } from "sonner";
import type { MemberFormData } from "@/lib/utils/validators";
import { compressToWebP } from "@/lib/utils/image";
import { cn } from "@/lib/utils";

type Relation = MemberFormData["relation"];

// A1 design uses compact, familial labels. Maps to full schema relations.
const RELATIONSHIPS: Array<{ id: Relation; label: string }> = [
  { id: "self", label: "Self" },
  { id: "spouse", label: "Spouse" },
  { id: "mother", label: "Mom" },
  { id: "father", label: "Dad" },
  { id: "son", label: "Son" },
  { id: "daughter", label: "Daughter" },
  { id: "brother", label: "Brother" },
  { id: "sister", label: "Sister" },
  { id: "other", label: "Other" },
];

const CONDITION_PRESETS = [
  "Diabetes",
  "High BP",
  "Cholesterol",
  "Asthma",
  "Heart",
  "Thyroid",
  "Allergies",
];

const BLOOD_CHIPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

interface MemberFormProps {
  onSubmit: (data: MemberFormData) => void;
  loading?: boolean;
  submitLabel?: string;
  defaultValues?: Partial<MemberFormData>;
  defaultRelation?: string;
  hideRelation?: boolean;
}

export function MemberForm({
  onSubmit,
  loading,
  submitLabel,
  defaultValues,
  defaultRelation,
  hideRelation,
}: MemberFormProps) {
  const [name, setName] = useState(defaultValues?.name || "");
  const [dob, setDob] = useState(defaultValues?.date_of_birth || "");
  const [rel, setRel] = useState<Relation>(
    (defaultValues?.relation as Relation) ||
      (defaultRelation as Relation) ||
      "self"
  );
  const [bloodGroup, setBloodGroup] = useState(defaultValues?.blood_group || "");
  const [conditions, setConditions] = useState<string[]>(
    defaultValues?.chronic_conditions || []
  );
  const [allergies, setAllergies] = useState<string[]>(
    defaultValues?.allergies || []
  );
  const [contactName, setContactName] = useState(
    defaultValues?.emergency_contact_name || ""
  );
  const [contactPhone, setContactPhone] = useState(
    defaultValues?.emergency_contact_phone || ""
  );
  const [avatarUrl, setAvatarUrl] = useState(defaultValues?.avatar_url || "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const age = dob ? ageFrom(dob) : null;
  // Name + DOB + relation all required by product decision.
  const ready = name.trim().length > 0 && !!dob && !!rel;

  const progress = [
    name.trim().length > 0,
    !!dob,
    !!rel,
    conditions.length > 0,
    contactName.trim().length > 0,
  ];

  const toggleCondition = (c: string) => {
    setConditions((s) =>
      s.includes(c) ? s.filter((x) => x !== c) : [...s, c]
    );
  };

  const handleAvatarSelect = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setUploadingAvatar(true);
    try {
      const { dataUrl } = await compressToWebP(file, {
        maxSizeKB: 200,
        maxDim: 512,
      });
      setAvatarUrl(dataUrl);
    } catch (err) {
      console.error("Avatar compression failed:", err);
      toast.error("Could not process that image. Try another.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || loading) return;
    if (contactPhone && !/^[6-9]\d{9}$/.test(contactPhone)) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    onSubmit({
      name: name.trim(),
      relation: rel,
      date_of_birth: dob,
      blood_group: (bloodGroup as MemberFormData["blood_group"]) || "",
      gender: "",
      allergies,
      chronic_conditions: conditions,
      emergency_contact_name: contactName.trim(),
      emergency_contact_phone: contactPhone.trim(),
      avatar_url: avatarUrl,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col min-h-[100vh] pb-28"
    >
      {/* Progress dots */}
      <div className="flex gap-1.5 px-5 pt-2 pb-4">
        {progress.map((on, i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              on ? "bg-foreground" : "bg-muted/60"
            )}
          />
        ))}
      </div>

      <div className="flex-1 px-5 space-y-6">
        {/* Photo */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="relative h-24 w-24 rounded-full border-[1.5px] border-dashed border-muted-foreground/40 bg-muted/40 flex items-center justify-center overflow-hidden active:scale-[0.98] transition-transform"
            aria-label="Add photo"
          >
            {uploadingAvatar ? (
              <div className="h-6 w-6 border-[2.5px] border-primary/30 border-t-primary rounded-full animate-spin" />
            ) : avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="Profile"
                className="h-full w-full object-cover"
              />
            ) : name ? (
              <span className="text-2xl font-extrabold text-muted-foreground">
                {initialsFor(name)}
              </span>
            ) : (
              <Plus className="h-7 w-7 text-muted-foreground" />
            )}
            <span className="absolute bottom-1 right-1 h-7 w-7 rounded-full bg-foreground text-background flex items-center justify-center shadow-sm ring-2 ring-background">
              <Camera className="h-3 w-3" />
            </span>
          </button>
          <p className="text-[11px] text-muted-foreground font-medium">
            {avatarUrl ? (
              <>
                <b className="text-foreground">Photo added</b> · Tap to change
              </>
            ) : (
              <>
                Tap to add a <b className="text-foreground">photo</b> (optional)
              </>
            )}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarSelect}
          />
        </div>

        <Field label="Full name" hint="Required">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Meera Kapoor"
            className={cn(
              "w-full h-[52px] rounded-2xl border bg-card px-4 text-[15px] font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors",
              name ? "border-foreground/20" : "border-border/50"
            )}
          />
        </Field>

        <Field label="Date of birth" hint="Required">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className={cn(
                "flex-1 h-[52px] rounded-2xl border bg-card px-4 text-[15px] font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors",
                dob ? "border-foreground/20" : "border-border/50"
              )}
            />
            {age != null && (
              <div className="shrink-0 h-[52px] px-4 rounded-2xl bg-muted/60 flex items-center justify-center font-mono text-[13px] font-extrabold">
                {age} yr
              </div>
            )}
          </div>
        </Field>

        {!hideRelation && (
          <Field label="Relationship">
            <div className="flex flex-wrap gap-2">
              {RELATIONSHIPS.map((r) => (
                <Chip
                  key={r.id}
                  active={rel === r.id}
                  onClick={() => setRel(r.id)}
                  label={r.label}
                />
              ))}
            </div>
          </Field>
        )}

        <Field label="Blood group" hint="Optional">
          <div className="flex flex-wrap gap-2">
            {BLOOD_CHIPS.map((bg) => (
              <Chip
                key={bg}
                active={bloodGroup === bg}
                onClick={() =>
                  setBloodGroup((current) => (current === bg ? "" : bg))
                }
                label={bg}
              />
            ))}
          </div>
        </Field>

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

        <Field label="Allergies" hint="Optional · pick any">
          <div className="flex flex-wrap gap-2">
            {["Peanuts", "Penicillin", "Dust", "Pollen", "Lactose"].map((a) => (
              <Chip
                key={a}
                active={allergies.includes(a)}
                onClick={() =>
                  setAllergies((s) =>
                    s.includes(a) ? s.filter((x) => x !== a) : [...s, a]
                  )
                }
                label={a}
              />
            ))}
          </div>
        </Field>

        <Field label="Emergency contact" hint="Optional">
          <div className="rounded-2xl border border-border/50 bg-muted/30 p-3 space-y-2">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-[#DFF3E7] text-[#1F6A49] flex items-center justify-center shrink-0">
                <Shield className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-[12.5px] font-bold">
                  Someone to call in urgency
                </p>
                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                  We only share their details when you tap SOS.
                </p>
              </div>
            </div>
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Contact name"
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
              placeholder="10-digit mobile number"
              className="w-full h-11 rounded-xl bg-card border border-border/40 px-3.5 text-[14px] font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </Field>
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-0 z-20 bg-background/95 backdrop-blur-sm border-t border-border/40 px-4 pt-3 pb-4">
        <button
          type="submit"
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
              {submitLabel || `Save ${name.split(" ")[0] || "member"}`}
              <ChevronRight className="h-4 w-4" />
            </>
          ) : (
            // Specific prompt — tell the user exactly what's missing.
            // Never mention fields that are hidden (e.g. relationship in onboarding).
            (() => {
              const missing: string[] = [];
              if (name.trim().length === 0) missing.push("name");
              if (!dob) missing.push("date of birth");
              if (!hideRelation && !rel) missing.push("relationship");
              if (missing.length === 0) return "Continue";
              if (missing.length === 1) return `Add your ${missing[0]}`;
              if (missing.length === 2) return `Add ${missing[0]} and ${missing[1]}`;
              return `Add ${missing.slice(0, -1).join(", ")}, and ${missing.at(-1)}`;
            })()
          )}
        </button>
        <p className="text-[11px] text-muted-foreground text-center mt-2 font-medium">
          You can edit anytime from the family screen.
        </p>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-muted-foreground font-mono">
          {label}
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

function ageFrom(dob: string): number | null {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
