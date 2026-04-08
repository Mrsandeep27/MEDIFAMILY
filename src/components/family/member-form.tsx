"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { memberSchema, type MemberFormData } from "@/lib/utils/validators";
import { RELATION_LABELS, BLOOD_GROUPS } from "@/constants/config";
import { TagInput } from "@/components/family/tag-input";

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
  submitLabel = "Save",
  defaultValues,
  defaultRelation,
  hideRelation,
}: MemberFormProps) {
  // If editing an existing member with extra details, show them expanded by default
  const hasExtraDetails = !!(
    defaultValues?.gender ||
    (defaultValues?.allergies && defaultValues.allergies.length > 0) ||
    (defaultValues?.chronic_conditions && defaultValues.chronic_conditions.length > 0) ||
    defaultValues?.emergency_contact_name ||
    defaultValues?.emergency_contact_phone
  );
  const [showMore, setShowMore] = useState(hasExtraDetails);

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
      ...defaultValues,
    },
  });

  const allergies = watch("allergies") || [];
  const chronicConditions = watch("chronic_conditions") || [];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Name — required */}
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input id="name" placeholder="Enter full name" {...register("name")} />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Relation — required */}
      {!hideRelation && (
        <div className="space-y-2">
          <Label>Relation *</Label>
          <Select
            defaultValue={defaultValues?.relation || defaultRelation || "self"}
            onValueChange={(val) =>
              setValue("relation", val as MemberFormData["relation"])
            }
          >
            <SelectTrigger>
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
          {errors.relation && (
            <p className="text-sm text-destructive">{errors.relation.message}</p>
          )}
        </div>
      )}

      {/* Date of Birth — optional but visible */}
      <div className="space-y-2">
        <Label htmlFor="dob">Date of Birth</Label>
        <Input id="dob" type="date" {...register("date_of_birth")} />
      </div>

      {/* Blood Group — optional but visible (matters for emergencies) */}
      <div className="space-y-2">
        <Label>Blood Group</Label>
        <Select
          defaultValue={defaultValues?.blood_group || ""}
          onValueChange={(val) =>
            setValue("blood_group", val as MemberFormData["blood_group"])
          }
        >
          <SelectTrigger>
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
      </div>

      {/* "More details" toggle */}
      <button
        type="button"
        onClick={() => setShowMore(!showMore)}
        className="flex items-center gap-1 text-sm text-primary hover:underline"
      >
        {showMore ? (
          <>
            <ChevronUp className="h-4 w-4" />
            Hide extra details
          </>
        ) : (
          <>
            <ChevronDown className="h-4 w-4" />
            Add more details (allergies, emergency contact)
          </>
        )}
      </button>

      {/* Hidden by default — expanded on demand */}
      {showMore && (
        <div className="space-y-4 pt-2 border-t">
          {/* Gender */}
          <div className="space-y-2">
            <Label>Gender</Label>
            <Select
              defaultValue={defaultValues?.gender || ""}
              onValueChange={(val) =>
                setValue("gender", val as MemberFormData["gender"])
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Allergies */}
          <div className="space-y-2">
            <Label>Allergies</Label>
            <TagInput
              tags={allergies}
              onChange={(tags) => setValue("allergies", tags)}
              placeholder="Add allergy (press Enter)"
            />
          </div>

          {/* Chronic Conditions */}
          <div className="space-y-2">
            <Label>Chronic Conditions</Label>
            <TagInput
              tags={chronicConditions}
              onChange={(tags) => setValue("chronic_conditions", tags)}
              placeholder="Add condition (press Enter)"
            />
          </div>

          {/* Emergency Contact Name */}
          <div className="space-y-2">
            <Label htmlFor="emergency_name">Emergency Contact Name</Label>
            <Input
              id="emergency_name"
              placeholder="Contact person name"
              {...register("emergency_contact_name")}
            />
          </div>

          {/* Emergency Contact Phone */}
          <div className="space-y-2">
            <Label htmlFor="emergency_phone">Emergency Contact Phone</Label>
            <Input
              id="emergency_phone"
              type="tel"
              placeholder="10-digit mobile number"
              maxLength={10}
              {...register("emergency_contact_phone")}
            />
            {errors.emergency_contact_phone && (
              <p className="text-sm text-destructive">
                {errors.emergency_contact_phone.message}
              </p>
            )}
          </div>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
