"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth-store";
import { useMembers } from "@/hooks/use-members";
import { MemberForm } from "@/components/family/member-form";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import type { MemberFormData } from "@/lib/utils/validators";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { syncAll } from "@/lib/db/sync";
import { db } from "@/lib/db/dexie";
import { queueAppTour } from "@/hooks/use-app-tour";
import { Shield, Award, Sparkles } from "lucide-react";


// ---------------------------------------------------------------------------
// Badge unlocked animation
// ---------------------------------------------------------------------------
function BadgeUnlocked({ name, onDone }: { name: string; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-in fade-in duration-200">
      <div className="bg-background rounded-2xl p-6 shadow-2xl text-center space-y-3 animate-in zoom-in-95 duration-300 max-w-[280px]">
        <div className="h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center mx-auto">
          <Award className="h-8 w-8 text-amber-500" />
        </div>
        <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Badge Unlocked!</p>
        <p className="text-lg font-bold">{name}</p>
        <Sparkles className="h-5 w-5 text-amber-400 mx-auto" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Health Profile (MANDATORY)
// ---------------------------------------------------------------------------
function StepProfile({
  onSubmit,
}: {
  onSubmit: (data: MemberFormData) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">
          Set up your health profile
        </h1>
        <p className="text-sm text-muted-foreground">
          Takes 30 seconds. You can add family, scan prescriptions, and set
          reminders right after.
        </p>
      </div>

      <MemberForm
        onSubmit={onSubmit}
        submitLabel="Continue"
        defaultRelation="self"
        hideRelation
      />
    </div>
  );
}


// ===========================================================================
// Main Onboarding Page
// ===========================================================================
export default function OnboardingPage() {
  const { user, setUser, setHasCompletedOnboarding } = useAuthStore();
  const hasCompletedOnboarding = useAuthStore((s) => s.hasCompletedOnboarding);
  const { addMember, members } = useMembers();
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  // Single-step onboarding: just create the self profile, then drop the
  // user on /home where soft CTAs prompt them to add family / scan / set
  // reminders when they're ready. The 4-step wizard with mandatory badge
  // popups felt like an obstacle — most users abandoned at step 3 (scan)
  // because they didn't have a prescription handy at that exact moment.
  const [showBadge, setShowBadge] = useState<string | null>(null);
  const wizardActiveRef = useRef(false);

  // ---- Session check + existing-member detection ----
  useEffect(() => {
    let cancelled = false;

    const verifyAndRoute = async () => {
      // Fast path: local flag says onboarded — but only if the wizard
      // hasn't started yet. Once the user is in Step 1+ we let them finish.
      if (hasCompletedOnboarding && user && !wizardActiveRef.current) {
        window.location.replace("/home");
        return;
      }

      // Need a session before we can do anything
      let sessionUser = user;
      if (!sessionUser) {
        const supabase = createClient();
        try {
          const { data } = await supabase.auth.getSession();
          const su = data.session?.user;
          if (!su) {
            window.location.replace("/login");
            return;
          }
          sessionUser = {
            id: su.id,
            email: su.email || "",
            name: (su.user_metadata as Record<string, string>)?.name || "",
          };
          if (!cancelled) setUser(sessionUser);
        } catch {
          window.location.replace("/login");
          return;
        }
      }

      // Check Dexie locally first (fast, works offline)
      try {
        const { db } = await import("@/lib/db/dexie");
        const localMembers = await db.members
          .where("user_id")
          .equals(sessionUser.id)
          .toArray();
        const localSelf = localMembers.find(
          (m) => m.relation === "self" && !m.is_deleted
        );
        if (localSelf && !cancelled) {
          setHasCompletedOnboarding(true);
          window.location.replace("/home");
          return;
        }
      } catch {
        // ignore — fall through to server check
      }

      // Check server (for new device / fresh install)
      // Use auth token header — cookies may not be set on a new device
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const { data: { session } } = await createClient().auth.getSession();
        const headers: Record<string, string> = {};
        if (session?.access_token) {
          headers["Authorization"] = `Bearer ${session.access_token}`;
        }
        const res = await fetch("/api/check-onboarding", { headers });
        if (res.ok) {
          const { onboarded } = await res.json();
          if (onboarded && !cancelled) {
            // Trigger a sync so existing data comes down to this device
            try {
              const { syncAll } = await import("@/lib/db/sync");
              await syncAll();
            } catch { /* sync failure is non-fatal */ }
            setHasCompletedOnboarding(true);
            window.location.replace("/home");
            return;
          }
        }
      } catch {
        // ignore — show onboarding
      }

      if (!cancelled) setReady(true);
    };

    verifyAndRoute();
    return () => {
      cancelled = true;
    };
  }, [user, hasCompletedOnboarding, setUser, setHasCompletedOnboarding]);

  // ---- Single step: create self profile, then go home ----
  const handleProfileSubmit = async (data: MemberFormData) => {
    setLoading(true);
    wizardActiveRef.current = true;
    try {
      // Guard against duplicates from Google OAuth re-triggering onboarding.
      const existingSelf = members?.find((m) => m.relation === "self");
      if (!existingSelf) {
        const localMembers = await db.members
          .where("user_id")
          .equals(user!.id)
          .filter((m) => m.relation === "self" && !m.is_deleted)
          .toArray();
        if (localMembers.length > 0) {
          setShowBadge("Profile Created");
          return;
        }
      }
      if (existingSelf) {
        setShowBadge("Profile Created");
        return;
      }

      await addMember({ ...data, relation: "self" });
      // Fire-and-forget sync — don't block on network
      syncAll().catch((err) =>
        console.warn("Sync after profile create failed (will retry):", err)
      );

      setShowBadge("Profile Created");
    } catch (err) {
      console.error("Onboarding error:", err);
      toast.error(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const goHome = () => {
    setHasCompletedOnboarding(true);
    queueAppTour();
    window.location.replace("/home");
  };

  const handleBadgeDone = () => {
    setShowBadge(null);
    goHome();
  };

  // ---- Loading state ----
  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner text="Setting up..." />
      </div>
    );
  }

  return (
    <>
      {/* Badge animation overlay */}
      {showBadge && <BadgeUnlocked name={showBadge} onDone={handleBadgeDone} />}

      <Card className="overflow-hidden">
        <CardContent className="p-6">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <Image
              src="/logo.png"
              alt="MediFamily"
              width={160}
              height={48}
              className="object-contain"
              priority
            />
          </div>

          <StepProfile onSubmit={handleProfileSubmit} />
        </CardContent>
      </Card>
    </>
  );
}
