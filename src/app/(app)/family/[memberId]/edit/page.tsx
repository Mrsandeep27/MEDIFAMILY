"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { MemberForm } from "@/components/family/member-form";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { useMember, useMembers } from "@/hooks/use-members";
import type { MemberFormData } from "@/lib/utils/validators";
import { toast } from "sonner";

export default function EditMemberPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = use(params);
  const router = useRouter();
  const { member, isLoading } = useMember(memberId);
  const { updateMember } = useMembers();
  const [saving, setSaving] = useState(false);

  if (isLoading) {
    return (
      <div>
        <AppHeader title="Loading..." showBack />
        <LoadingSpinner className="py-12" />
      </div>
    );
  }

  if (!member) {
    return (
      <div>
        <AppHeader title="Not Found" showBack />
        <p className="text-center text-muted-foreground py-12">
          Member not found.
        </p>
      </div>
    );
  }

  const handleSubmit = async (data: MemberFormData) => {
    setSaving(true);
    try {
      await updateMember(memberId, data);
      toast.success("Profile updated!");
      router.back();
    } catch {
      toast.error("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <AppHeader title={`Edit ${member.name}`} showBack />
      <div className="p-4">
        <MemberForm
          onSubmit={handleSubmit}
          loading={saving}
          submitLabel="Update"
          defaultValues={{
            name: member.name,
            relation: member.relation,
            date_of_birth: member.date_of_birth,
            blood_group: member.blood_group,
            gender: member.gender,
            allergies: member.allergies,
            chronic_conditions: member.chronic_conditions,
            emergency_contact_name: member.emergency_contact_name,
            emergency_contact_phone: member.emergency_contact_phone,
          }}
        />
      </div>
    </div>
  );
}
