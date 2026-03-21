"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";
import { LoadingSpinner } from "@/components/common/loading-spinner";

export default function RootPage() {
  const router = useRouter();
  const { setUser, hasCompletedOnboarding, isAuthenticated } = useAuthStore();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || "",
          name: session.user.user_metadata?.name || "",
        });
        router.replace(hasCompletedOnboarding ? "/home" : "/onboarding");
      } else if (isAuthenticated && hasCompletedOnboarding) {
        // Offline but was logged in before
        router.replace("/home");
      } else {
        router.replace("/login");
      }
    });
  }, [router, setUser, hasCompletedOnboarding, isAuthenticated]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" text="Loading MediLog..." />
    </div>
  );
}
