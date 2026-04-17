"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  Zap,
  Plus,
  Dumbbell,
  Play,
  ChevronRight,
  ListChecks,
  Trash2,
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import {
  useRoutines,
  useGymSessions,
  seedPresetsIfNeeded,
} from "@/hooks/use-gym";
import { toast } from "sonner";

export default function GymHomePage() {
  const router = useRouter();
  const { routines, isLoading: routinesLoading } = useRoutines();
  const { sessions, isLoading: sessionsLoading, startSession, deleteSession } =
    useGymSessions();

  useEffect(() => {
    // Idempotent — only runs if preset library is empty
    seedPresetsIfNeeded().catch(() => {});
  }, []);

  const handleQuickStart = async () => {
    try {
      const id = await startSession(undefined, "Quick session");
      router.push(`/wellness/gym/session/${id}`);
    } catch {
      toast.error("Failed to start session");
    }
  };

  const handleStartRoutine = async (routineId: string, name: string) => {
    try {
      const id = await startSession(routineId, name);
      router.push(`/wellness/gym/session/${id}`);
    } catch {
      toast.error("Failed to start session");
    }
  };

  const activeSession = sessions.find((s) => !s.ended_at);
  const pastSessions = sessions.filter((s) => s.ended_at).slice(0, 10);

  if (routinesLoading || sessionsLoading) {
    return (
      <div>
        <AppHeader title="Gym" showBack />
        <LoadingSpinner className="py-12" />
      </div>
    );
  }

  return (
    <div className="pb-24">
      <AppHeader title="Gym" showBack />

      <div className="p-4 space-y-5">
        {/* ═══════ ACTIVE SESSION (if any) ═══════ */}
        {activeSession && (
          <Link
            href={`/wellness/gym/session/${activeSession.id}`}
            className="block"
          >
            <div className="rounded-2xl bg-primary text-primary-foreground p-4 flex items-center gap-3 active:scale-[0.98] transition-transform shadow-lg shadow-primary/20">
              <div className="h-11 w-11 rounded-xl bg-primary-foreground/15 flex items-center justify-center">
                <Zap className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">
                  In progress
                </p>
                <p className="text-sm font-bold truncate">
                  {activeSession.routine_name || "Quick session"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 opacity-60" />
            </div>
          </Link>
        )}

        {/* ═══════ QUICK START ═══════ */}
        {!activeSession && (
          <button
            onClick={handleQuickStart}
            className="w-full rounded-2xl bg-primary text-primary-foreground p-4 flex items-center gap-3 active:scale-[0.98] transition-transform shadow-lg shadow-primary/20"
          >
            <div className="h-11 w-11 rounded-xl bg-primary-foreground/15 flex items-center justify-center">
              <Play className="h-5 w-5" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-bold">Start quick session</p>
              <p className="text-[11px] opacity-80">
                No routine — just log sets as you go
              </p>
            </div>
          </button>
        )}

        {/* ═══════ ROUTINES ═══════ */}
        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">
              Routines
            </h3>
            <Link
              href="/wellness/gym/routine/new"
              className="text-[11px] font-bold text-primary flex items-center gap-1 active:scale-95 transition-transform"
            >
              <Plus className="h-3.5 w-3.5" />
              New
            </Link>
          </div>

          {routines.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border/60 p-6 text-center">
              <div className="h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-3">
                <ListChecks className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-bold">No routines yet</p>
              <p className="text-[12px] text-muted-foreground mt-1 mb-4">
                Build a reusable list of exercises (e.g. Push Day, Leg Day)
              </p>
              <Link href="/wellness/gym/routine/new">
                <button className="h-10 px-5 rounded-full bg-primary text-primary-foreground text-[13px] font-bold flex items-center gap-2 mx-auto active:scale-95 transition-transform">
                  <Plus className="h-4 w-4" />
                  Create routine
                </button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {routines.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl bg-card border border-border/40 p-4 flex items-center gap-3"
                >
                  <div className="h-11 w-11 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Dumbbell className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{r.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {r.exercise_ids.length} exercise
                      {r.exercise_ids.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <button
                    onClick={() => handleStartRoutine(r.id, r.name)}
                    disabled={!!activeSession}
                    className="h-10 px-4 rounded-full bg-primary text-primary-foreground text-[12px] font-bold flex items-center gap-1 active:scale-95 transition-transform disabled:opacity-40"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Start
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ═══════ RECENT SESSIONS ═══════ */}
        {pastSessions.length > 0 && (
          <section>
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] mb-3 px-1">
              Recent sessions
            </h3>
            <div className="space-y-2">
              {pastSessions.map((s) => (
                <div
                  key={s.id}
                  className="rounded-2xl bg-card border border-border/40 p-4 flex items-center gap-3"
                >
                  <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
                    <Dumbbell className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold truncate">
                      {s.routine_name || "Quick session"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(s.date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}{" "}
                      · {s.duration_min ?? "—"} min
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      if (confirm("Delete this session?")) {
                        await deleteSession(s.id);
                        toast.success("Session deleted");
                      }
                    }}
                    className="h-8 w-8 rounded-full text-muted-foreground/40 hover:text-destructive flex items-center justify-center active:scale-90 transition-all"
                    aria-label="Delete session"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
