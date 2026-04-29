"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, Copy, Share2, Trash2, Phone } from "lucide-react";
import { useMember } from "@/hooks/use-members";
import { useCareShares } from "@/hooks/use-care-shares";
import { copyToClipboard } from "@/lib/utils/clipboard";
import { cn } from "@/lib/utils";

/**
 * Caretaker creates a phone-OTP-gated share link for the resident's
 * family. Different from /family/[id]/share (the doctor share) — that
 * one is short-lived (hours) and has no auth. This one is long-lived,
 * tied to a specific phone number, and OTP-verified per access.
 */
export default function ResidentShareCreatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { member: resident } = useMember(id);
  const { shares, createShare, revokeShare } = useCareShares(id);

  const [phone, setPhone] = useState(resident?.emergency_contact_phone || "");
  const [creating, setCreating] = useState(false);

  const activeShares = shares.filter((s) => !s.revoked_at);
  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "";

  const handleCreate = async () => {
    const cleaned = phone.replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(cleaned)) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    setCreating(true);
    try {
      const share = await createShare({
        member_id: id,
        authorized_phone: cleaned,
      });
      const url = `${baseUrl}/care-share/${share.token}`;
      await copyToClipboard(url);
      toast.success("Link copied. WhatsApp it to the family member.");
    } catch (err) {
      console.error("createShare failed:", err);
      toast.error("Failed to create link");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (shareId: string) => {
    if (!confirm("Revoke this link? Family will lose access immediately.")) return;
    try {
      await revokeShare(shareId);
      toast.success("Link revoked");
    } catch {
      toast.error("Failed to revoke");
    }
  };

  return (
    <div className="min-h-[100vh] pb-24">
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-sm flex items-center justify-between px-4 py-3 border-b border-transparent">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="h-9 w-9 rounded-full bg-muted/60 flex items-center justify-center active:scale-95"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-[13px] font-bold">Share with family</p>
        <span className="h-9 w-9" aria-hidden="true" />
      </div>

      <div className="px-5 pt-3 space-y-5">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            {resident?.name} · Room {resident?.room_no || "—"}
          </p>
          <h1 className="text-[22px] font-bold tracking-tight leading-tight mt-1.5">
            Family-only read-only view
          </h1>
          <p className="text-[13px] text-muted-foreground leading-relaxed mt-1.5">
            They&apos;ll see active meds, today&apos;s doses, recent incidents.
            Each access is verified by OTP to the phone number you enter
            below. They can&apos;t edit anything.
          </p>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-muted-foreground font-mono mb-1.5">
              Authorize phone
            </p>
            <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card px-3 h-11">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="10-digit mobile"
                className="flex-1 bg-transparent text-[15px] font-medium focus:outline-none"
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              An OTP will be sent here whenever they open the link.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className={cn(
              "w-full h-12 rounded-xl bg-foreground text-background inline-flex items-center justify-center gap-2 text-[14px] font-extrabold active:scale-[0.98] transition-transform",
              creating && "opacity-60"
            )}
          >
            <Share2 className="h-4 w-4" />
            {creating ? "Creating..." : "Generate & copy link"}
          </button>
        </div>

        {activeShares.length > 0 && (
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground px-1 mb-2">
              Active links ({activeShares.length})
            </p>
            <div className="space-y-2">
              {activeShares.map((s) => {
                const url = `${baseUrl}/care-share/${s.token}`;
                return (
                  <div
                    key={s.id}
                    className="rounded-xl border border-border/50 bg-card px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-mono text-[13px] font-bold">
                        +91 {s.authorized_phone.slice(0, 5)} {s.authorized_phone.slice(5)}
                      </span>
                      <span className="text-[10.5px] text-muted-foreground ml-auto">
                        {s.last_accessed_at
                          ? `Last seen ${new Date(s.last_accessed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                          : "Never opened"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={async () => {
                          await copyToClipboard(url);
                          toast.success("Link copied");
                        }}
                        className="flex-1 h-9 rounded-lg bg-muted/60 inline-flex items-center justify-center gap-1.5 text-[12px] font-bold active:scale-[0.98]"
                      >
                        <Copy className="h-3 w-3" />
                        Copy link
                      </button>
                      <button
                        onClick={() => handleRevoke(s.id)}
                        className="h-9 px-3 rounded-lg bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 inline-flex items-center gap-1.5 text-[12px] font-bold active:scale-[0.98]"
                      >
                        <Trash2 className="h-3 w-3" />
                        Revoke
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
