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
// exists), so these ten reuse the exact same zero-native-risk icon-grid
// mechanism as the original "pattern" variant above - just a different
// MaterialCommunityIcons set + tint color per theme. No new assets, no
// native module, so this ships as a plain JS change (no new `eas build`
// required just for this).
export type ChatWallpaperVariant =
  | "pattern"
  | "rainbow"
  | "hearts"
  | "stars"
  | "clouds"
  | "flowers"
  | "animals"
  | "sweets"
  | "night"
  | "nature"
  | "party"
  | "garden";

export const CHAT_WALLPAPER_VARIANTS: ChatWallpaperVariant[] = [
  "pattern",
  "rainbow",
  "hearts",
  "stars",
  "clouds",
  "flowers",
  "animals",
  "sweets",
  "night",
  "nature",
  "party",
  "garden",
];

const RAINBOW_IMAGE = require("../../assets/chat-backgrounds/rainbow.png");
// UPDATE (Sept 2026): Alena, after using it while actually chatting:
// "можно сделать фон на сообщениях прозрачный чтобы не отвлекал" - the
// full-opacity image was too visually loud once real message bubbles sat
// on top of it. Faded via ImageBackground's own `imageStyle` (which styles
// only the inner <Image>, not children) rather than the container's
// `style`/opacity, so the message bubbles/input bar layered on top stay
// fully opaque - only the wallpaper itself washes out toward the white
// container background behind it.
const RAINBOW_OPACITY = 0.32;

type IconThemeKey = Exclude<ChatWallpaperVariant, "rainbow">;
type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

type IconTheme = {
  icons: IconName[];
  color: string;
};

// Every non-"rainbow" variant is one of these: a distinct icon set plus a
// tint color from the app's existing palette (theme.ts) - no new colors
// invented, just reused the way every other screen already does.
const ICON_THEMES: Record<IconThemeKey, IconTheme> = {
  pattern: { icons: ["teddy-bear", "baby-carriage", "balloon", "ribbon"], color: colors.line },
  hearts: { icons: ["heart-outline", "heart-multiple-outline"], color: colors.pink },
  stars: { icons: ["star-outline", "star-four-points-outline", "creation"], color: colors.premium },
  clouds: { icons: ["weather-cloudy", "weather-sunny", "weather-partly-cloudy"], color: colors.blue },
  flowers: { icons: ["flower-outline", "flower-tulip-outline", "flower-poppy"], color: colors.pinkSoft },
  animals: { icons: ["paw", "cat", "dog-side", "rabbit"], color: colors.blueDark },
  sweets: { icons: ["cupcake", "candy-outline", "ice-cream"], color: colors.pink },
  night: { icons: ["weather-night", "star-outline", "moon-waning-crescent"], color: colors.muted },
  nature: { icons: ["leaf", "tree-outline", "sprout-outline"], color: colors.success },
  party: { icons: ["gift-outline", "kite", "pinwheel-outline"], color: colors.premium },
  garden: { icons: ["butterfly-outline", "bee-flower", "flower"], color: colors.success },
};

// Used by the wallpaper picker sheet (ChatScreen.tsx) to render each
// option's thumbnail without duplicating the icon/color choices above.
// Returns null for "rainbow" - that one has a real image thumbnail
// instead of an icon.
export function wallpaperThemeIcon(variant: ChatWallpaperVariant): { icon: IconName; color: string } | null {
  if (variant === "rainbow") return null;
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
  const theme = variant === "rainbow" ? null : ICON_THEMES[variant] ?? ICON_THEMES.pattern;
  const cells = useMemo(() => (theme ? buildGrid(width, height, theme.icons) : []), [width, height, theme]);

  if (variant === "rainbow") {
    return (
      <ImageBackground
        source={RAINBOW_IMAGE}
        resizeMode="cover"
        style={[styles.container, style]}
        imageStyle={styles.rainbowImage}
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
  rainbowImage: { opacity: RAINBOW_OPACITY },
  icon: { position: "absolute", opacity: ICON_OPACITY },
});
