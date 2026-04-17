"use client";

import { MemberAvatar } from "./member-avatar";
import { cn } from "@/lib/utils";
import type { Member } from "@/lib/db/schema";

interface MemberSelectorProps {
  members: Member[];
  selectedId?: string | null;
  onSelect: (member: Member) => void;
}

export function MemberSelector({
  members,
  selectedId,
  onSelect,
}: MemberSelectorProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
      {members.map((member) => (
        <button
          key={member.id}
          onClick={() => onSelect(member)}
          className={cn(
            "flex flex-col items-center gap-1 min-w-[60px] p-2 rounded-lg transition-colors",
            selectedId === member.id
              ? "bg-primary/10 ring-2 ring-primary"
              : "hover:bg-muted"
          )}
        >
          <MemberAvatar name={member.name} avatarUrl={member.avatar_url} size="md" />
          <span className="text-[11px] font-medium truncate max-w-[60px]">
            {member.name.split(" ")[0]}
          </span>
        </button>
      ))}
    </div>
  );
}
