import { api } from "./client";

// Free, unauthenticated "Ask AI" tool (backend: POST /api/public/ask-ai,
// item 25) - mirrors the website's /tools/ask-ai page, now as a real native
// screen (see AskAiScreen.tsx) instead of opening that page in the in-app
// browser. Stateless on the server: unlike the Premium AI Family Advisor
// (api/aiAdvisor.ts), nothing is persisted, so there's no fetch/clear
// equivalent here - the screen keeps its own local, in-memory message list.
// Rate-limited server-side to 15 questions/day per IP
// (AI_PUBLIC_RATE_LIMITS in main.py) - a 429 means that limit was hit for
// the day; a 503 means ANTHROPIC_API_KEY isn't configured on the server.

export function askAi(question: string) {
  return api.post<{ ok: true; answer: string }>("/api/public/ask-ai", { question });
}
