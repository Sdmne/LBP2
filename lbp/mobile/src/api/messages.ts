import { API_BASE_URL } from "../config";
import { getSessionToken } from "./session";
import { ApiError, api, localFileToBlob } from "./client";
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
  // The backend's Pydantic model declares targetProfileId as a plain str
  // (see main.py's ConversationCreate), so a bare number here - which is
  // exactly what every caller passes, since profile.id is a number - fails
  // FastAPI's request validation with a 422 before member_create_conversation
  // ever runs: {"detail":[{"type":"string_type","loc":["body",
  // "targetProfileId"],"msg":"Input should be a valid string", ...}]}.
  // That 422 isn't one of the specific codes any caller's catch block
  // checks for (402/429/403/404), so it fell through to a generic
  // "Something went wrong"/"Couldn't start this chat" - this was the real
  // cause of every "can't message from this screen" report, not a server
  // bug. Coercing to String() here fixes it for every caller at once.
  return api.post<{ ok: true; conversationId: number; existing: boolean; cold: boolean }>(
    "/api/member/conversations",
    { targetProfileId: String(targetProfileId) },
  );
}

export function fetchMessages(conversationId: number) {
  return api.get<{ items: ConversationMessage[]; markedReadCount?: number }>(
    `/api/member/conversations/${conversationId}/messages`,
  );
}

// GET .../peer-profile - member_conversation_peer_profile() in main.py.
// ChatScreen only gets a conversationId + display title from its route
// params (see RootNavigator), not the other person's actual profile id -
// this is the one call that gets it, so the header's Report/Block menu
// (added alongside the attachment/emoji buttons below, matching Alena's
// request) has something real to act on.
export function fetchConversationPeerProfile(conversationId: number) {
  return api.get<{ profileId: string }>(`/api/member/conversations/${conversationId}/peer-profile`);
}

// DELETE /api/member/conversations/{id} - member_hide_conversation() in
// main.py. Despite the verb, this is a per-member hide (INSERT INTO
// conversation_hidden), not a real delete - the conversation reappears for
// the other person and comes back for this member too the moment a new
// message arrives (see that handler's own DELETE FROM conversation_hidden
// on send). Close enough to "delete this chat" from the member's own
// point of view, which is the only thing the UI promises.
export function deleteConversation(conversationId: number) {
  return api.delete<{ ok: true }>(`/api/member/conversations/${conversationId}`);
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

// POST .../attachments - member_send_attachment() in main.py. Real, was
// already built on the backend (image + PDF, with the same moderation
// pass profile photos go through) but nothing on mobile called it - the
// paperclip button in the prototype's #scr-chat (.chat-input-bar .clip)
// had no wired-up counterpart here. Mirrors photos.ts's uploadPhoto: force
// the multipart part's Content-Type from the file's own extension rather
// than trusting fetch(uri).blob().type, which is what turned out to be
// unreliable on picker URIs there.
type UploadAttachmentResponse = {
  ok: true;
  message: Pick<ConversationMessage, "id" | "conversationId" | "senderProfileId" | "body"> & { mediaUrl: string | null };
};

export async function sendAttachment(conversationId: number, localUri: string): Promise<ConversationMessage> {
  const filename = localUri.split("/").pop() || `attachment-${Date.now()}.jpg`;
  const match = /\.(\w+)$/.exec(filename);
  const ext = match ? match[1].toLowerCase() : "jpg";
  const mime =
    ext === "pdf" ? "application/pdf" : ext === "webp" ? "image/webp" : ext === "png" ? "image/png" : "image/jpeg";

  const formData = new FormData();
  const rawBlob = await localFileToBlob(localUri);
  const blob = rawBlob.type && rawBlob.type === mime ? rawBlob : rawBlob.slice(0, rawBlob.size, mime);
  formData.append("file", blob, filename);

  const token = getSessionToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/member/conversations/${conversationId}/attachments`, {
      method: "POST",
      headers,
      body: formData,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(0, "Upload timed out - check your connection and try again.");
    }
    const detail = err instanceof Error && err.message ? ` (${err.message})` : "";
    throw new ApiError(0, `Network error during upload - check your connection and try again.${detail}`);
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new ApiError(response.status, message || `Upload failed (${response.status})`);
  }
  const res = (await response.json()) as UploadAttachmentResponse;
  return {
    id: res.message.id,
    conversationId: res.message.conversationId,
    senderProfileId: res.message.senderProfileId,
    body: res.message.body,
    mediaUrl: res.message.mediaUrl,
    created_at: new Date().toISOString(),
    deliveredAt: null,
    readAt: null,
    status: "ACTIVE",
  };
}
