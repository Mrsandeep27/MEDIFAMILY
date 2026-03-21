"use client";

import { useState } from "react";
import {
  Users,
  Plus,
  Copy,
  LogIn,
  Crown,
  User,
  LogOut,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AppHeader } from "@/components/layout/app-header";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { useFamilyGroup } from "@/hooks/use-family-group";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";

export default function FamilyGroupPage() {
  const user = useAuthStore((s) => s.user);
  const { families, isLoading, createFamily, joinFamily, leaveFamily } =
    useFamilyGroup();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!familyName.trim()) {
      toast.error("Enter a family name");
      return;
    }
    setLoading(true);
    try {
      const family = await createFamily(familyName.trim());
      if (family) {
        toast.success(`Family "${family.name}" created! Share code: ${family.invite_code}`);
        setFamilyName("");
        setShowCreate(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create family");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      toast.error("Enter an invite code");
      return;
    }
    setLoading(true);
    try {
      const family = await joinFamily(inviteCode.trim());
      if (family) {
        toast.success(`Joined "${family.name}" family!`);
        setInviteCode("");
        setShowJoin(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to join family");
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async (familyId: string, familyName: string) => {
    if (!confirm(`Leave "${familyName}"? You'll lose access to shared records.`)) return;
    try {
      await leaveFamily(familyId);
      toast.success(`Left "${familyName}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to leave family");
    }
  };

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Invite code copied!");
  };

  const shareInviteCode = async (name: string, code: string) => {
    if (navigator.share) {
      await navigator.share({
        title: `Join ${name} on MediLog`,
        text: `Join our family health group on MediLog! Use invite code: ${code}`,
        url: "https://medi--log.vercel.app",
      });
    } else {
      copyInviteCode(code);
    }
  };

  if (isLoading) {
    return (
      <div>
        <AppHeader title="Family Group" showBack />
        <div className="flex items-center justify-center min-h-[50vh]">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div>
      <AppHeader title="Family Group" showBack />
      <div className="p-4 space-y-4">
        {/* Info card */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-3">
            <p className="text-sm text-muted-foreground">
              Family Groups let multiple devices share health records.
              Create a group and share the invite code with your family.
            </p>
          </CardContent>
        </Card>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-auto py-3"
            onClick={() => { setShowCreate(true); setShowJoin(false); }}
          >
            <div className="flex flex-col items-center gap-1">
              <Plus className="h-5 w-5" />
              <span className="text-xs">Create Family</span>
            </div>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-3"
            onClick={() => { setShowJoin(true); setShowCreate(false); }}
          >
            <div className="flex flex-col items-center gap-1">
              <LogIn className="h-5 w-5" />
              <span className="text-xs">Join Family</span>
            </div>
          </Button>
        </div>

        {/* Create Family Form */}
        {showCreate && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Create Family Group</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="familyName">Family Name</Label>
                <Input
                  id="familyName"
                  placeholder="e.g. Pandey Family"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreate} disabled={loading} className="flex-1">
                  {loading ? "Creating..." : "Create"}
                </Button>
                <Button variant="outline" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Join Family Form */}
        {showJoin && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Join Family Group</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="inviteCode">Invite Code</Label>
                <Input
                  id="inviteCode"
                  placeholder="e.g. ABCD1234"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  maxLength={8}
                  className="uppercase tracking-widest text-center text-lg font-mono"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleJoin} disabled={loading} className="flex-1">
                  {loading ? "Joining..." : "Join"}
                </Button>
                <Button variant="outline" onClick={() => setShowJoin(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Family Groups List */}
        {families.length === 0 && !showCreate && !showJoin ? (
          <EmptyState
            icon={Users}
            title="No Family Groups"
            description="Create a family group or join one with an invite code to share health records across devices."
          />
        ) : (
          families.map((family) => (
            <Card key={family.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    {family.name}
                  </CardTitle>
                  <Badge variant={family.role === "admin" ? "default" : "secondary"}>
                    {family.role === "admin" ? (
                      <><Crown className="h-3 w-3 mr-1" />Admin</>
                    ) : (
                      "Member"
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Invite Code */}
                <div className="bg-muted rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Invite Code</span>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() => copyInviteCode(family.invite_code)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() => shareInviteCode(family.name, family.invite_code)}
                      >
                        <Share2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="font-mono text-xl tracking-[0.3em] font-bold text-center">
                    {family.invite_code}
                  </p>
                </div>

                {/* Members */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {family.members.length} member{family.members.length !== 1 ? "s" : ""}
                  </p>
                  <div className="space-y-1">
                    {family.members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-2 py-1.5"
                      >
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          {member.role === "admin" ? (
                            <Crown className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {member.name || member.email}
                            {member.user_id === user?.id && (
                              <span className="text-xs text-muted-foreground ml-1">(You)</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {member.email}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Leave button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive w-full"
                  onClick={() => handleLeave(family.id, family.name)}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Leave Family
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
