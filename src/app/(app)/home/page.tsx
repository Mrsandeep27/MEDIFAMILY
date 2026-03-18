"use client";

import Link from "next/link";
import { ScanLine, Plus, AlertTriangle, Bell, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MemberSelector } from "@/components/family/member-selector";
import { useMembers } from "@/hooks/use-members";
import { useAuthStore } from "@/stores/auth-store";
import { useFamilyStore } from "@/stores/family-store";
import { APP_NAME } from "@/constants/config";

export default function HomePage() {
  const user = useAuthStore((s) => s.user);
  const { members } = useMembers();
  const { selectedMemberId, setSelectedMember } = useFamilyStore();

  const selfMember = members.find((m) => m.relation === "self");
  const greeting = selfMember
    ? `Hi, ${selfMember.name.split(" ")[0]}`
    : "Welcome";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 pt-6 pb-8 rounded-b-3xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">{greeting}</h1>
            <p className="text-primary-foreground/70 text-sm">{APP_NAME}</p>
          </div>
          <Link href="/more/settings">
            <Button
              size="icon"
              variant="ghost"
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <Bell className="h-5 w-5" />
            </Button>
          </Link>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-3">
          <Link href="/scan">
            <QuickAction
              icon={ScanLine}
              label="Scan Prescription"
            />
          </Link>
          <Link href="/records/add">
            <QuickAction icon={Plus} label="Add Record" />
          </Link>
          {selfMember && (
            <Link href={`/family/${selfMember.id}/emergency`}>
              <QuickAction
                icon={AlertTriangle}
                label="Emergency Card"
              />
            </Link>
          )}
        </div>
      </div>

      <div className="px-4 space-y-6">
        {/* Family Members */}
        {members.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Family Members</h2>
              <Link
                href="/family"
                className="text-sm text-primary font-medium"
              >
                View All
              </Link>
            </div>
            <MemberSelector
              members={members}
              selectedId={selectedMemberId}
              onSelect={(m) => setSelectedMember(m.id)}
            />
          </section>
        )}

        {/* Today's Reminders - Placeholder */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Today&apos;s Reminders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground py-4 text-center">
              No reminders for today. Scan a prescription to auto-create
              reminders.
            </p>
          </CardContent>
        </Card>

        {/* Recent Records - Placeholder */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Recent Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground py-4 text-center">
              No records yet. Add your first health record to get started.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 bg-primary-foreground/10 rounded-xl p-3 hover:bg-primary-foreground/20 transition-colors">
      <Icon className="h-6 w-6" />
      <span className="text-[11px] font-medium text-center leading-tight">
        {label}
      </span>
    </div>
  );
}
