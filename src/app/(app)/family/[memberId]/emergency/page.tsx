"use client";

import { use } from "react";
import { Phone, Droplets, AlertTriangle, Pill, Heart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/layout/app-header";
import { MemberAvatar } from "@/components/family/member-avatar";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { useMember } from "@/hooks/use-members";

export default function EmergencyCardPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = use(params);
  const { member, isLoading } = useMember(memberId);

  if (isLoading) {
    return (
      <div>
        <AppHeader title="Emergency Card" showBack />
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
      <AppHeader title="Emergency Card" showBack />
      <div className="p-4 space-y-4">
        {/* Emergency Card */}
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900">
          <CardContent className="pt-6 space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
              <MemberAvatar name={member.name} size="lg" />
              <div>
                <h2 className="text-lg font-bold">{member.name}</h2>
                {member.date_of_birth && (
                  <p className="text-sm text-muted-foreground">
                    DOB: {new Date(member.date_of_birth).toLocaleDateString("en-IN")}
                  </p>
                )}
              </div>
            </div>

            {/* Blood Group */}
            {member.blood_group && (
              <div className="flex items-center gap-2 bg-white dark:bg-background rounded-lg p-3">
                <Droplets className="h-5 w-5 text-red-500" />
                <span className="text-sm font-medium">Blood Group:</span>
                <span className="text-lg font-bold text-red-600">
                  {member.blood_group}
                </span>
              </div>
            )}

            {/* Allergies */}
            {member.allergies.length > 0 && (
              <div className="bg-white dark:bg-background rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium text-red-600">
                    Allergies
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {member.allergies.map((a) => (
                    <Badge key={a} variant="destructive">
                      {a}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Chronic Conditions */}
            {member.chronic_conditions.length > 0 && (
              <div className="bg-white dark:bg-background rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">
                    Chronic Conditions
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {member.chronic_conditions.map((c) => (
                    <Badge key={c} variant="secondary">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Current Medications - Placeholder */}
            <div className="bg-white dark:bg-background rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Pill className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">
                  Current Medications
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                No active medications recorded yet.
              </p>
            </div>

            {/* Emergency Contact */}
            {member.emergency_contact_phone && (
              <div className="bg-white dark:bg-background rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Emergency Contact</p>
                    <p className="text-sm text-muted-foreground">
                      {member.emergency_contact_name || "Contact"}
                    </p>
                  </div>
                  <a href={`tel:${member.emergency_contact_phone}`}>
                    <Button size="sm" variant="destructive">
                      <Phone className="h-4 w-4 mr-1" />
                      Call
                    </Button>
                  </a>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
