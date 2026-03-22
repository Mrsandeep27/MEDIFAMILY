"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { BottomNav } from "@/components/layout/bottom-nav";
import { OfflineIndicator } from "@/components/layout/offline-indicator";
import { PinLockScreen } from "@/components/layout/pin-lock-screen";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { useAuthStore } from "@/stores/auth-store";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  useAuth();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasCompletedOnboarding = useAuthStore((s) => s.hasCompletedOnboarding);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  useEffect(() => {
    // Wait for Zustand to hydrate from localStorage before making redirect decisions
    if (!hasHydrated) return;

    if (!isAuthenticated) {
      router.replace("/login");
    } else if (!hasCompletedOnboarding) {
      router.replace("/onboarding");
    }
  }, [isAuthenticated, hasCompletedOnboarding, hasHydrated, router]);

  // Show loading while hydrating or if not authenticated
  if (!hasHydrated || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <OfflineIndicator />
      <PinLockScreen />
      <main className="pb-20">{children}</main>
      <BottomNav />
    </div>
  );
}
