import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { fetchSettings } from "../api/settings";
import { translations, type Locale, SUPPORTED_LOCALES } from "./translations";
import { useAuth } from "../context/AuthContext";

export { type Locale, SUPPORTED_LOCALES };

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function normalizeLocale(value: string | null | undefined): Locale {
  const lower = String(value || "").toLowerCase();
  return (SUPPORTED_LOCALES.some((entry) => entry.code === lower) ? lower : "en") as Locale;
}

// Picks up the person's saved interfaceLanguage (GET /api/member/settings -
// same field the site's Settings page writes to) once they're logged in, so
// someone who set their language on the website sees the same language
// here without having to set it twice. SettingsScreen calls setLocale
// directly (in addition to saving it server-side) when the person changes
// it from inside the app, so the switch is instant rather than waiting on
// a refetch.
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    if (!isAuthenticated) return;
    let alive = true;
    fetchSettings()
      .then((settings) => {
        if (alive) setLocaleState(normalizeLocale(settings.interfaceLanguage));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [isAuthenticated]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale: (next) => setLocaleState(normalizeLocale(next)),
      t: (key, vars) => {
        const raw = translations[locale][key] ?? translations.en[key] ?? key;
        if (!vars) return raw;
        return Object.entries(vars).reduce(
          (acc, [name, value]) => acc.replace(new RegExp(`{{${name}}}`, "g"), String(value)),
          raw
        );
      },
    }),
    [locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
