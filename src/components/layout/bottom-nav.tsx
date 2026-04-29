"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, MoreHorizontal, ScanLine, Activity, Building2, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/use-locale";
import { useSettingsStore } from "@/stores/settings-store";

// Family workspace nav (default) — Home / Family / Scan / Wellness / More
const familyNav = [
  { href: "/home", labelKey: "nav.home", label: "Home", icon: Home, tourKey: "nav-home" },
  { href: "/family", labelKey: "nav.family", label: "Family", icon: Users, tourKey: "nav-family" },
  { href: "/scan", labelKey: "nav.scan", label: "Scan", icon: ScanLine, isFab: true, tourKey: "nav-scan" },
  { href: "/wellness", labelKey: "nav.wellness", label: "Wellness", icon: Activity, tourKey: "nav-wellness" },
  { href: "/more", labelKey: "nav.more", label: "More", icon: MoreHorizontal, tourKey: "nav-more" },
];

// Care Home workspace nav — Home / Residents / Round (FAB) / Scan / More
// The Round button is the FAB so it's the most accessible action — that's
// what caretakers tap most often during a shift. No translation keys yet
// for the care-home nav items; using literal labels (English-only for
// pilot is fine).
const careHomeNav = [
  { href: "/home", labelKey: "nav.home", label: "Home", icon: Home, tourKey: "nav-home" },
  { href: "/residents", labelKey: "", label: "Residents", icon: Building2, tourKey: "nav-residents" },
  { href: "/round", labelKey: "", label: "Round", icon: ListChecks, isFab: true, tourKey: "nav-round" },
  { href: "/scan", labelKey: "nav.scan", label: "Scan", icon: ScanLine, tourKey: "nav-scan" },
  { href: "/more", labelKey: "nav.more", label: "More", icon: MoreHorizontal, tourKey: "nav-more" },
];

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useLocale();
  const careHomeMode = useSettingsStore((s) => s.careHomeMode);
  const navItems = careHomeMode ? careHomeNav : familyNav;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          if (item.isFab) {
            return (
              <Link
                key={item.href}
                href={item.href}
                data-tour={item.tourKey}
                className="flex flex-col items-center justify-center -mt-5"
              >
                <div className="h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
                  <Icon className="h-6 w-6" />
                </div>
                <span className="text-[10px] mt-0.5 font-medium">
                  {item.labelKey ? t(item.labelKey) : item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour={item.tourKey}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 min-w-[60px] py-1",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">
                {item.labelKey ? t(item.labelKey) : item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
