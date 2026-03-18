"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MemberAvatar } from "./member-avatar";
import { RELATION_LABELS } from "@/constants/config";
import type { Member } from "@/lib/db/schema";

interface MemberCardProps {
  member: Member;
}

export function MemberCard({ member }: MemberCardProps) {
  return (
    <Link href={`/family/${member.id}`}>
      <Card className="hover:bg-muted/50 transition-colors">
        <CardContent className="flex items-center gap-3 p-4">
          <MemberAvatar name={member.name} size="md" />
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{member.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground">
                {RELATION_LABELS[member.relation] || member.relation}
              </span>
              {member.blood_group && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {member.blood_group}
                </Badge>
              )}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </CardContent>
      </Card>
    </Link>
  );
}
