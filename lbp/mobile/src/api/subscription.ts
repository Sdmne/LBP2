import { api } from "./client";
import type { SubscriptionStatus } from "./types";

export function fetchSubscriptionStatus() {
  return api.get<SubscriptionStatus>("/api/member/subscription");
}

// SubscriptionIntentPayload.plan in main.py is Pydantic-restricted to exactly
// "monthly" | "quarterly" | "annual" (lowercase). Note: as read, the
// backend's normalize_subscription_plan() alias table has no entry for the
// bare string "QUARTERLY" (only "MONTHLY", "ANNUAL", and the already-prefixed
// "PREMIUM_QUARTERLY") - so sending plan: "quarterly" here currently 422s
// server-side. Flagged for the backend team rather than silently working
// around it; "monthly" and "annual" are confirmed working.
export type SubscriptionPlan = "monthly" | "quarterly" | "annual";

export function requestSubscription(plan: SubscriptionPlan) {
  return api.post<{ ok: true; status: string; requestId?: number; message?: string }>(
    "/api/member/subscription-intent",
    { plan },
  );
}
