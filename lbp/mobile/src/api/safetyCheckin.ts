import { api } from "./client";

// GET/POST /api/member/safety-checkins(+/{id}/safe, /{id}/cancel) -
// member_list_safety_checkins()/member_create_safety_checkin()/
// member_mark_safety_checkin_safe()/member_cancel_safety_checkin() in
// main.py. Premium roadmap step 7: a free safety tool (deliberately NOT
// Premium-gated, same reasoning as the cost calculator in step 6 - see
// CostCalculatorScreen.tsx's comment) for logging a "meeting someone in
// person" plan with a check-in deadline. There is no push-notification
// delivery in this app yet (see the standing push-notification item in the
// project doc), so this never claims to alert anyone automatically -
// SafetyCheckInScreen.tsx's "Share plan" button hands the member a
// pre-written message to send to a trusted contact themselves via the
// native share sheet.
export type SafetyCheckinStatus = "PENDING" | "SAFE" | "CANCELLED";

export type SafetyCheckin = {
  id: number;
  status: SafetyCheckinStatus;
  withWhom: string | null;
  plan: string | null;
  createdAt: string | null;
  checkInByAt: string | null;
  safeAt: string | null;
};

export function fetchSafetyCheckins() {
  return api.get<{ ok: true; checkins: SafetyCheckin[] }>("/api/member/safety-checkins");
}

export function createSafetyCheckin(payload: { withWhom: string | null; plan: string; hoursUntilCheckIn: number }) {
  return api.post<{ ok: true; checkin: SafetyCheckin }>("/api/member/safety-checkins", payload);
}

export function markSafetyCheckinSafe(id: number) {
  return api.post<{ ok: true; checkin: SafetyCheckin }>(`/api/member/safety-checkins/${id}/safe`);
}

export function cancelSafetyCheckin(id: number) {
  return api.post<{ ok: true }>(`/api/member/safety-checkins/${id}/cancel`);
}
