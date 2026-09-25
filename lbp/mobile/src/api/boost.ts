import { api } from "./client";

// GET/POST /api/member/boost - member_boost_status()/member_request_boost()
// in main.py. Premium roadmap step 3: a one-off paid profile Boost.
// Activates instantly on request now (2026-09-25 - see the comment on
// member_request_boost() in main.py for why the old "human review"
// step was dropped). `pendingRequestId` is kept on the type only for
// any pre-existing PENDING boost rows from before that change - a new
// request from this build never comes back PENDING.
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
