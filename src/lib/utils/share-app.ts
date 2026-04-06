"use client";

const APP_URL = "https://medi--log.vercel.app";
const SHARE_TEXT =
  "MediFamily — Free AI-powered health record manager for your family. Works offline! Try it:";

/**
 * Share MediFamily using Web Share API (native share sheet on mobile).
 * Falls back to clipboard copy on desktop.
 */
export async function shareMediFamily(): Promise<void> {
  const shareData = {
    title: "MediFamily — Family Health Record Manager",
    text: SHARE_TEXT,
    url: APP_URL,
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      return;
    }
  } catch (err) {
    // User cancelled share — not an error
    if (err instanceof Error && err.name === "AbortError") return;
  }

  // Fallback: copy link to clipboard
  try {
    await navigator.clipboard.writeText(`${SHARE_TEXT}\n${APP_URL}`);
    const { toast } = await import("sonner");
    toast.success("Link copied! Share it with friends & family.");
  } catch {
    // nothing
  }
}
