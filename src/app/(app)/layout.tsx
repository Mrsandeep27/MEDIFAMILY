"use client";

import { useEffect, useRef, Component, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { BottomNav } from "@/components/layout/bottom-nav";
import { OfflineIndicator } from "@/components/layout/offline-indicator";
import { PinLockScreen } from "@/components/layout/pin-lock-screen";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { useAuthStore } from "@/stores/auth-store";
import { db } from "@/lib/db/dexie";

// Error boundary to gracefully catch page crashes
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
          <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <span className="text-2xl">!</span>
          </div>
          <h2 className="text-lg font-bold mb-2">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.href = "/home";
            }}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
          >
            Go to Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  useAuth();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasCompletedOnboarding = useAuthStore((s) => s.hasCompletedOnboarding);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const checkedDexie = useRef(false);

  // If authenticated but hasCompletedOnboarding is false, check Dexie directly
  // This handles the case where logout() reset the flag but the member still exists
  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || hasCompletedOnboarding || checkedDexie.current) return;
    checkedDexie.current = true;

    const userId = useAuthStore.getState().user?.id;
    if (!userId) {
      router.replace("/login");
      return;
    }

    db.members
      .where("user_id")
      .equals(userId)
      .filter((m) => m.relation === "self" && !m.is_deleted)
      .first()
      .then((selfMember) => {
        if (selfMember) {
          useAuthStore.getState().setHasCompletedOnboarding(true);
        } else {
          router.replace("/onboarding");
        }
      })
      .catch(() => {
        router.replace("/onboarding");
      });
  }, [hasHydrated, isAuthenticated, hasCompletedOnboarding, router]);

  useEffect(() => {
    if (!hasHydrated) return;

    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, hasHydrated, router]);

  // Block rendering until hydrated AND authenticated AND onboarded
  if (!hasHydrated || !isAuthenticated || !hasCompletedOnboarding) {
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
      <ErrorBoundary>
        <main className="pb-20">{children}</main>
      </ErrorBoundary>
      <BottomNav />
    </div>
  );
}
