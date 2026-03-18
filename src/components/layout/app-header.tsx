"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppHeaderProps {
  title: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
}

export function AppHeader({ title, showBack, rightAction }: AppHeaderProps) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 bg-background border-b px-4 h-14 flex items-center gap-3">
      {showBack && (
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 -ml-2"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      )}
      <h1 className="text-lg font-semibold truncate flex-1">{title}</h1>
      {rightAction && <div className="shrink-0">{rightAction}</div>}
    </header>
  );
}
