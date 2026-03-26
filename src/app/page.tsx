"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";
import { db } from "@/lib/db/dexie";
import { LoadingSpinner } from "@/components/common/loading-spinner";

export default function RootPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const didRun = useRef(false);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  useEffect(() => {
    // Wait for Zustand to hydrate first
    if (!hasHydrated || didRun.current) return;
    didRun.current = true;

    const init = async () => {
      const { isAuthenticated, user: storedUser } = useAuthStore.getState();

      // Helper: check Dexie for self member to determine onboarding
      const checkOnboarded = async (userId: string): Promise<boolean> => {
        try {
          const selfMember = await db.members
            .where("user_id")
            .equals(userId)
            .filter((m) => m.relation === "self" && !m.is_deleted)
            .first();
          return !!selfMember;
        } catch {
          return false;
        }
      };

      // If already authenticated in Zustand, verify onboarding via Dexie
      if (isAuthenticated && storedUser) {
        const onboarded = await checkOnboarded(storedUser.id);
        if (onboarded) {
          useAuthStore.getState().setHasCompletedOnboarding(true);
          router.replace("/home");
        } else {
          router.replace("/onboarding");
        }
        return;
      }

      // Not in Zustand — check Supabase session
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user;

        if (user) {
          setUser({
            id: user.id,
            email: user.email || "",
            name: (user.user_metadata as Record<string, string>)?.name || "",
          });
          const onboarded = await checkOnboarded(user.id);
          if (onboarded) {
            useAuthStore.getState().setHasCompletedOnboarding(true);
            router.replace("/home");
          } else {
            router.replace("/onboarding");
          }
        } else {
          router.replace("/login");
        }
      } catch {
        router.replace("/login");
      }
    };

    init();
  }, [hasHydrated, router, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" text="Loading MediLog..." />
    </div>
  );
}
