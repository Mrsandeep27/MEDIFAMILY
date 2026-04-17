"use client";

import { forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Shared form primitives — consistent spacing, typography, and
 * input styling across every form in the app.
 *
 * Design language:
 *  - Flat groups with small uppercase section labels
 *  - 48px soft-filled rounded inputs (no hard borders)
 *  - 13px field labels, 15px input text
 *  - 8px-grid spacing
 *  - Primary-tinted focus ring
 */

export function FormGroup({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-6", className)}>
      {title && (
        <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] mb-3 px-1">
          {title}
        </h3>
      )}
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function FormField({
  label,
  error,
  children,
  optional,
  hint,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  optional?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center justify-between text-[13px] font-medium text-foreground/80 px-1">
        <span>{label}</span>
        {optional && (
          <span className="text-[11px] font-normal text-muted-foreground/70">
            Optional
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p className="text-[12px] text-muted-foreground px-1 pt-0.5">{hint}</p>
      )}
      {error && (
        <p className="text-[12px] text-destructive px-1 pt-0.5">{error}</p>
      )}
    </div>
  );
}

export const formInputClasses =
  "h-12 rounded-xl bg-muted/60 border-0 px-4 text-[15px] shadow-none placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:bg-muted/80 transition-colors";

export const formSelectTriggerClasses =
  "h-12 rounded-xl bg-muted/60 border-0 px-4 text-[15px] shadow-none focus:ring-2 focus:ring-primary/20";

export const FormInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function FormInput(props, ref) {
  return (
    <Input
      ref={ref}
      {...props}
      className={cn(formInputClasses, props.className)}
    />
  );
});

export const FormTextarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function FormTextarea(props, ref) {
  return (
    <textarea
      ref={ref}
      {...props}
      className={cn(
        "w-full rounded-xl bg-muted/60 border-0 px-4 py-3 text-[15px] shadow-none placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:bg-muted/80 transition-colors resize-none",
        props.className
      )}
    />
  );
});

/**
 * Segmented pill selector — for 2–4 mutually-exclusive options.
 */
export function FormPillGroup<T extends string>({
  value,
  onChange,
  options,
  columns,
}: {
  value: T | "" | undefined;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  columns?: number;
}) {
  const cols = columns ?? options.length;
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "h-12 rounded-xl text-[14px] font-medium transition-all duration-150 active:scale-[0.97]",
              selected
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/60 text-foreground hover:bg-muted"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Sticky bottom submit bar — gradient fade, rounded full-width button.
 * Respects the bottom nav (56px) so it floats above it.
 */
export function FormStickyAction({
  children,
  bottomOffsetPx = 64,
}: {
  children: React.ReactNode;
  bottomOffsetPx?: number;
}) {
  return (
    <div
      className="fixed left-0 right-0 px-4 pb-3 pt-4 bg-gradient-to-t from-background via-background to-background/0 z-40 pointer-events-none"
      style={{ bottom: `${bottomOffsetPx}px` }}
    >
      <div className="pointer-events-auto">{children}</div>
    </div>
  );
}
