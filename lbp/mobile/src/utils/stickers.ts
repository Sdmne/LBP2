import { STICKERS } from "../data/stickerData";

// Sticker messages travel as plain text with this prefix rather than a new
// conversation_messages column - that table has no "type" field at all
// (see member_send_message/member_send_attachment in main.py, both just
// use body/media_url), so this avoids a schema migration the same way the
// AI Advisor/push-token features did this session. The server (not the
// client) builds this exact string in member_send_sticker - a client
// can't forge a sticker message just by typing this prefix into a normal
// text message, since ChatScreen only uses it for DISPLAY (looking up
// which emoji to render big), never as an access or gating decision.
const STICKER_PREFIX = "::sticker::";

export function stickerBody(stickerId: string): string {
  return `${STICKER_PREFIX}${stickerId}`;
}

// Returns the emoji to render big for a sticker message, or null if this
// body isn't a (recognized) sticker - callers fall back to rendering the
// body as normal text in that case, so an unrecognized/future sticker id
// degrades to plain text instead of disappearing.
export function stickerEmojiFromBody(body: string | null | undefined): string | null {
  if (!body || !body.startsWith(STICKER_PREFIX)) return null;
  const id = body.slice(STICKER_PREFIX.length);
  return STICKERS.find((s) => s.id === id)?.emoji ?? null;
}
