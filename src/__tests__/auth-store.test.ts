import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "@/stores/auth-store";

describe("Auth Store", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      hasCompletedOnboarding: false,
    });
  });

  it("starts with no user", () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it("sets user and marks as authenticated", () => {
    useAuthStore.getState().setUser({
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
    });

    const state = useAuthStore.getState();
    expect(state.user).not.toBeNull();
    expect(state.user?.email).toBe("test@example.com");
    expect(state.isAuthenticated).toBe(true);
  });

  it("clears user on logout", () => {
    useAuthStore.getState().setUser({
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
    });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    useAuthStore.getState().logout();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("tracks onboarding completion", () => {
    expect(useAuthStore.getState().hasCompletedOnboarding).toBe(false);

    useAuthStore.getState().setHasCompletedOnboarding(true);
    expect(useAuthStore.getState().hasCompletedOnboarding).toBe(true);
  });

  it("setUser(null) marks as unauthenticated", () => {
    useAuthStore.getState().setUser({
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
    });
    useAuthStore.getState().setUser(null);

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("preserves phone field", () => {
    useAuthStore.getState().setUser({
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
      phone: "9876543210",
    });

    expect(useAuthStore.getState().user?.phone).toBe("9876543210");
  });
});
