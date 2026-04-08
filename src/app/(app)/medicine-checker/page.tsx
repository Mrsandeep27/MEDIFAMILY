"use client";

import { useState, useCallback } from "react";
import {
  Pill,
  Plus,
  X,
  AlertTriangle,
  CheckCircle,
  Search,
  Loader2,
  Info,
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useMedicines } from "@/hooks/use-medicines";
import { useMembers } from "@/hooks/use-members";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface Interaction {
  medicines: string[];
  description: string;
  severity: "mild" | "moderate" | "severe";
}

interface CheckResult {
  safe: boolean;
  interactions: Interaction[];
  rawText?: string;
}

const severityConfig = {
  mild: {
    bg: "bg-yellow-50 dark:bg-yellow-950",
    border: "border-yellow-200 dark:border-yellow-800",
    text: "text-yellow-800 dark:text-yellow-300",
    badge: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    label: "Mild",
  },
  moderate: {
    bg: "bg-orange-50 dark:bg-orange-950",
    border: "border-orange-200 dark:border-orange-800",
    text: "text-orange-800 dark:text-orange-300",
    badge: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
    label: "Moderate",
  },
  severe: {
    bg: "bg-red-50 dark:bg-red-950",
    border: "border-red-200 dark:border-red-800",
    text: "text-red-800 dark:text-red-300",
    badge: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    label: "Severe",
  },
};

export default function MedicineCheckerPage() {
  const { members } = useMembers();
  const selfMember = members.find((m) => m.relation === "self");
  const { medicines: allMedicines } = useMedicines(selfMember?.id);

  const activeMedicines = (allMedicines ?? []).filter(
    (m) => m.is_active && !m.is_deleted
  );

  const [inputValue, setInputValue] = useState("");
  const [selectedMedicines, setSelectedMedicines] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);

  const addMedicine = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const normalized = trimmed.toLowerCase();
      if (
        selectedMedicines.some((m) => m.toLowerCase() === normalized)
      ) {
        toast.error("Medicine already added");
        return;
      }
      setSelectedMedicines((prev) => [...prev, trimmed]);
      setInputValue("");
    },
    [selectedMedicines]
  );

  const removeMedicine = useCallback((name: string) => {
    setSelectedMedicines((prev) => prev.filter((m) => m !== name));
  }, []);

  const handleCheck = async () => {
    if (selectedMedicines.length < 2) {
      toast.error("Add at least 2 medicines to check interactions");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Get Supabase access token for authenticated API call
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Please sign in to check interactions");
      }

      const res = await fetch("/api/medicine-info", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          type: "interaction",
          medicines: selectedMedicines,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "Failed to check interactions");
      }

      const data = await res.json();

      // Try to parse structured interactions
      if (data.interactions && Array.isArray(data.interactions)) {
        const safe =
          data.interactions.length === 0 ||
          data.interactions.every(
            (i: Interaction) => i.severity === "mild" && !i.description
          );
        setResult({
          safe: data.interactions.length === 0,
          interactions: data.interactions,
        });
      } else if (data.result) {
        // Try to parse JSON from the result string
        const resultText =
          typeof data.result === "string"
            ? data.result
            : JSON.stringify(data.result);

        try {
          const jsonMatch = resultText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.interactions && Array.isArray(parsed.interactions)) {
              setResult({
                safe: parsed.interactions.length === 0,
                interactions: parsed.interactions,
              });
              return;
            }
          }
        } catch {
          // Not JSON, use raw text
        }

        // Fallback: show raw text result
        const hasWarning =
          resultText.toLowerCase().includes("interact") ||
          resultText.toLowerCase().includes("caution") ||
          resultText.toLowerCase().includes("avoid") ||
          resultText.toLowerCase().includes("warning");
        setResult({
          safe: !hasWarning,
          interactions: [],
          rawText: resultText,
        });
      } else {
        throw new Error("Unexpected response format");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to check interactions"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addMedicine(inputValue);
    }
  };

  // Filter quick-add chips: active medicines not already selected
  const quickAddMedicines = activeMedicines.filter(
    (m) => !selectedMedicines.some((s) => s.toLowerCase() === m.name.toLowerCase())
  );

  // Deduplicate by medicine name (case-insensitive)
  const uniqueQuickAdd = quickAddMedicines.filter(
    (m, i, arr) =>
      arr.findIndex((a) => a.name.toLowerCase() === m.name.toLowerCase()) === i
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader title="Medicine Checker" showBack />

      <div className="px-4 py-5 space-y-4 max-w-lg mx-auto">
        {/* Info Card */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-3">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">
                Check if your medicines can be safely taken together. Powered by
                AI.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Medicine Input Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pill className="h-4 w-4" />
              Select Medicines
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Input Row */}
            <div className="flex gap-2">
              <Input
                placeholder="Type medicine name..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={() => addMedicine(inputValue)}
                disabled={!inputValue.trim()}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>

            {/* Quick-add chips from active medicines */}
            {uniqueQuickAdd.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">
                  Your active medicines:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {uniqueQuickAdd.map((med) => (
                    <button
                      key={med.id}
                      onClick={() => addMedicine(med.name)}
                      className="text-xs px-2.5 py-1 rounded-full border border-border bg-background hover:bg-muted transition-colors flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      {med.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Selected Medicines */}
            {selectedMedicines.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">
                  Selected ({selectedMedicines.length}):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedMedicines.map((name) => (
                    <Badge
                      key={name}
                      variant="secondary"
                      className="pl-2.5 pr-1 py-1 gap-1 h-auto"
                    >
                      {name}
                      <button
                        onClick={() => removeMedicine(name)}
                        className="ml-0.5 hover:bg-foreground/10 rounded-full p-0.5 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Minimum hint */}
            {selectedMedicines.length < 2 && (
              <p className="text-xs text-muted-foreground">
                Add at least 2 medicines to check for interactions.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Check Button */}
        <Button
          className="w-full"
          size="lg"
          onClick={handleCheck}
          disabled={selectedMedicines.length < 2 || loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Check Interactions
            </>
          )}
        </Button>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center py-8 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Analyzing medicine interactions...
            </p>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-3">
            {/* Safe / No Interactions */}
            {result.safe && !result.rawText && (
              <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-green-100 dark:bg-green-900 p-2">
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-green-800 dark:text-green-300 text-sm">
                        No Known Harmful Interactions
                      </p>
                      <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                        These medicines appear safe to take together based on
                        available data.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Interaction Cards */}
            {result.interactions.length > 0 &&
              result.interactions.map((interaction, idx) => {
                const config =
                  severityConfig[interaction.severity] || severityConfig.moderate;
                return (
                  <Card
                    key={idx}
                    className={`${config.bg} ${config.border}`}
                  >
                    <CardContent className="py-3">
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 mt-0.5">
                          <AlertTriangle
                            className={`h-5 w-5 ${config.text}`}
                          />
                        </div>
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded-full ${config.badge}`}
                            >
                              {config.label}
                            </span>
                            {interaction.medicines &&
                              interaction.medicines.length > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  {interaction.medicines.join(" + ")}
                                </span>
                              )}
                          </div>
                          <p className={`text-sm ${config.text}`}>
                            {interaction.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

            {/* Raw Text Result Fallback */}
            {result.rawText && (
              <Card
                className={
                  result.safe
                    ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
                    : "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800"
                }
              >
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">
                      {result.safe ? (
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {result.rawText}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Reset Button */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setResult(null);
                setSelectedMedicines([]);
              }}
            >
              Check Another Combination
            </Button>
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-[10px] text-center text-muted-foreground px-4">
          This is AI-generated information. Always consult your doctor before
          combining medicines.
        </p>
      </div>
    </div>
  );
}
