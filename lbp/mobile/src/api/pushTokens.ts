import { api } from "./client";

// Item 16 - push notifications. Registers/unregisters this device's Expo
// push token against the signed-in member (see member_register_push_token/
// member_unregister_push_token in main.py) - NOT Premium-gated, unlike the
// AI Advisor endpoints, since the events this powers (new message/like/
// match/visitor) are the same free-tier ones already emailed to everyone.
// Actual delivery happens server-side via send_expo_push(), triggered from
// the existing send_profile_notification() call sites - registering a
// token here does nothing on its own until one of those events fires.
export function registerPushToken(token: string, platform?: string) {
  return api.post<{ ok: true }>("/api/member/push-tokens", { token, platform });
}

export function unregisterPushToken(token: string) {
  return api.delete<{ ok: true }>("/api/member/push-tokens", { token });
}
