import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Session, User } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
  setSession: (session: Session | null) => void;
  setHasCompletedOnboarding: (value: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      isAuthenticated: false,
      hasCompletedOnboarding: false,
      setSession: (session) =>
        set({
          session,
          user: session?.user ?? null,
          isAuthenticated: !!session,
        }),
      setHasCompletedOnboarding: (value) =>
        set({ hasCompletedOnboarding: value }),
      logout: () =>
        set({
          user: null,
          session: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: "medilog-auth",
      partialize: (state) => ({
        hasCompletedOnboarding: state.hasCompletedOnboarding,
      }),
    }
  )
);
