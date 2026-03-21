"use client";

import { useCallback } from "react";
import { useSettingsStore } from "@/stores/settings-store";
import { t, type Locale } from "./translations";

export function useLocale() {
  const language = useSettingsStore((s) => s.language) as Locale;

  const translate = useCallback(
    (key: string) => t(key, language),
    [language]
  );

  return {
    locale: language,
    t: translate,
  };
}
