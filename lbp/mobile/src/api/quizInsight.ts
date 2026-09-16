import { api } from "./client";

// Personalized AI quiz reflection (Sept 2026 growth push) - POST
// /api/public/quiz-insight, layered on top of the existing static bucketed
// results already computed locally by computeQuizResults()/
// quizResultsAsText() (src/data/resources.ts). Public/unauthenticated on
// the backend (rate-limited per IP/day - see AI_PUBLIC_RATE_LIMITS in
// backend/main.py), and only ever fetched on demand when the person taps
// the button in CompatibilityQuizScreen, never automatically.
export function fetchQuizInsight(payload: {
  locale: string;
  strongestTitles: string[];
  discussTitles: string[];
  answers: string[];
}) {
  return api.post<{ ok: true; insight: string }>("/api/public/quiz-insight", payload);
}
