"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, ChevronDown, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormField,
  FormGroup,
  FormInput,
  FormPillGroup,
  FormStickyAction,
  formSelectTriggerClasses,
} from "@/components/ui/form-primitives";
import { memberSchema, type MemberFormData } from "@/lib/utils/validators";
import { RELATION_LABELS, BLOOD_GROUPS } from "@/constants/config";
import { TagInput } from "@/components/family/tag-input";
import { compressToWebP } from "@/lib/utils/image";
import { cn } from "@/lib/utils";

interface MemberFormProps {
  onSubmit: (data: MemberFormData) => void;
  loading?: boolean;
  submitLabel?: string;
  defaultValues?: Partial<MemberFormData>;
  defaultRelation?: string;
  hideRelation?: boolean;
}

const GENDER_OPTIONS: Array<{ value: "male" | "female" | "other"; label: string }> = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

export function MemberForm({
  onSubmit,
  loading,
  submitLabel = "Save",
  defaultValues,
  defaultRelation,
  hideRelation,
}: MemberFormProps) {
  const hasExtraDetails = !!(
    (defaultValues?.allergies && defaultValues.allergies.length > 0) ||
    (defaultValues?.chronic_conditions && defaultValues.chronic_conditions.length > 0) ||
    defaultValues?.emergency_contact_name ||
    defaultValues?.emergency_contact_phone
  );
  const [showMore, setShowMore] = useState(hasExtraDetails);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      name: "",
      relation: (defaultRelation as MemberFormData["relation"]) || "self",
      date_of_birth: "",
      blood_group: undefined,
      gender: undefined,
      allergies: [],
      chronic_conditions: [],
      emergency_contact_name: "",
      emergency_contact_phone: "",
      avatar_url: "",
      ...defaultValues,
    },
  });

  const allergies = watch("allergies") || [];
  const chronicConditions = watch("chronic_conditions") || [];
  const avatarUrl = watch("avatar_url") || "";
  const name = watch("name") || "";
  const bloodGroup = watch("blood_group") || "";
  const gender = watch("gender") || "";

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
      setValue("avatar_url", dataUrl, { shouldDirty: true });
    } catch (err) {
      console.error("Avatar compression failed:", err);
      toast.error("Could not process that image. Try another.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const initials =
    name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="pb-32">
      {/* ═══════ PROFILE PHOTO ═══════ */}
      <div className="flex flex-col items-center pt-2 pb-8">
        <div className="relative">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="h-28 w-28 rounded-full overflow-hidden bg-muted flex items-center justify-center active:scale-[0.98] transition-transform disabled:opacity-60 shadow-sm"
            aria-label="Upload profile photo"
          >
            {uploadingAvatar ? (
              <div className="h-6 w-6 border-[2.5px] border-primary/30 border-t-primary rounded-full animate-spin" />
            ) : avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-3xl font-semibold text-muted-foreground/70">
                {initials}
              </span>
            )}
          </button>

          {/* Edit photo floating button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="absolute -bottom-1 -right-1 h-10 px-3.5 rounded-full bg-primary text-primary-foreground flex items-center gap-1.5 text-xs font-semibold shadow-md ring-4 ring-background active:scale-95 transition-transform disabled:opacity-60"
          >
            {avatarUrl ? (
              <>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </>
            ) : (
              <>
                <Camera className="h-3.5 w-3.5" />
                Add photo
              </>
            )}
          </button>

          {avatarUrl && !uploadingAvatar && (
            <button
              type="button"
              onClick={() => setValue("avatar_url", "", { shouldDirty: true })}
              className="absolute -top-1 -left-1 h-7 w-7 rounded-full bg-background text-muted-foreground hover:text-destructive flex items-center justify-center shadow-sm ring-1 ring-border/50 active:scale-95 transition-transform"
              aria-label="Remove photo"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarSelect}
        />
      </div>

      {/* ═══════ PERSONAL ═══════ */}
      <FormGroup title="Personal">
        <FormField label="Full name" error={errors.name?.message}>
          <FormInput placeholder="e.g. Sandeep Kumar" {...register("name")} />
        </FormField>

        {!hideRelation && (
          <FormField label="Relation" error={errors.relation?.message}>
            <Select
              defaultValue={defaultValues?.relation || defaultRelation || "self"}
              onValueChange={(val) =>
                setValue("relation", val as MemberFormData["relation"])
              }
            >
              <SelectTrigger className={formSelectTriggerClasses}>
                <SelectValue placeholder="Select relation" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(RELATION_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        )}

        <FormField label="Date of birth" optional>
          <FormInput type="date" {...register("date_of_birth")} />
        </FormField>

        <FormField label="Gender" optional>
          <FormPillGroup
            value={gender as "male" | "female" | "other" | ""}
            onChange={(val) => setValue("gender", val, { shouldDirty: true })}
            options={GENDER_OPTIONS}
          />
        </FormField>
      </FormGroup>

      {/* ═══════ MEDICAL ═══════ */}
      <FormGroup title="Medical">
        <FormField label="Blood group" optional>
          <Select
            value={bloodGroup || undefined}
            onValueChange={(val) =>
              setValue("blood_group", val as MemberFormData["blood_group"], {
                shouldDirty: true,
              })
            }
          >
            <SelectTrigger className={formSelectTriggerClasses}>
              <SelectValue placeholder="Select blood group" />
            </SelectTrigger>
            <SelectContent>
              {BLOOD_GROUPS.map((bg) => (
                <SelectItem key={bg} value={bg}>
                  {bg}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </FormGroup>

      {/* ═══════ MORE TOGGLE ═══════ */}
      <button
        type="button"
        onClick={() => setShowMore(!showMore)}
        className="w-full flex items-center justify-between px-1 py-4 text-[14px] font-medium text-foreground/80 hover:text-foreground transition-colors"
      >
        <span>More details</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            showMore && "rotate-180"
          )}
        />
      </button>

      {showMore && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
          <FormGroup title="Health alerts">
            <FormField label="Allergies" optional>
              <TagInput
                tags={allergies}
                onChange={(tags) => setValue("allergies", tags)}
                placeholder="e.g. Peanuts, Penicillin"
              />
            </FormField>
            <FormField label="Chronic conditions" optional>
              <TagInput
                tags={chronicConditions}
                onChange={(tags) => setValue("chronic_conditions", tags)}
                placeholder="e.g. Diabetes, Hypertension"
              />
            </FormField>
          </FormGroup>

          <FormGroup title="Emergency contact">
            <FormField label="Name" optional>
              <FormInput
                placeholder="Full name"
                {...register("emergency_contact_name")}
              />
            </FormField>
            <FormField
              label="Phone"
              optional
              error={errors.emergency_contact_phone?.message}
            >
              <FormInput
                type="tel"
                placeholder="10-digit mobile number"
                maxLength={10}
                {...register("emergency_contact_phone")}
              />
            </FormField>
          </FormGroup>
        </div>
      )}

      <FormStickyAction>
        <Button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl text-[15px] font-semibold shadow-lg shadow-primary/15 transition-transform active:scale-[0.98]"
          style={{ height: "52px" }}
        >
          {loading ? (
            <>
              <div className="h-4 w-4 border-[2.5px] border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin mr-2" />
              Saving...
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </FormStickyAction>
    </form>
  );
}
