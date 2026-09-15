import { api } from "./client";

// AI-drafted message starters (premium roadmap, next step after Safety
// Check-In). Premium-gated (402 - see profile_is_premium() gating on
// member_conversation_message_starters() in main.py, same pattern as the AI
// Family Advisor). Given a conversation the caller is actually part of,
// asks Claude for 3 short opening-message drafts built from already-public
// profile context on both sides (never anything the peer hasn't already
// shown in Catalog). Stateless - nothing is persisted, these are disposable
// drafts the member reviews/edits before sending themselves.
export function fetchMessageStarters(conversationId: number, locale: string) {
  return api.post<{ ok: true; starters: string[] }>(
    `/api/member/conversations/${conversationId}/message-starters?locale=${encodeURIComponent(locale)}`
  );
}
