"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { MemberForm } from "@/components/family/member-form";
import { useMembers } from "@/hooks/use-members";
import type { MemberFormData } from "@/lib/utils/validators";
import { toast } from "sonner";

export default function AddMemberPage() {
  const router = useRouter();
  const { addMember } = useMembers();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (data: MemberFormData) => {
    setLoading(true);
    try {
      await addMember(data);
      toast.success(`${data.name} added to your family!`);
      router.back();
    } catch {
      toast.error("Failed to add family member.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <AppHeader title="Add Family Member" showBack />
      <div className="p-4">
        <MemberForm onSubmit={handleSubmit} loading={loading} />
      </div>
    </div>
  );
}
