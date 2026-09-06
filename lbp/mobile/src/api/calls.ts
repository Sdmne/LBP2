import { api } from "./client";
import type { CallInfo, CallKind } from "./types";

// POST /api/member/conversations/{id}/calls - member_start_call() in main.py.
// Requires: caller is Premium, the other member is verified AND Premium too
// (see the comments in main.py - it's a hard 409/402 there, not just a UI
// nicety, so the screen has to handle those specific statuses).
export function startCall(conversationId: number, callType: CallKind) {
  return api.post<{ ok: true; call: CallInfo }>(`/api/member/conversations/${conversationId}/calls`, { callType });
}

// GET /api/member/calls/incoming - member_incoming_calls() in main.py. Meant
// to be polled (the web app polls it every 3s via CallManager) - there's no
// websocket/push for this in the backend yet.
export function fetchIncomingCalls() {
  return api.get<{ items: CallInfo[] }>("/api/member/calls/incoming");
}

export function fetchCallStatus(callId: number) {
  return api.get<{ call: CallInfo }>(`/api/member/calls/${callId}`);
}

export function acceptCall(callId: number) {
  return api.post<{ ok: true; call: CallInfo }>(`/api/member/calls/${callId}/accept`);
}

export function declineCall(callId: number) {
  return api.post<{ ok: true }>(`/api/member/calls/${callId}/decline`);
}

export function endCall(callId: number) {
  return api.post<{ ok: true }>(`/api/member/calls/${callId}/end`);
}
