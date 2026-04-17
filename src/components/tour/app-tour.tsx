"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Spotlight app tour.
 *
 * Renders a dark blurred backdrop with a clipped-out rectangle around the
 * target element. A tooltip card sits above or below the spotlight with a
 * title, body, and Next/Skip/Done controls. Auto-measures the target on
 * mount and re-measures on scroll/resize.
 */

export interface TourStep {
  /** CSS selector for the element to highlight. Falls back to full-screen
   *  card if no match (for intro/outro steps). */
  selector?: string;
  title: string;
  body: string;
  /** Preferred tooltip placement. Tour may flip if not enough space. */
  placement?: "top" | "bottom" | "auto";
}

interface AppTourProps {
  steps: TourStep[];
  onComplete: () => void;
  onSkip: () => void;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8; // space around highlighted element

export function AppTour({ steps, onComplete, onSkip }: AppTourProps) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<SpotlightRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = steps[index];
  const isLast = index === steps.length - 1;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Measure target element for current step
  useLayoutEffect(() => {
    if (!step) return;

    const measure = () => {
      if (!step.selector) {
        setRect(null);
        return;
      }
      const el = document.querySelector(step.selector);
      if (!el) {
        setRect(null);
        return;
      }
      // Scroll element into view if off-screen
      const viewport = el.getBoundingClientRect();
      if (viewport.top < 0 || viewport.bottom > window.innerHeight) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // Wait a tick for scroll, then re-measure
        setTimeout(measure, 300);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({
        top: r.top - PADDING,
        left: r.left - PADDING,
        width: r.width + PADDING * 2,
        height: r.height + PADDING * 2,
      });
    };

    measure();
    const handler = () => measure();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [step]);

  if (!mounted || !step) return null;

  const next = () => {
    if (isLast) {
      onComplete();
    } else {
      setIndex((i) => i + 1);
    }
  };

  const prev = () => {
    if (index > 0) setIndex((i) => i - 1);
  };

  // Compute tooltip position
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 800;
  const tooltipPlacement = (() => {
    if (!rect) return "center";
    const spaceBelow = viewportH - (rect.top + rect.height);
    const spaceAbove = rect.top;
    const preferred = step.placement ?? "auto";
    if (preferred === "top") return spaceAbove > 180 ? "top" : "bottom";
    if (preferred === "bottom") return spaceBelow > 180 ? "bottom" : "top";
    return spaceBelow > spaceAbove ? "bottom" : "top";
  })();

  const overlay = (
    <div
      className="fixed inset-0 z-[100]"
      style={{ pointerEvents: "auto" }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Dim the area OUTSIDE the spotlight using 4 rectangles around the
       *  cut-out. The cut-out region itself is completely untouched — no dim,
       *  no blur — so the highlighted element renders crisp and clickable
       *  through the transparent gap. */}
      {rect ? (
        <>
          {/* top */}
          <div
            className="absolute left-0 right-0 bg-black/75 animate-in fade-in duration-300"
            style={{ top: 0, height: Math.max(0, rect.top) }}
          />
          {/* bottom */}
          <div
            className="absolute left-0 right-0 bg-black/75 animate-in fade-in duration-300"
            style={{
              top: rect.top + rect.height,
              bottom: 0,
            }}
          />
          {/* left */}
          <div
            className="absolute bg-black/75 animate-in fade-in duration-300"
            style={{
              top: rect.top,
              left: 0,
              width: Math.max(0, rect.left),
              height: rect.height,
            }}
          />
          {/* right */}
          <div
            className="absolute bg-black/75 animate-in fade-in duration-300"
            style={{
              top: rect.top,
              left: rect.left + rect.width,
              right: 0,
              height: rect.height,
            }}
          />
        </>
      ) : (
        /* No target — full-screen dim for intro/outro steps */
        <div className="absolute inset-0 bg-black/75 animate-in fade-in duration-300" />
      )}

      {/* Spotlight ring around the cut-out */}
      {rect && (
        <div
          className="absolute pointer-events-none rounded-[14px] ring-2 ring-primary animate-in fade-in duration-300"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            boxShadow:
              "0 0 0 4px rgba(255,255,255,0.08), 0 0 24px 4px rgba(59, 130, 246, 0.35)",
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute max-w-[340px] w-[calc(100%-2rem)] animate-in fade-in zoom-in-95 duration-300"
        style={
          tooltipPlacement === "center"
            ? {
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
              }
            : tooltipPlacement === "bottom" && rect
            ? {
                left: "50%",
                top: rect.top + rect.height + 16,
                transform: "translateX(-50%)",
              }
            : rect
            ? {
                left: "50%",
                top: rect.top - 16,
                transform: "translate(-50%, -100%)",
              }
            : {
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
              }
        }
      >
        <div className="rounded-2xl bg-background border border-border/40 shadow-2xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-primary uppercase tracking-widest mb-1">
                Step {index + 1} of {steps.length}
              </p>
              <h3 className="text-base font-extrabold tracking-tight">
                {step.title}
              </h3>
            </div>
            <button
              type="button"
              onClick={onSkip}
              className="h-8 w-8 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center active:scale-90 transition-all shrink-0"
              aria-label="Skip tour"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="text-[14px] leading-relaxed text-muted-foreground">
            {step.body}
          </p>

          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index
                    ? "w-6 bg-primary"
                    : i < index
                    ? "w-1.5 bg-primary/40"
                    : "w-1.5 bg-muted"
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={prev}
                className="h-11 px-4 rounded-xl bg-muted/60 hover:bg-muted text-[13px] font-semibold active:scale-95 transition-all"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={onSkip}
              className="h-11 px-4 rounded-xl text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={next}
              className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-[14px] font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-primary/20 active:scale-[0.97] transition-all"
            >
              {isLast ? (
                <>
                  Done <Check className="h-4 w-4" />
                </>
              ) : (
                <>
                  Next <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
