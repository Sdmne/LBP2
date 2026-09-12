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
