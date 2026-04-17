"use client";

import { useEffect, useState } from "react";
import type { TourStep } from "@/components/tour/app-tour";

const PENDING_KEY = "medifamily_tour_pending";
const COMPLETED_KEY = "medifamily_tour_completed";

/** Steps cover the core navigation + the Scan FAB + wellness tab.
 *  Keep this short — long tours get skipped. 6 steps is the sweet spot. */
export const APP_TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to MediFamily",
    body: "Your whole family's health records — offline, private, and AI-powered. Let's take a 30-second tour.",
    placement: "auto",
  },
  {
    selector: '[data-tour="nav-home"]',
    title: "Home",
    body: "Your daily dashboard. Latest records, reminders, and shortcuts in one place.",
    placement: "top",
  },
  {
    selector: '[data-tour="nav-family"]',
    title: "Family",
    body: "Every family member lives here. Tap anyone to see their records, vitals, and reminders.",
    placement: "top",
  },
  {
    selector: '[data-tour="nav-scan"]',
    title: "Scan a prescription",
    body: "Point your camera at any prescription. AI extracts medicines, dosage, and timing in seconds.",
    placement: "top",
  },
  {
    selector: '[data-tour="nav-wellness"]',
    title: "Wellness",
    body: "Track water, weight, mood, and workouts daily. Turn on Gym Mode in Settings to log sets.",
    placement: "top",
  },
  {
    selector: '[data-tour="nav-more"]',
    title: "Settings & more",
    body: "Language, export, PIN lock, feedback. Replay this tour anytime from here.",
    placement: "top",
  },
];

export function useAppTour() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const pending = localStorage.getItem(PENDING_KEY) === "true";
    const completed = localStorage.getItem(COMPLETED_KEY) === "true";
    if (pending && !completed) {
      // Small delay so the page has rendered its nav
      const timer = setTimeout(() => setOpen(true), 400);
      return () => clearTimeout(timer);
    }
  }, []);

  const complete = () => {
    localStorage.setItem(COMPLETED_KEY, "true");
    localStorage.removeItem(PENDING_KEY);
    setOpen(false);
  };

  const skip = () => {
    localStorage.setItem(COMPLETED_KEY, "true");
    localStorage.removeItem(PENDING_KEY);
    setOpen(false);
  };

  return { open, complete, skip };
}

/** Called by onboarding when the user finishes the wizard, so the tour
 *  kicks in the first time they land on /home. */
export function queueAppTour() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(COMPLETED_KEY) === "true") return;
  localStorage.setItem(PENDING_KEY, "true");
}

/** User explicitly re-plays the tour from Settings. */
export function replayAppTour() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(COMPLETED_KEY);
  localStorage.setItem(PENDING_KEY, "true");
}
