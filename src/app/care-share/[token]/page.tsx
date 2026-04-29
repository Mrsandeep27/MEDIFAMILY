"use client";

import { use, useState } from "react";
import { Phone, ShieldCheck, Pill, AlertCircle, Heart } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ResidentView {
  resident: {
    id: string;
    name: string;
    room_no?: string;
    date_of_birth?: string;
    blood_group?: string;
    chronic_conditions?: string[];
    allergies?: string[];
    admission_date?: string;
  };
  medicines: Array<{
    id: string;
    name: string;
    dosage?: string;
    frequency?: string;
    before_food?: boolean;
  }>;
  logs: Array<{
    id: string;
    medicine_name: string;
    scheduled_at: string;
    status: string;
    acted_at?: string | null;
    created_at: string;
  }>;
  incidents: Array<{
    id: string;
    type: string;
    occurred_at: string;
    notes: string;
    action_taken: string;
  }>;
}

/**
 * Family-side care-home share view. Public route: /care-share/[token].
 * Two stages:
 *   1. Phone + OTP entry — server sends OTP via /api/care-share/[token]/otp,
 *      verifies via /api/care-share/[token]/verify
 *   2. Read-only resident view (active meds, last 30 days dose log,
 *      recent incidents)
 *
 * Family member needs nothing but the link + their phone. No app
 * install, no signup. Read-only — no editing surfaces are rendered at
 * all (defence in depth: no PATCH endpoints exist for this token either).
 */
export default function CareSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);

  const [stage, setStage] = useState<"phone" | "otp" | "view">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ResidentView | null>(null);

  const handleSendOtp = async () => {
    const cleaned = phone.replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(cleaned)) {
      toast.error("Enter a valid 10-digit mobile");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/care-share/${token}/otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleaned }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error || "Failed to send OTP");
        return;
      }
      toast.success("OTP sent — check your SMS");
      setStage("otp");
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    const cleaned = phone.replace(/\D/g, "");
    if (!/^\d{6}$/.test(otp)) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/care-share/${token}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleaned, otp }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error || "Wrong code");
        return;
      }
      setData(body);
      setStage("view");
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  };

  if (stage === "view" && data) {
    return <ResidentReadOnly data={data} />;
  }

  return (
    <div className="min-h-[100vh] flex flex-col items-center justify-center px-5 py-10 bg-muted/30">
      <div className="max-w-sm w-full bg-card rounded-2xl border border-border/50 p-6 space-y-5 shadow-sm">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="h-7 w-7 text-primary" />
          </div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Care Home Share
          </p>
          <h1 className="text-[20px] font-bold tracking-tight">
            {stage === "phone" ? "Verify your phone" : "Enter the code"}
          </h1>
          <p className="text-[12.5px] text-muted-foreground leading-relaxed">
            {stage === "phone"
              ? "Enter the phone number registered with the care home. We'll send a one-time code."
              : `We sent a 6-digit code to +91 ${phone.slice(0, 5)} ${phone.slice(5)}.`}
          </p>
        </div>

        {stage === "phone" ? (
          <>
            <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card px-3 h-12">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="10-digit mobile"
                autoFocus
                className="flex-1 bg-transparent text-[15px] font-medium focus:outline-none"
              />
            </div>
            <button
              onClick={handleSendOtp}
              disabled={loading}
              className={cn(
                "w-full h-12 rounded-xl bg-foreground text-background text-[14px] font-extrabold active:scale-[0.98] transition-transform",
                loading && "opacity-60"
              )}
            >
              {loading ? "Sending..." : "Send code"}
            </button>
          </>
        ) : (
          <>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              autoFocus
              className="w-full h-14 rounded-xl border border-border/50 bg-card px-4 text-center text-[24px] font-extrabold tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              onClick={handleVerify}
              disabled={loading}
              className={cn(
                "w-full h-12 rounded-xl bg-foreground text-background text-[14px] font-extrabold active:scale-[0.98] transition-transform",
                loading && "opacity-60"
              )}
            >
              {loading ? "Verifying..." : "Verify & view"}
            </button>
            <button
              onClick={() => {
                setOtp("");
                setStage("phone");
              }}
              className="w-full text-[12px] text-muted-foreground"
            >
              Wrong number? Go back
            </button>
          </>
        )}

        <p className="text-[10.5px] text-muted-foreground text-center leading-relaxed">
          This link is read-only. You cannot edit records — only the care
          home staff can.
        </p>
      </div>
    </div>
  );
}

// ─── Read-only resident view (post-OTP) ──────────────────────────────────

function ResidentReadOnly({ data }: { data: ResidentView }) {
  const { resident, medicines, logs, incidents } = data;

  const today = new Date().toISOString().slice(0, 10);
  const todayLogs = logs.filter((l) => l.created_at.startsWith(today));

  return (
    <div className="min-h-[100vh] pb-12 bg-muted/30">
      <div className="bg-foreground text-background px-5 pt-7 pb-6">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-background/60">
          Room {resident.room_no || "—"}
        </p>
        <h1 className="text-[26px] font-extrabold tracking-tight mt-1.5">
          {resident.name}
        </h1>
        <p className="text-[12px] text-background/70 mt-1">
          Family read-only view
        </p>
      </div>

      <div className="max-w-md mx-auto px-4 pt-4 space-y-5">
        {/* Today's doses */}
        <Section title={`Today's doses · ${todayLogs.length}`}>
          {todayLogs.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground py-2">
              No doses logged today yet.
            </p>
          ) : (
            <div className="space-y-1.5">
              {todayLogs.slice(0, 12).map((l) => (
                <div key={l.id} className="flex items-center gap-2 text-[13px]">
                  <span
                    className={
                      l.status === "taken"
                        ? "h-2 w-2 rounded-full bg-green-600"
                        : l.status === "missed"
                          ? "h-2 w-2 rounded-full bg-red-500"
                          : "h-2 w-2 rounded-full bg-amber-500"
                    }
                  />
                  <span className="font-semibold flex-1 truncate">
                    {l.medicine_name}
                  </span>
                  <span className="text-muted-foreground capitalize text-[11.5px]">
                    {l.status}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {new Date(l.acted_at || l.created_at).toLocaleTimeString(
                      "en-IN",
                      { hour: "numeric", minute: "2-digit", hour12: true }
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Active meds */}
        <Section title={`Current medicines · ${medicines.length}`}>
          {medicines.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground py-2">
              No active medicines.
            </p>
          ) : (
            <div className="space-y-2">
              {medicines.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-xl bg-card border border-border/40 px-3 py-2.5"
                >
                  <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Pill className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold truncate">{m.name}</p>
                    <p className="text-[11.5px] text-muted-foreground truncate">
                      {[m.dosage, m.frequency, m.before_food && "Before food"]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Conditions */}
        {(resident.chronic_conditions || []).length > 0 && (
          <Section title="Conditions">
            <div className="flex flex-wrap gap-1.5">
              {resident.chronic_conditions!.map((c) => (
                <span
                  key={c}
                  className="text-[11.5px] font-bold rounded-md bg-card border border-border/40 px-2 py-1"
                >
                  {c}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Recent incidents (last 30 days) */}
        <Section title={`Recent incidents · ${incidents.length}`}>
          {incidents.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground py-2">
              No incidents reported in the last 30 days.
            </p>
          ) : (
            <div className="space-y-2">
              {incidents.map((inc) => (
                <div
                  key={inc.id}
                  className="rounded-xl border border-border/40 bg-card px-3 py-2.5"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                    <span className="text-[10px] font-extrabold uppercase tracking-wider rounded-md bg-muted/60 px-1.5 py-0.5">
                      {inc.type}
                    </span>
                    <span className="text-[11px] text-muted-foreground ml-auto">
                      {new Date(inc.occurred_at).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </span>
                  </div>
                  <p className="text-[13px] leading-relaxed">{inc.notes}</p>
                  {inc.action_taken && (
                    <p className="text-[12px] text-muted-foreground mt-1">
                      <b className="text-foreground/80">Action:</b>{" "}
                      {inc.action_taken}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        <div className="flex items-center justify-center gap-1.5 text-[10.5px] text-muted-foreground pt-4 pb-2">
          <Heart className="h-3 w-3" />
          MediFamily Care Home
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground px-1 mb-2">
        {title}
      </p>
      {children}
    </div>
  );
}
