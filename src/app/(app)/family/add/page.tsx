"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, Plus, Camera, Shield, ChevronRight, Users, Mail } from "lucide-react";
import { useMembers } from "@/hooks/use-members";
import { createClient } from "@/lib/supabase/client";
import type { MemberFormData } from "@/lib/utils/validators";
import { compressToWebP } from "@/lib/utils/image";
import { cn } from "@/lib/utils";

type Relation = MemberFormData["relation"];

// A1 design uses compact, familial labels. Maps to the full schema relation codes.
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

// Common preset conditions — still backed by the free-form chronic_conditions array.
const CONDITION_PRESETS = [
  "Diabetes",
  "High BP",
  "Cholesterol",
  "Asthma",
  "Heart",
  "Thyroid",
  "Allergies",
];

export default function AddMemberPage() {
  const router = useRouter();
  const { addMember } = useMembers();
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [rel, setRel] = useState<Relation | null>(null);
  const [conditions, setConditions] = useState<string[]>([]);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Member quota — fetched once on mount. The form is hidden entirely if
  // the cap is already reached so users never type into a blocked form.
  // Failure to fetch falls back to "allow" so a quota outage can't block
  // adding a member. Quota check itself is fail-open server-side too.
  const [quota, setQuota] = useState<
    | { used: number; limit: number | "unlimited"; exceeded: boolean; unlimited: boolean }
    | null
  >(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = {};
        if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
        const res = await fetch("/api/member-quota", { headers });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        setQuota({
          used: data.used,
          limit: data.limit,
          exceeded: data.exceeded,
          unlimited: data.unlimited,
        });
      } catch {
        // fail-open
        if (!cancelled) {
          setQuota({ used: 0, limit: "unlimited", exceeded: false, unlimited: true });
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const age = dob ? ageFrom(dob) : null;
  const ready = name.trim().length > 0 && !!dob && !!rel;

  // Progress dots — 5 discrete signals (name, dob, rel, conditions, contact)
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

  const handleSubmit = async () => {
    if (!ready || loading) return;
    if (quota?.exceeded) {
      // Last-line guard if state somehow let us through (race with quota
      // fetch, or user opened tab before quota loaded). The page-level
      // gate below normally hides the form before this can fire.
      toast.error("You've reached the family member limit");
      return;
    }
    if (contactPhone && !/^[6-9]\d{9}$/.test(contactPhone)) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    setLoading(true);
    try {
      const data: MemberFormData = {
        name: name.trim(),
        relation: rel as Relation,
        date_of_birth: dob,
        blood_group: "",
        gender: "",
        allergies: [],
        chronic_conditions: conditions,
        emergency_contact_name: contactName.trim(),
        emergency_contact_phone: contactPhone.trim(),
        avatar_url: avatarUrl,
      };
      await addMember(data);
      toast.success(`${data.name} added to your family!`);
      router.replace("/family");
    } catch (err) {
      console.error("addMember failed:", err);
      toast.error(
        err instanceof Error ? `Failed to add: ${err.message}` : "Failed to add family member."
      );
    } finally {
      setLoading(false);
    }
  };

  // ─── Cap-reached gate ────────────────────────────────────────────────
  // Blocks the form entirely so users don't fill out fields just to be
  // told no on submit. Shown in place of the form when the user is at
  // the limit. Care Home tier is intentionally NOT mentioned here —
  // that tier is for institutional caretakers, not large families.
  if (quota?.exceeded && !quota.unlimited) {
    const supportSubject = encodeURIComponent("Need more family members");
    const supportBody = encodeURIComponent(
      `Hi MediFamily team,\n\nI've hit the ${quota.limit}-member limit on my account and need to add more family members. Please bump my limit.\n\nThanks!`
    );
    return (
      <div className="flex flex-col min-h-[100vh]">
        <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-sm flex items-center justify-between px-4 py-3 border-b border-transparent">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Back"
            className="h-9 w-9 rounded-full bg-muted/60 flex items-center justify-center active:scale-95 transition-transform"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-[13px] font-bold">Family is full</p>
          <span className="h-9 w-9" aria-hidden="true" />
        </div>

        <div className="flex-1 px-5 pt-8 space-y-6">
          <div className="text-center space-y-3">
            <div className="h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center mx-auto">
              <Users className="h-8 w-8 text-amber-600" />
            </div>
            <h1 className="text-[24px] font-bold tracking-tight">
              You&apos;ve added all {quota.limit} family members
            </h1>
            <p className="text-[14px] text-muted-foreground leading-relaxed max-w-md mx-auto">
              The Family plan covers up to {quota.limit} people — typically
              you, your spouse, kids, and parents. Need to add more (extended
              family, in-laws, grandparents)? Drop us a line and we&apos;ll
              bump your limit.
            </p>
          </div>

          <div className="rounded-2xl border border-border/50 bg-muted/40 p-4 space-y-3">
            <p className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
              Already added ({quota.used} / {quota.limit})
            </p>
            <p className="text-[13px] text-foreground/80 leading-relaxed">
              You can free up a slot by removing a member you no longer need
              from the family list — or contact us to add more.
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <a
                href={`mailto:support@medifamily.in?subject=${supportSubject}&body=${supportBody}`}
                className="w-full h-12 rounded-xl bg-foreground text-background inline-flex items-center justify-center gap-2 text-[14px] font-extrabold active:scale-[0.98] transition-transform"
              >
                <Mail className="h-4 w-4" />
                Email us to bump my limit
              </a>
              <button
                type="button"
                onClick={() => router.replace("/family")}
                className="w-full h-12 rounded-xl border border-border/50 bg-card text-foreground inline-flex items-center justify-center gap-2 text-[14px] font-bold active:scale-[0.98] transition-transform"
              >
                Back to family list
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100vh] pb-28">
      {/* Sticky top nav */}
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-sm flex items-center justify-between px-4 py-3 border-b border-transparent">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="h-9 w-9 rounded-full bg-muted/60 flex items-center justify-center active:scale-95 transition-transform"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-[13px] font-bold">Add member</p>
        <span className="h-9 w-9" aria-hidden="true" />
      </div>

      {/* Progress dots */}
      <div className="flex gap-1.5 px-5 pt-1 pb-4">
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
        {/* Hero copy */}
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Add a family member
          </p>
          <h1 className="text-[30px] font-bold tracking-tight leading-tight mt-1.5">
            Tell us a bit about them
          </h1>
          <p className="text-[13px] text-muted-foreground leading-relaxed mt-2">
            We only need the basics now — you can always fill in the rest later.
          </p>
          {/* Soft slots-remaining hint — only shown when 1-2 slots are left
              so it doesn't pester users with plenty of room. */}
          {quota && !quota.unlimited && typeof quota.limit === "number" &&
            quota.limit - quota.used <= 2 && quota.limit - quota.used > 0 && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 px-3 py-1 text-[11.5px] font-semibold">
                <Users className="h-3 w-3" />
                {quota.limit - quota.used} of {quota.limit} slots left
              </div>
            )}
        </div>

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

        {/* Full name */}
        <Field label="Full name">
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

        {/* DOB */}
        <Field label="Date of birth">
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

        {/* Relationship */}
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

        {/* Emergency contact */}
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
              Save {name.split(" ")[0] || "member"}
              <ChevronRight className="h-4 w-4" />
            </>
          ) : (
            "Fill in name, DOB and relationship"
          )}
        </button>
        <p className="text-[11px] text-muted-foreground text-center mt-2 font-medium">
          You can edit anytime from the family screen.
        </p>
      </div>
    </div>
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
