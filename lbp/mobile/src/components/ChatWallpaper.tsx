import React, { useMemo } from "react";
import { Dimensions, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
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
const ICON_NAMES: (keyof typeof MaterialCommunityIcons.glyphMap)[] = [
  "teddy-bear",
  "baby-carriage",
  "balloon",
  "ribbon",
];
const ICON_SIZE = 36;
const CELL_SIZE = 130;
const ICON_COLOR = colors.line;
const ICON_OPACITY = 0.5;

type Cell = { icon: (typeof ICON_NAMES)[number]; left: number; top: number; rotate: number };

function buildGrid(width: number, height: number): Cell[] {
  const cols = Math.ceil(width / CELL_SIZE) + 1;
  const rows = Math.ceil(height / CELL_SIZE) + 1;
  const cells: Cell[] = [];
  let i = 0;
  for (let row = 0; row < rows; row++) {
    const rowOffset = row % 2 === 0 ? 0 : CELL_SIZE / 2;
    for (let col = 0; col < cols; col++) {
      const icon = ICON_NAMES[i % ICON_NAMES.length];
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
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { width, height } = Dimensions.get("window");
  const cells = useMemo(() => buildGrid(width, height), [width, height]);

  return (
    <View style={[styles.container, style]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {cells.map((cell, index) => (
          <MaterialCommunityIcons
            key={index}
            name={cell.icon}
            size={ICON_SIZE}
            color={ICON_COLOR}
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
  icon: { position: "absolute", opacity: ICON_OPACITY },
});
