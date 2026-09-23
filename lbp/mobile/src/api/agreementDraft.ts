import { api } from "./client";

// Free, unauthenticated "AI Agreement Draft" tool (backend: POST
// /api/public/agreement-draft, item 25) - mirrors the website's
// /tools/agreement-draft page, now as a real native screen (see
// AgreementDraftScreen.tsx). Stateless, rate-limited to 5 drafts/day per
// IP (AI_PUBLIC_RATE_LIMITS in main.py). Field limits mirror
// AgreementDraftPayload in main.py (agreementType <=120 chars,
// jurisdiction <=200, keyPoints <=4000) - enforced there server-side, and
// via maxLength on the inputs here so a paste-heavy user hits a hard stop
// instead of a 422 on submit.

export type AgreementDraftRequest = {
  locale: string;
  agreementType: string;
  jurisdiction?: string;
  keyPoints: string;
};

export function generateAgreementDraft(payload: AgreementDraftRequest) {
  return api.post<{ ok: true; draft: string }>("/api/public/agreement-draft", payload);
}
