"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Share2,
  Download,
  LogOut,
  ChevronRight,
  Shield,
  Users,
  MessageSquare,
  Award,
  Gift,
  Lock,
  Bell,
  Globe,
  HelpCircle,
  Building2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppHeader } from "@/components/layout/app-header";
import { useAuth } from "@/hooks/use-auth";
import { useMembers } from "@/hooks/use-members";
import { useLocale } from "@/lib/i18n/use-locale";
import { useSettingsStore } from "@/stores/settings-store";
import { hashPin } from "@/lib/auth/pin";
import { requestNotificationPermission } from "@/lib/notifications/web-push";
import { replayAppTour } from "@/hooks/use-app-tour";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { shareMediFamily } from "@/lib/utils/share-app";

// Settings (PIN, notifications, language, tour replay) used to live on
// /more/settings — but it's only 4 toggles, easier to scan if they sit
// inline here. /more/settings now redirects back to /more.
const sharingItems = [
  { href: "/more/shared-links", icon: Share2, labelKey: "more.share_doctor" },
  { href: "/more/export", icon: Download, labelKey: "more.download_report" },
  { href: "/more/family-group", icon: Users, labelKey: "more.family_group" },
  { href: "/badges", icon: Award, labelKey: "more.badges" },
];

const accountItems = [
  { href: "/more/feedback", icon: MessageSquare, labelKey: "more.feedback" },
];

export default function MorePage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { members } = useMembers();
  const { t } = useLocale();
  const {
    pinEnabled,
    setPinEnabled,
    setPinHash,
    language,
    setLanguage,
    notificationsEnabled,
    setNotificationsEnabled,
    careHomeMode,
    setCareHomeMode,
  } = useSettingsStore();

  const selfMember = members.find((m) => m.relation === "self");
  const displayName = user?.name || selfMember?.name || "";

  const [pinInput, setPinInput] = useState("");
  const [showPinSetup, setShowPinSetup] = useState(false);

  const handleSetPin = async () => {
    if (pinInput.length !== 4 || !/^\d{4}$/.test(pinInput)) {
      toast.error(t("settings.pin_error"));
      return;
    }
    const hash = await hashPin(pinInput);
    setPinHash(hash);
    setPinEnabled(true);
    setPinInput("");
    setShowPinSetup(false);
    toast.success(t("settings.pin_success"));
  };

  const handleDisablePin = () => {
    setPinEnabled(false);
    setPinHash(null);
    toast.success(t("settings.pin_disabled"));
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    router.push("/login");
  };

  return (
    <div>
      <AppHeader title={t("more.title")} />
      <div className="p-4 space-y-4">
        {/* User Info */}
        {user && (
          <Card>
            <CardContent className="p-0">
              <button
                onClick={() => {
                  if (selfMember) {
                    router.push(`/family/${selfMember.id}/edit`);
                  } else {
                    router.push("/family/add");
                  }
                }}
                className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">
                    {displayName?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || "U"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{displayName || "Add your name"}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </CardContent>
          </Card>
        )}

        {/* Sharing section */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">{t("more.sharing")}</p>
          <Card>
            <CardContent className="p-0">
              {sharingItems.map((item, index) => (
                <div key={item.href}>
                  <Link href={item.href}>
                    <div className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors">
                      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <item.icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{t(item.labelKey)}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                  {index < sharingItems.length - 1 && <Separator />}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Care Home mode — flips the app between family and care-home
            workflows. When ON: /residents replaces /family in nav, the
            Daily Round screen is exposed, terminology shifts ("Add
            Resident" instead of "Add Member"). One toggle, drives
            everything via the settings store. */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">
            Workspace
          </p>
          <Card>
            <CardContent className="py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Care Home Mode</p>
                    <p className="text-xs text-muted-foreground truncate">
                      For caretakers managing residents
                    </p>
                  </div>
                </div>
                <Button
                  variant={careHomeMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCareHomeMode(!careHomeMode)}
                >
                  {careHomeMode ? "On" : "Off"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Settings — inlined directly on /more */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">
            {t("settings.title")}
          </p>

          {/* PIN Lock */}
          <Card className="mb-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Lock className="h-4 w-4" />
                {t("settings.pin_lock")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pinEnabled ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm">{t("settings.pin_enabled")}</span>
                  <Button variant="outline" size="sm" onClick={handleDisablePin}>
                    {t("settings.pin_disable")}
                  </Button>
                </div>
              ) : showPinSetup ? (
                <div className="space-y-2">
                  <Label className="text-xs">{t("settings.pin_enter")}</Label>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={pinInput}
                      onChange={(e) =>
                        setPinInput(e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="0000"
                      className="w-24 text-center text-lg tracking-widest"
                    />
                    <Button onClick={handleSetPin} size="sm">
                      {t("settings.pin_set")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowPinSetup(false);
                        setPinInput("");
                      }}
                    >
                      {t("common.cancel")}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPinSetup(true)}
                >
                  {t("settings.pin_enable")}
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                {t("settings.pin_desc")}
              </p>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card className="mb-2">
            <CardContent className="py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Bell className="h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t("settings.medicine_reminders")}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {t("settings.medicine_reminders_desc")}
                    </p>
                  </div>
                </div>
                <Button
                  variant={notificationsEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={async () => {
                    if (!notificationsEnabled) {
                      const granted = await requestNotificationPermission();
                      if (!granted) {
                        toast.error(t("common.error"));
                        return;
                      }
                    }
                    setNotificationsEnabled(!notificationsEnabled);
                  }}
                >
                  {notificationsEnabled ? t("settings.on") : t("settings.off")}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Language */}
          <Card className="mb-2">
            <CardContent className="py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <p className="text-sm font-medium">{t("settings.language")}</p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant={language === "en" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setLanguage("en")}
                  >
                    English
                  </Button>
                  <Button
                    variant={language === "hi" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setLanguage("hi")}
                  >
                    हिंदी
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* App tour */}
          <Card>
            <CardContent className="py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <HelpCircle className="h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">App tour</p>
                    <p className="text-xs text-muted-foreground truncate">
                      Replay the walkthrough
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    replayAppTour();
                    toast.success("Tour will start on Home");
                    setTimeout(() => {
                      window.location.href = "/home";
                    }, 600);
                  }}
                >
                  Replay
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Account section */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">{t("more.account")}</p>
          <Card>
            <CardContent className="p-0">
              {accountItems.map((item, index) => (
                <div key={item.href}>
                  <Link href={item.href}>
                    <div className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors">
                      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <item.icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{t(item.labelKey)}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                  {index < accountItems.length - 1 && <Separator />}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Share MediFamily */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-0">
            <button
              onClick={shareMediFamily}
              className="flex items-center gap-3 p-4 w-full hover:bg-primary/10 transition-colors"
            >
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Gift className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium">{t("more.share_app")}</p>
                <p className="text-xs text-muted-foreground">{t("more.share_app_desc")}</p>
              </div>
              <Share2 className="h-4 w-4 text-primary" />
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 p-4 w-full hover:bg-muted/50 transition-colors text-destructive"
            >
              <div className="h-9 w-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                <LogOut className="h-4 w-4" />
              </div>
              <p className="text-sm font-medium">{t("settings.sign_out")}</p>
            </button>
          </CardContent>
        </Card>

        <div className="text-center pt-4">
          <div className="flex items-center justify-center gap-1 text-muted-foreground">
            <Shield className="h-3.5 w-3.5" />
            <span className="text-xs">MediFamily v1.0 — Your data stays private</span>
          </div>
        </div>
      </div>
    </div>
  );
}
