// Item 13(b) - Premium-exclusive chat stickers. Alena chose to start with
// emoji placeholders (large glyphs in a colored badge, see ChatScreen.tsx's
// sticker grid) rather than wait on real custom artwork - swapping in real
// sticker images later only means changing this catalog (and how
// ChatScreen renders a sticker bubble); the premium-gating and message
// plumbing built around it (member_send_sticker in main.py) doesn't
// change. Ids and emoji here must match backend/main.py's STICKER_CATALOG
// exactly - kept in sync by hand since there are only 16.
export type StickerDef = { id: string; emoji: string };

export const STICKERS: StickerDef[] = [
  { id: "party", emoji: "🎉" },
  { id: "heart", emoji: "❤️" },
  { id: "baby", emoji: "👶" },
  { id: "bump", emoji: "🤰" },
  { id: "laugh", emoji: "😂" },
  { id: "thumbsup", emoji: "👍" },
  { id: "thanks", emoji: "🙏" },
  { id: "confetti", emoji: "🎊" },
  { id: "flowers", emoji: "💐" },
  { id: "bottle", emoji: "🍼" },
  { id: "teddy", emoji: "🧸" },
  { id: "star", emoji: "🌟" },
  { id: "cheers", emoji: "🥳" },
  { id: "love", emoji: "😍" },
  { id: "hug", emoji: "🤗" },
  { id: "sparkles", emoji: "✨" },
  // Added Sept 2026 alongside the expanded "Family & Baby" emoji category
  // (Alena: "И в премиум стикеры" - more stickers for the Premium-only
  // tab, same request that prompted the bigger emoji set). Same rule as
  // the original 16: ids/emoji here must match backend/main.py's
  // STICKER_CATALOG exactly.
  { id: "unicorn", emoji: "🦄" },
  { id: "butterfly", emoji: "🦋" },
  { id: "balloon", emoji: "🎈" },
  { id: "gift", emoji: "🎁" },
  { id: "cake", emoji: "🎂" },
  { id: "wave", emoji: "👋" },
  { id: "kiss", emoji: "😘" },
  { id: "clap", emoji: "👏" },
  { id: "rainbow", emoji: "🌈" },
  { id: "moon", emoji: "🌙" },
];
