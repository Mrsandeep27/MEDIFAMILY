"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Edit,
  Share2,
  AlertTriangle,
  BarChart3,
  Droplets,
  Heart,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AppHeader } from "@/components/layout/app-header";
import { MemberAvatar } from "@/components/family/member-avatar";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { useMember, useMembers } from "@/hooks/use-members";
import { RELATION_LABELS } from "@/constants/config";
import { toast } from "sonner";

export default function MemberDetailPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = use(params);
  const router = useRouter();
  const { member, isLoading } = useMember(memberId);
  const { deleteMember } = useMembers();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (isLoading) {
    return (
      <div>
        <AppHeader title="Loading..." showBack />
        <LoadingSpinner className="py-12" />
      </div>
    );
  }

  if (!member) {
    return (
      <div>
        <AppHeader title="Not Found" showBack />
        <p className="text-center text-muted-foreground py-12">
          Member not found.
        </p>
      </div>
    );
  }

  return (
    <div>
      <AppHeader
        title={member.name}
        showBack
        rightAction={
          <Link href={`/family/${memberId}/edit`}>
            <Button size="icon" variant="ghost">
              <Edit className="h-4 w-4" />
            </Button>
          </Link>
        }
      />

      <div className="p-4 space-y-4">
        {/* Profile Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <MemberAvatar name={member.name} size="lg" />
              <h2 className="text-xl font-bold mt-3">{member.name}</h2>
              <span className="text-sm text-muted-foreground">
                {RELATION_LABELS[member.relation] || member.relation}
              </span>

              <div className="flex gap-4 mt-4">
                {member.blood_group && (
                  <div className="flex items-center gap-1 text-sm">
                    <Droplets className="h-4 w-4 text-red-500" />
                    <span className="font-medium">{member.blood_group}</span>
                  </div>
                )}
                {member.date_of_birth && (
                  <span className="text-sm text-muted-foreground">
                    DOB: {new Date(member.date_of_birth).toLocaleDateString("en-IN")}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-3">
          <Link href={`/family/${memberId}/emergency`}>
            <ActionButton icon={AlertTriangle} label="Emergency" color="text-red-500" />
          </Link>
          <Link href={`/family/${memberId}/share`}>
            <ActionButton icon={Share2} label="Share" color="text-blue-500" />
          </Link>
          <Link href={`/family/${memberId}/insights`}>
            <ActionButton icon={BarChart3} label="Insights" color="text-green-500" />
          </Link>
        </div>

        {/* Allergies & Conditions */}
        {(member.allergies.length > 0 ||
          member.chronic_conditions.length > 0) && (
          <Card>
            <CardContent className="pt-4 space-y-3">
              {member.allergies.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1.5">
                    Allergies
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {member.allergies.map((a) => (
                      <Badge key={a} variant="destructive" className="text-xs">
                        {a}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {member.allergies.length > 0 &&
                member.chronic_conditions.length > 0 && <Separator />}
              {member.chronic_conditions.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1.5">
                    Chronic Conditions
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {member.chronic_conditions.map((c) => (
                      <Badge key={c} variant="secondary" className="text-xs">
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Health Timeline - Placeholder */}
        <Card>
          <CardContent className="py-8 text-center">
            <Heart className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No health records yet. Scan a prescription or add a record to
              start building the timeline.
            </p>
          </CardContent>
        </Card>

        {/* Delete Member — only for non-self members */}
        {member.relation !== "self" && (
          <div className="pt-4">
            {!showDeleteConfirm ? (
              <Button
                variant="ghost"
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Member
              </Button>
            ) : (
              <Card className="border-destructive">
                <CardContent className="py-4 space-y-3">
                  <p className="text-sm font-medium text-destructive">
                    Delete {member.name}? This will remove all their records, medicines, and reminders. This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      className="flex-1"
                      disabled={isDeleting}
                      onClick={async () => {
                        setIsDeleting(true);
                        try {
                          await deleteMember(memberId);
                          toast.success(`${member.name} deleted`);
                          router.replace("/family");
                        } catch (err) {
                          console.error("Delete failed:", err);
                          toast.error("Failed to delete member");
                          setIsDeleting(false);
                        }
                      }}
                    >
                      {isDeleting ? "Deleting..." : "Yes, Delete"}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={isDeleting}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  color,
}: {
  icon: React.ElementType;
  label: string;
  color: string;
}) {
  return (
    <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
      <CardContent className="flex flex-col items-center gap-1.5 py-3 px-2">
        <Icon className={`h-5 w-5 ${color}`} />
        <span className="text-xs font-medium">{label}</span>
      </CardContent>
    </Card>
  );
}
