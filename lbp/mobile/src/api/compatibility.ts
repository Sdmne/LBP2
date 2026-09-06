import { api } from "./client";

// "Compatibility Score & Why you match" (Family Builder tier) / "Detailed
// Compatibility Report" (Family Builder Pro tier) - see PRICING_TEXT on the
// website. Neither existed anywhere before this (see backend/main.py's
// "COMPATIBILITY SCORE / DETAILED COMPATIBILITY REPORT" section for the
// full rationale, including why this follows the same "no percentage, no
// pass/fail" rule as the standalone Quiz). Answering the questionnaire is
// free; only the two-sided report against a match needs Premium (402) and
// an active match (404), same gating shape as familyRoom.ts.

export type CompatibilityOption = { key: string; label: string };
export type CompatibilityQuestion = {
  id: string;
  dimension: "parenting" | "involvement" | "timeline" | "boundaries";
  prompt: string;
  options: CompatibilityOption[];
};

export type CompatibilityReport =
  | { ok: true; status: "incomplete"; youCompleted: boolean; matchCompleted: boolean }
  | { ok: true; status: "ready"; strongest: string[]; worthDiscussing: string[]; talkingPoints: string[] };

export function fetchCompatibilityQuestions() {
  return api.get<{ items: CompatibilityQuestion[] }>("/api/member/compatibility/questions");
}

export function fetchCompatibilityAnswers() {
  return api.get<{ answers: Record<string, string> }>("/api/member/compatibility/answers");
}

export function saveCompatibilityAnswers(answers: Record<string, string>) {
  return api.post<{ ok: true; answers: Record<string, string> }>("/api/member/compatibility/answers", { answers });
}

export function fetchCompatibilityReport(profileId: number | string) {
  return api.get<CompatibilityReport>(`/api/member/compatibility-report/${profileId}`);
}
