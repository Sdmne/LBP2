import { api } from "./client";

// AI Family Advisor (backlog item 12 - "ИИ консультант"). Premium-gated
// (402 if the caller isn't Premium - see profile_is_premium() gating in
// member_ai_advisor_*() in main.py). Helps members navigate the process
// and the app - per the system prompt on the backend it deliberately never
// gives medical/legal/financial/psychological advice and never recommends
// a specific match/clinic/lawyer.

export type AiAdvisorMessage = { role: "user" | "assistant"; text: string; at: string };

export function fetchAiAdvisorMessages() {
  return api.get<{ ok: true; configured: boolean; messages: AiAdvisorMessage[] }>("/api/member/ai-advisor/messages");
}

export function sendAiAdvisorMessage(text: string) {
  return api.post<{ ok: true; reply: string; messages: AiAdvisorMessage[] }>("/api/member/ai-advisor/messages", { text });
}

export function clearAiAdvisorMessages() {
  return api.delete<{ ok: true }>("/api/member/ai-advisor/messages");
}

// Premium roadmap step 10 - personalized weekly insight, cached
// server-side for 7 days (see member_ai_advisor_weekly_insight() in
// main.py) - a repeated call within the same week returns the same
// cached text ("cached": true), no extra Claude API cost.
export type WeeklyInsight = { ok: true; insight: string; generatedAt: string; cached: boolean };

export function fetchWeeklyInsight(locale: string) {
  return api.get<WeeklyInsight>(`/api/member/ai-advisor/weekly-insight?locale=${encodeURIComponent(locale)}`);
}
