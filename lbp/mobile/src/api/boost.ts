import { api } from "./client";

// GET/POST /api/member/boost - member_boost_status()/member_request_boost()
// in main.py. Premium roadmap step 3: a one-off paid profile Boost, same
// "member request, human review approves/declines" shape as Premium
// subscriptions (requestSubscription() in subscription.ts) - there's no
// real in-app billing/IAP in this app yet, so this is honestly a reviewed
// request, not instant activation.
export type BoostStatus = {
  active: boolean;
  activeUntil: string | null;
  pendingRequestId: number | null;
};

export function fetchBoostStatus() {
  return api.get<BoostStatus>("/api/member/boost");
}

export function requestBoost() {
  return api.post<{ ok: true; status: "ACTIVE" | "PENDING"; activeUntil?: string; requestId?: number; message?: string }>(
    "/api/member/boost",
  );
}
