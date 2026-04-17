"use client";

import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, ImagePlus } from "lucide-react";
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
  FormStickyAction,
  FormTextarea,
  formSelectTriggerClasses,
} from "@/components/ui/form-primitives";
import { TagInput } from "@/components/family/tag-input";
import { recordSchema, type RecordFormData } from "@/lib/utils/validators";
import { RECORD_TYPE_LABELS } from "@/constants/config";
import { useMembers } from "@/hooks/use-members";

interface RecordFormProps {
  defaultValues?: Partial<RecordFormData>;
  defaultMemberId?: string;
  onSubmit: (data: RecordFormData, images: File[]) => Promise<void>;
  isSubmitting?: boolean;
}

export function RecordForm({
  defaultValues,
  defaultMemberId,
  onSubmit,
  isSubmitting,
}: RecordFormProps) {
  const { members } = useMembers();
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RecordFormData>({
    resolver: zodResolver(recordSchema),
    defaultValues: {
      member_id: defaultMemberId || "",
      type: "prescription",
      title: "",
      doctor_name: "",
      hospital_name: "",
      visit_date: new Date().toISOString().split("T")[0],
      diagnosis: "",
      notes: "",
      tags: [],
      ...defaultValues,
    },
  });

  const tags = watch("tags");

  useEffect(() => {
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const totalImages = images.length + files.length;
    if (totalImages > 10) {
      toast.error("Maximum 10 images per record");
      return;
    }

    setImages((prev) => [...prev, ...files]);
    const newPreviews = files.map((f) => URL.createObjectURL(f));
    setPreviews((prev) => [...prev, ...newPreviews]);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFormSubmit = async (data: RecordFormData) => {
    await onSubmit(data, images);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="pb-32">
      <FormGroup title="Record">
        <FormField label="Family member" error={errors.member_id?.message}>
          <Select
            value={watch("member_id")}
            onValueChange={(v) => setValue("member_id", v || "")}
          >
            <SelectTrigger className={formSelectTriggerClasses}>
              <SelectValue placeholder="Select member" />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Type">
          <Select
            value={watch("type")}
            onValueChange={(v) =>
              setValue("type", (v || "prescription") as RecordFormData["type"])
            }
          >
            <SelectTrigger className={formSelectTriggerClasses}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(RECORD_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Title" error={errors.title?.message}>
          <FormInput
            {...register("title")}
            placeholder="e.g. Dr. Sharma — Fever checkup"
          />
        </FormField>
      </FormGroup>

      <FormGroup title="Visit">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Doctor" optional>
            <FormInput {...register("doctor_name")} placeholder="Dr. Name" />
          </FormField>
          <FormField label="Hospital" optional>
            <FormInput {...register("hospital_name")} placeholder="Hospital" />
          </FormField>
        </div>

        <FormField label="Visit date" optional>
          <FormInput type="date" {...register("visit_date")} />
        </FormField>

        <FormField label="Diagnosis" optional>
          <FormInput {...register("diagnosis")} placeholder="e.g. Viral fever" />
        </FormField>

        <FormField label="Notes" optional>
          <FormTextarea
            {...register("notes")}
            placeholder="Additional notes..."
            rows={3}
          />
        </FormField>

        <FormField label="Tags" optional>
          <TagInput
            tags={tags}
            onChange={(newTags) => setValue("tags", newTags)}
            placeholder="Add tag and press Enter"
          />
        </FormField>
      </FormGroup>

      <FormGroup title="Photos & documents">
        <div className="grid grid-cols-4 gap-2">
          {previews.map((url, i) => (
            <div
              key={i}
              className="relative aspect-square rounded-xl overflow-hidden bg-muted"
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform"
              >
                <X className="h-3 w-3 text-white" />
              </button>
            </div>
          ))}
          {images.length < 10 && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-xl bg-muted/60 flex flex-col items-center justify-center gap-1.5 hover:bg-muted transition-colors active:scale-[0.97]"
            >
              <ImagePlus className="h-5 w-5 text-muted-foreground" />
              <span className="text-[11px] font-medium text-muted-foreground">
                Add
              </span>
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageAdd}
          className="hidden"
        />
      </FormGroup>

      <FormStickyAction>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-2xl text-[15px] font-semibold shadow-lg shadow-primary/15 transition-transform active:scale-[0.98]"
          style={{ height: "52px" }}
        >
          {isSubmitting ? (
            <>
              <div className="h-4 w-4 border-[2.5px] border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin mr-2" />
              Saving...
            </>
          ) : (
            "Save record"
          )}
        </Button>
      </FormStickyAction>
    </form>
  );
}
