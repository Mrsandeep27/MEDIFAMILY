"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  Edit3,
  Loader2,
  Shield,
  Brain,
  Inbox,
  ListChecks,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AppHeader } from "@/components/layout/app-header";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { createClient } from "@/lib/supabase/client";

interface Candidate {
  id: string;
  trigger_source: string;
  trigger_reason: string;
  conversation: string;
  patient_brief: string | null;
  ai_response: string | null;
  proposed_rule: string | null;
  proposed_category: string | null;
  proposed_severity: string | null;
  status: string;
  created_at: string;
}

interface ActiveRule {
  id: string;
  rule_text: string;
  category: string;
  severity: string;
  source: string;
  is_active: boolean;
  created_at: string;
}

interface Counts {
  pending: number;
  approved: number;
  rejected: number;
  active: number;
}

const sevColor: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  normal: "bg-blue-100 text-blue-800 border-blue-200",
  low: "bg-slate-100 text-slate-700 border-slate-200",
};

async function authedFetch(input: string, init?: RequestInit) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(init?.headers || {}),
    },
  });
}

export default function AdminRulesPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"pending" | "active">("pending");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [activeRules, setActiveRules] = useState<ActiveRule[]>([]);
  const [counts, setCounts] = useState<Counts>({ pending: 0, approved: 0, rejected: 0, active: 0 });
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedFetch("/api/admin/rules?status=pending");
      if (res.status === 403 || res.status === 503) {
        setForbidden(true);
        return;
      }
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (!res.ok) {
        toast.error("Failed to load candidates");
        return;
      }
      const data = await res.json();
      setCandidates(data.candidates || []);
      setCounts(data.counts || { pending: 0, approved: 0, rejected: 0, active: 0 });

      // Also fetch active rules in parallel
      const r2 = await authedFetch("/api/admin/rules?type=active");
      if (r2.ok) {
        const d2 = await r2.json();
        setActiveRules(d2.rules || []);
      }
    } catch (err) {
      console.error("Load failed:", err);
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (id: string, finalText?: string) => {
    const res = await authedFetch(`/api/admin/rules/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        action: finalText ? "edit" : "approve",
        final_rule: finalText,
      }),
    });
    if (res.ok) {
      toast.success("Rule activated");
      setEditingId(null);
      load();
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Approve failed");
    }
  };

  const reject = async (id: string) => {
    const res = await authedFetch(`/api/admin/rules/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "reject" }),
    });
    if (res.ok) {
      toast.success("Rejected");
      load();
    }
  };

  const deactivate = async (id: string) => {
    const res = await authedFetch(`/api/admin/rules/${id}?type=active`, {
      method: "PATCH",
      body: JSON.stringify({ action: "deactivate" }),
    });
    if (res.ok) {
      toast.success("Deactivated");
      load();
    }
  };

  if (forbidden) {
    return (
      <div>
        <AppHeader title="Admin: Rules" showBack />
        <div className="p-6 text-center space-y-3 max-w-md mx-auto pt-12">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-lg font-bold">Admin only</h2>
          <p className="text-sm text-muted-foreground">
            This page is restricted. Set <code className="bg-muted px-1 rounded text-xs">ADMIN_EMAILS</code> in <code className="bg-muted px-1 rounded text-xs">.env.local</code> and add your email.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <AppHeader title="Admin: Rules" showBack />
        <LoadingSpinner className="py-16" />
      </div>
    );
  }

  return (
    <div>
      <AppHeader title="Admin: Rules" showBack />

      <div className="p-4 space-y-4">
        {/* Counters */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-amber-700">{counts.pending}</div>
            <div className="text-[10px] text-amber-600">Pending</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-green-700">{counts.approved}</div>
            <div className="text-[10px] text-green-600">Approved</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-slate-700">{counts.rejected}</div>
            <div className="text-[10px] text-slate-600">Rejected</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-blue-700">{counts.active}</div>
            <div className="text-[10px] text-blue-600">Active</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <Button
            variant={tab === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("pending")}
          >
            <Inbox className="h-3.5 w-3.5 mr-1" />
            Pending Candidates
          </Button>
          <Button
            variant={tab === "active" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("active")}
          >
            <ListChecks className="h-3.5 w-3.5 mr-1" />
            Active Rules
          </Button>
        </div>

        {/* Content */}
        {tab === "pending" && (
          <div className="space-y-3">
            {candidates.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  No pending candidates. The AI Doctor is behaving well 🎉
                </CardContent>
              </Card>
            ) : (
              candidates.map((c) => {
                let conv: Array<{ role: string; text: string }> = [];
                try { conv = JSON.parse(c.conversation); } catch { /* ignore */ }
                const isEditing = editingId === c.id;

                return (
                  <Card key={c.id}>
                    <CardContent className="p-4 space-y-3">
                      {/* Trigger */}
                      <div className="flex items-start gap-2">
                        <Brain className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{c.trigger_source.replace(/_/g, " ")}</p>
                          <p className="text-sm">{c.trigger_reason}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(c.created_at).toLocaleString()}</p>
                        </div>
                      </div>

                      {/* Conversation */}
                      <div className="bg-muted/50 rounded-lg p-2.5 space-y-1.5 max-h-40 overflow-y-auto">
                        {conv.slice(-4).map((m, i) => (
                          <div key={i} className="text-xs">
                            <span className="font-semibold">{m.role === "user" ? "👤" : "🤖"}</span>{" "}
                            <span className="text-muted-foreground">{m.text.slice(0, 200)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Patient brief snippet */}
                      {c.patient_brief && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground">Patient brief</summary>
                          <pre className="whitespace-pre-wrap bg-muted/30 p-2 rounded mt-1 text-[10px] max-h-32 overflow-y-auto">{c.patient_brief.slice(0, 600)}</pre>
                        </details>
                      )}

                      {/* Proposed rule */}
                      <div className="border-l-2 border-primary pl-3 space-y-2">
                        <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">Proposed rule</p>
                        {isEditing ? (
                          <Textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            rows={3}
                            className="text-sm"
                          />
                        ) : c.proposed_rule ? (
                          <p className="text-sm">{c.proposed_rule}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">Drafting…</p>
                        )}
                        {(c.proposed_category || c.proposed_severity) && (
                          <div className="flex gap-1">
                            {c.proposed_category && (
                              <Badge variant="outline" className="text-[10px]">{c.proposed_category}</Badge>
                            )}
                            {c.proposed_severity && (
                              <Badge className={`text-[10px] ${sevColor[c.proposed_severity] || ""}`}>{c.proposed_severity}</Badge>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        {isEditing ? (
                          <>
                            <Button size="sm" onClick={() => approve(c.id, editText)}>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                              Save & Activate
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              onClick={() => approve(c.id)}
                              disabled={!c.proposed_rule}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingId(c.id);
                                setEditText(c.proposed_rule || "");
                              }}
                              disabled={!c.proposed_rule}
                            >
                              <Edit3 className="h-3.5 w-3.5 mr-1" />
                              Edit
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => reject(c.id)}>
                              <XCircle className="h-3.5 w-3.5 mr-1 text-destructive" />
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {tab === "active" && (
          <div className="space-y-2">
            {activeRules.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  No active rules yet. Seed via <code className="bg-muted px-1 rounded text-xs">/api/admin/rules</code> POST or approve a candidate above.
                </CardContent>
              </Card>
            ) : (
              activeRules.map((r) => (
                <Card key={r.id}>
                  <CardContent className="p-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{r.rule_text}</p>
                      <div className="flex gap-1 mt-1.5">
                        <Badge variant="outline" className="text-[10px]">{r.category}</Badge>
                        <Badge className={`text-[10px] ${sevColor[r.severity] || ""}`}>{r.severity}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{r.source}</Badge>
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => deactivate(r.id)} aria-label="Deactivate">
                      <XCircle className="h-4 w-4 text-destructive" />
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {loading && <Loader2 className="h-4 w-4 animate-spin mx-auto" />}
      </div>
    </div>
  );
}
