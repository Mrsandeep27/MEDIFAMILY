"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth-store";
import { useMembers } from "@/hooks/use-members";
import { MemberForm } from "@/components/family/member-form";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import type { MemberFormData } from "@/lib/utils/validators";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, setUser, setHasCompletedOnboarding } = useAuthStore();
  const { addMember } = useMembers();
  const [loading, setLoading] = useState(false);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const [authReady, setAuthReady] = useState(false);

  // Wait for Zustand hydration, then check Supabase session if needed
  useEffect(() => {
    if (!hasHydrated) return;

    if (user) {
      setAuthReady(true);
      return;
    }

    // No user in Zustand — check Supabase (user just verified email)
    const init = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        const sessionUser = data.session?.user;
        if (sessionUser) {
          setUser({
            id: sessionUser.id,
            email: sessionUser.email || "",
            name: (sessionUser.user_metadata as Record<string, string>)?.name || "",
          });
        } else {
          router.replace("/login");
          return;
        }
      } catch {
        router.replace("/login");
        return;
      }
      setAuthReady(true);
    };
    init();
  }, [hasHydrated, user, setUser, router]);

  const handleSubmit = async (data: MemberFormData) => {
    setLoading(true);
    try {
      await addMember({ ...data, relation: "self" });
      setHasCompletedOnboarding(true);
      toast.success("Welcome to MediLog!");
      router.replace("/home");
    } catch (err) {
      console.error("Onboarding error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!authReady) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner text="Setting up..." />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center space-y-2 pb-2">
        <div className="mx-auto">
          <Image
            src="/logo.png"
            alt="MediLog"
            width={240}
            height={72}
            className="mx-auto object-contain"
            style={{ marginTop: "-20px", marginBottom: "-20px" }}
            priority
          />
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
