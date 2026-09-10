import { api } from "./client";

// Real, per-member analytics/marketing consent - backed by the dedicated
// profile_consents table in main.py (GET/POST /api/member/privacy/consent),
// not a local-only switch. Separate from the website's anonymous
// cookie-consent system, which covers pre-login visitors and different
// categories (functional/statistics cookies).
export type ConsentCategory = "analytics" | "marketing";

export type ConsentCategoryState = {
  granted: boolean;
  decided: boolean;
  updatedAt: string | null;
};

export type PrivacyConsentState = Record<ConsentCategory, ConsentCategoryState>;

export function fetchPrivacyConsent() {
  return api.get<{ ok: true; consent: PrivacyConsentState }>("/api/member/privacy/consent");
}

export function savePrivacyConsent(updates: Partial<Record<ConsentCategory, boolean>>) {
  return api.post<{ ok: true; consent: PrivacyConsentState }>("/api/member/privacy/consent", updates);
}
