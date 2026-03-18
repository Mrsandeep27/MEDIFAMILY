"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth-store";
import { useMembers } from "@/hooks/use-members";
import { MemberForm } from "@/components/family/member-form";
import type { MemberFormData } from "@/lib/utils/validators";
import { toast } from "sonner";

export default function OnboardingPage() {
  const router = useRouter();
  const { setHasCompletedOnboarding } = useAuthStore();
  const { addMember } = useMembers();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (data: MemberFormData) => {
    setLoading(true);
    try {
      await addMember({ ...data, relation: "self" });
      setHasCompletedOnboarding(true);
      toast.success("Welcome to MediLog!");
      router.replace("/home");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="text-center space-y-2">
        <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Heart className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-xl font-bold">Welcome to MediLog</h1>
        <p className="text-sm text-muted-foreground">
          Let&apos;s set up your profile to get started
        </p>
      </CardHeader>
      <CardContent>
        <MemberForm
          onSubmit={handleSubmit}
          loading={loading}
          submitLabel="Get Started"
          defaultRelation="self"
          hideRelation
        />
      </CardContent>
    </Card>
  );
}
