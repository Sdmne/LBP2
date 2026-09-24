import React, { useMemo } from "react";
import { Dimensions, ImageBackground, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "../theme";

// Alena: "фон в сообщениях я имела ввиду как типа в телеграме) но на
// детскую тему... с рисунками. а фон белый" - a white background with a
// repeating pattern of small icons, Telegram-wallpaper style. The
// prototype's own chat background is two layered SVG radial-gradient dot
// patterns, and there's no SVG library in this project (see the comment
// this replaced in ChatScreen.tsx) - adding one (react-native-svg) means
// native code, which means another `eas build` before it could ever reach
// the phone, the exact multi-hour problem this session already spent on
// once. This gets the same "wallpaper, not a flat color" effect with zero
// new dependencies: a fixed, memoized grid of low-opacity icons, laid out
// once per screen size rather than recomputed per render.
//
// UPDATE (Sept 2026): Alena picked "large, sparse drawings" out of 5
// monochrome options ("не цветные" - the original emoji version read as
// colorful even at low opacity, since emoji glyphs are always full-color
// and can't be tinted). Switched to MaterialCommunityIcons outline glyphs
// (a single gray tone via `color`, same as any other icon in the app) for
// genuinely monochrome icons, picked her 4 named items specifically
// (teddy bear / stroller / balloon / bow) rather than the full original
// 8-icon set, and roughly doubled both the icon size and the spacing
// between them for the "bigger and airier, not so tight" look she asked
// for.
// UPDATE (Sept 2026, item 11): Alena later sent an actual finished
// wallpaper image (a scattered rainbow/sun/cloud/heart pattern on white -
// "Сделать оба, с выбором", she wants several backgrounds with a picker,
// starting with this one; a matching cloud+star image is still pending
// from her). Unlike the icon-grid pattern above, this is a real bundled
// image asset - that's fine with zero native-build risk (require()'ing a
// bundled PNG is a normal JS/Metro asset, not a native module, unlike the
// SVG-library problem the icon-grid comment above was avoiding). Rendered
// with resizeMode "cover" rather than tiled/repeated since the source
// image hasn't been confirmed seamless at the edges.
//
// UPDATE (Sept 2026, item 12): Alena - "добавь сюда штук 10 еще других
// фонов" (add ~10 more backgrounds here). A real bundled image like
// rainbow.png needs her to actually supply the artwork (still only one
// existed at the time), so these ten reused the icon-grid mechanism as a
// placeholder - just a different MaterialCommunityIcons set + tint color
// per theme, no new assets needed yet.
//
// UPDATE (Sept 23): Alena sent the real artwork - "вот новые фоны. Те что
// ты недавно добавил кроме первых 2х убери" (here are the real
// backgrounds; remove the ones you recently added except the first 2).
// Dropped clouds/flowers/animals/sweets/night/nature/party/garden (kept
// hearts/stars, the first 2 of that batch), and replaced the removed
// eight with these 10 real bundled images instead. Generalized the old
// "rainbow is the one special image variant" handling below into
// WALLPAPER_IMAGES so adding a real-image variant is just one map entry,
// not a second special case.
//
// UPDATE (2026-09-24): Alena, after seeing all 10 real photo backgrounds
// in the picker - "фоны есть но те 2 надо убрать 3 и 4й" (the backgrounds
// are there, but remove those 2 - the 3rd and 4th), i.e. "Hearts" and
// "Stars" (positions 3/4 in the picker, right after Pattern/Rainbow).
// Those were the icon-grid placeholders kept from the original 4-option
// set precisely because real artwork didn't exist yet for the rest - now
// that it does, and there's no icon-grid "Hearts"/"Stars" artwork of
// their own, she wants them gone rather than left as odd ones out among
// 10 real photos. "Pattern" stays (it's a deliberate style, not a
// placeholder - the grey icon-grid IS the intended look for that option).
// A previously-saved "hearts"/"stars" choice degrades safely: ChatScreen's
// AsyncStorage load only accepts a value still in CHAT_WALLPAPER_VARIANTS,
// so it silently falls back to the "rainbow" default instead of erroring.
export type ChatWallpaperVariant =
  | "pattern"
  | "rainbow"
  | "babyBears"
  | "heartsBlush"
  | "babyBlue"
  | "sleepyClouds"
  | "bunnies"
  | "rainbowSun"
  | "moonStars"
  | "flowersPeach"
  | "whales"
  | "blossomPink";

export const CHAT_WALLPAPER_VARIANTS: ChatWallpaperVariant[] = [
  "pattern",
  "rainbow",
  "babyBears",
  "heartsBlush",
  "babyBlue",
  "sleepyClouds",
  "bunnies",
  "rainbowSun",
  "moonStars",
  "flowersPeach",
  "whales",
  "blossomPink",
];

// Every real bundled-image variant (as opposed to the icon-grid pattern
// themes in ICON_THEMES below). Rendered full-bleed with resizeMode
// "cover" - same treatment "rainbow" always had - since none of these
// have been confirmed seamless-tileable at the edges either.
const WALLPAPER_IMAGES: Partial<Record<ChatWallpaperVariant, ReturnType<typeof require>>> = {
  rainbow: require("../../assets/chat-backgrounds/rainbow.png"),
  babyBears: require("../../assets/chat-backgrounds/baby-bears.png"),
  heartsBlush: require("../../assets/chat-backgrounds/hearts-blush.png"),
  babyBlue: require("../../assets/chat-backgrounds/baby-blue.png"),
  sleepyClouds: require("../../assets/chat-backgrounds/sleepy-clouds.png"),
  bunnies: require("../../assets/chat-backgrounds/bunnies.png"),
  rainbowSun: require("../../assets/chat-backgrounds/rainbow-sun.png"),
  moonStars: require("../../assets/chat-backgrounds/moon-stars.png"),
  flowersPeach: require("../../assets/chat-backgrounds/flowers-peach.png"),
  whales: require("../../assets/chat-backgrounds/whales.png"),
  blossomPink: require("../../assets/chat-backgrounds/blossom-pink.png"),
};

// Used by ChatScreen.tsx's picker sheet to render a real thumbnail for
// any image-backed variant, instead of hardcoding the "rainbow" case.
export function wallpaperImageSource(variant: ChatWallpaperVariant): ReturnType<typeof require> | null {
  return WALLPAPER_IMAGES[variant] ?? null;
}
// UPDATE (Sept 2026): Alena, after using it while actually chatting:
// "можно сделать фон на сообщениях прозрачный чтобы не отвлекал" - the
// full-opacity rainbow image was too visually loud once real message
// bubbles sat on top of it. Faded via ImageBackground's own `imageStyle`
// (which styles only the inner <Image>, not children) rather than the
// container's `style`/opacity, so the message bubbles/input bar layered
// on top stay fully opaque - only the wallpaper itself washes out toward
// the white container background behind it. Applied to every image
// variant added since (Sept 23), same reasoning.
const WALLPAPER_IMAGE_OPACITY = 0.32;

// Only "pattern" is still an icon-grid theme now (hearts/stars removed
// 2026-09-24 - see the update above; every other variant is a real image
// in WALLPAPER_IMAGES).
type IconThemeKey = "pattern";
type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

type IconTheme = {
  icons: IconName[];
  color: string;
};

const ICON_THEMES: Record<IconThemeKey, IconTheme> = {
  pattern: { icons: ["teddy-bear", "baby-carriage", "balloon", "ribbon"], color: colors.line },
};

function isIconThemeKey(variant: ChatWallpaperVariant): variant is IconThemeKey {
  return variant === "pattern";
}

// Used by the wallpaper picker sheet (ChatScreen.tsx) to render each
// option's thumbnail without duplicating the icon/color choices above.
// Returns null for any image-backed variant (wallpaperImageSource above
// covers those instead).
export function wallpaperThemeIcon(variant: ChatWallpaperVariant): { icon: IconName; color: string } | null {
  if (!isIconThemeKey(variant)) return null;
  const theme = ICON_THEMES[variant];
  return { icon: theme.icons[0], color: theme.color };
}

const ICON_SIZE = 36;
const CELL_SIZE = 130;
const ICON_OPACITY = 0.5;

type Cell = { icon: IconName; left: number; top: number; rotate: number };

function buildGrid(width: number, height: number, icons: IconName[]): Cell[] {
  const cols = Math.ceil(width / CELL_SIZE) + 1;
  const rows = Math.ceil(height / CELL_SIZE) + 1;
  const cells: Cell[] = [];
  let i = 0;
  for (let row = 0; row < rows; row++) {
    const rowOffset = row % 2 === 0 ? 0 : CELL_SIZE / 2;
    for (let col = 0; col < cols; col++) {
      const icon = icons[i % icons.length];
      // Deterministic pseudo-variation (not Math.random) so the pattern
      // doesn't visibly shift/flicker on re-render.
      const rotate = ((i * 37) % 40) - 20;
      cells.push({ icon, left: col * CELL_SIZE + rowOffset, top: row * CELL_SIZE, rotate });
      i++;
    }
  }
  return cells;
}

export default function ChatWallpaper({
  children,
  style,
  // Default changed to "rainbow" (Sept 2026): Alena confirmed the
  // rainbow image IS her chosen wallpaper ("я же присылала какой точно с
  // радугой файлом") after seeing the app still default to the older
  // grey icon-grid pattern (her very first, since-superseded choice from
  // before she supplied real artwork). The icon pattern stays available
  // as one of the picker options, just no longer the default for people
  // who haven't picked one yet.
  variant = "rainbow",
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: ChatWallpaperVariant;
}) {
  const { width, height } = Dimensions.get("window");
  const imageSource = WALLPAPER_IMAGES[variant];
  const theme = imageSource ? null : ICON_THEMES[variant as IconThemeKey] ?? ICON_THEMES.pattern;
  const cells = useMemo(() => (theme ? buildGrid(width, height, theme.icons) : []), [width, height, theme]);

  if (imageSource) {
    return (
      <ImageBackground
        source={imageSource}
        resizeMode="cover"
        style={[styles.container, style]}
        imageStyle={styles.wallpaperImage}
      >
        {children}
      </ImageBackground>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {cells.map((cell, index) => (
          <MaterialCommunityIcons
            key={index}
            name={cell.icon}
            size={ICON_SIZE}
            color={theme!.color}
            style={[
              styles.icon,
              { left: cell.left, top: cell.top, transform: [{ rotate: `${cell.rotate}deg` }] },
            ]}
          />
        ))}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  wallpaperImage: { opacity: WALLPAPER_IMAGE_OPACITY },
  icon: { position: "absolute", opacity: ICON_OPACITY },
});
