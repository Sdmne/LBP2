// Item 13(a) - Alena: "давай сделаем больше набор смайликов" (bigger emoji
// set) - the chat's emoji picker only had ~16 hardcoded emoji in one flat
// row. Rather than pulling in a new emoji-keyboard library (most bundle
// their own large JSON data files and a few reach for native modules for
// search/skin-tone support - not worth the risk of needing another
// `eas build`, the exact problem this session already spent hours on
// once), this is a hand-picked, categorized set using the same plain
// Text-rendering approach the old QUICK_EMOJI row already used - just
// more of them, organized like a normal emoji keyboard's category
// sections instead of one long row.
export type EmojiCategory = {
  key: string;
  labelKey: string;
  emojis: string[];
};

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    key: "smileys",
    labelKey: "chat.emojiCategorySmileys",
    emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😋", "😛", "🤪", "😜"],
  },
  {
    key: "gestures",
    labelKey: "chat.emojiCategoryGestures",
    emojis: ["👍", "👎", "👏", "🙌", "👐", "🤝", "🙏", "✌️", "🤞", "🤟", "🤙", "💪", "👋", "🤚", "✋", "👌", "🤌", "👆", "👇", "☝️"],
  },
  {
    key: "hearts",
    labelKey: "chat.emojiCategoryHearts",
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝"],
  },
  {
    key: "animals",
    labelKey: "chat.emojiCategoryAnimals",
    emojis: ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🦄", "🐢"],
  },
  {
    key: "food",
    labelKey: "chat.emojiCategoryFood",
    emojis: ["🍏", "🍎", "🍌", "🍇", "🍓", "🍒", "🍑", "🥝", "🍅", "🍕", "🍔", "🍟", "🌭", "🍿", "🍩", "🍪", "🎂", "🍰", "🍫", "🍭"],
  },
  {
    key: "celebration",
    labelKey: "chat.emojiCategoryCelebration",
    emojis: ["🎉", "🎊", "🎈", "🎁", "🎀", "🏆", "⚽", "🏀", "🎮", "🎲", "🎵", "🎸", "🎨", "✨", "🔥", "💯"],
  },
  // Split out of the old catch-all "objects" category (Sept 2026): Alena
  // asked for more kids/baby-themed emoji ("больше детских надо добавить
  // смайлов") after noticing how thin this app's one baby-ish category
  // was (14 items, half of them not even baby-related - a phone, a
  // lightbulb, a camera, money). Given what this app actually is (donor
  // conception / co-parenting), a real "Family & Baby" category earns its
  // own tab rather than being a few items buried in "Objects".
  {
    key: "family",
    labelKey: "chat.emojiCategoryFamily",
    emojis: [
      "👶", "🍼", "🧸", "🚼", "🎀", "🧦", "👗", "🩱", "🪁", "🎠", "🦄", "🐣", "🐥",
      "🦋", "🌈", "☀️", "⭐", "🌙", "💤", "🤰", "🤱", "👼", "🍭", "🍬", "🎂", "🎈",
    ],
  },
  {
    key: "objects",
    labelKey: "chat.emojiCategoryObjects",
    emojis: ["🚗", "✈️", "📱", "💡", "📷", "💰", "💻", "⌚", "📖", "🔑", "🎬", "🎤"],
  },
];
