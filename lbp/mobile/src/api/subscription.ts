import { api } from "./client";
import type { SubscriptionStatus, SubscriptionTier } from "./types";

export function fetchSubscriptionStatus() {
  return api.get<SubscriptionStatus>("/api/member/subscription");
}

// SubscriptionIntentPayload.plan in main.py is Pydantic-restricted to exactly
// "monthly" | "quarterly" | "annual" (lowercase). UPDATE (Sept 2026): the
// backend's normalize_subscription_plan() alias table was missing an entry
// for the bare string "QUARTERLY" - that's now fixed server-side, so all
// three periods work.
export type SubscriptionPlan = "monthly" | "quarterly" | "annual";

// SubscriptionIntentPayload.tier in main.py - the two paid tiers a member can
// request. "EXPLORE" isn't requestable, it's just the unpaid default.
export type RequestableTier = Extract<SubscriptionTier, "BUILDER" | "PRO">;

export function requestSubscription(plan: SubscriptionPlan, tier: RequestableTier = "BUILDER") {
  return api.post<{ ok: true; status: string; requestId?: number; message?: string }>(
    "/api/member/subscription-intent",
    { plan, tier },
  );
}
