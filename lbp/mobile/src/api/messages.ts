import { api } from "./client";
import type { ConversationMessage, ConversationSummary } from "./types";

export function fetchConversations() {
  return api.get<{ items: ConversationSummary[] }>("/api/member/conversations");
}

// POST /api/member/conversations - member_create_conversation() in main.py.
// Finds/creates the conversation with targetProfileId and returns its id;
// the caller is (verified) required, and a "cold" chat (messaging someone
// with no mutual match) additionally needs the sender to be Premium and
// under their daily cold-chat limit - surfaced as 402/429 the same way the
// website's CatalogProfile page handles them (see main.py's comments).
export function createConversation(targetProfileId: number | string) {
  return api.post<{ ok: true; conversationId: number; existing: boolean; cold: boolean }>(
    "/api/member/conversations",
    { targetProfileId },
  );
}

export function fetchMessages(conversationId: number) {
  return api.get<{ items: ConversationMessage[]; markedReadCount?: number }>(
    `/api/member/conversations/${conversationId}/messages`,
  );
}

// member_send_message() in main.py replies with {"ok": true, "message": {id,
// conversationId, senderProfileId, body}} - NOT a bare ConversationMessage,
// and notably the nested "message" doesn't carry mediaUrl/created_at/
// deliveredAt/readAt/status (the full row shape only comes back from the
// GET .../messages list). Callers that want to show the sent message right
// away need to fill in those remaining fields themselves.
export function sendMessage(conversationId: number, body: string) {
  return api.post<{ ok: true; message: Pick<ConversationMessage, "id" | "conversationId" | "senderProfileId" | "body"> }>(
    `/api/member/conversations/${conversationId}/messages`,
    { body },
  );
}
