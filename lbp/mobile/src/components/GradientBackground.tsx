import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

// Prototype's .screen.gradient-bg / .screen.gradient-bg.vivid (see
// lbp-prototype-source.html's <style> block). Most screens in the
// prototype sit on one of these two soft gradient backgrounds instead of
// a flat color - this was the single biggest visual gap Alena kept
// flagging as "doesn't look like the prototype at all", bigger than any
// individual icon/color mismatch: a huge fraction of the app was still on
// theme.colors.bg (flat #fafafa) with no gradient at all.
//
// RN's LinearGradient can't reproduce the prototype's *exact* look (three
// stacked radial-gradient blobs behind a linear base, for "soft") - that
// needs SVG/radial gradients this library doesn't do. "soft" here is a
// 3-stop diagonal LinearGradient approximating the same pink -> lavender
// -> pale-blue sweep the radial blobs produce; "vivid" (.gradient-bg.vivid,
// used on Browse/ProfileDetail/Matched/Likes) IS a plain CSS
// linear-gradient(155deg, ...) in the prototype, so that one is exact.
//
// Usage: wrap a screen's whole return value, e.g.
//   <GradientBackground variant="vivid"><ScrollView ...>...</ScrollView></GradientBackground>
type Props = {
  variant: "soft" | "vivid";
  style?: ViewStyle;
  children: React.ReactNode;
};

export default function GradientBackground({ variant, style, children }: Props) {
  if (variant === "vivid") {
    // Prototype: linear-gradient(155deg,#d199c4 0%,#a385ec 45%,#97b6ec 100%)
    return (
      <LinearGradient
        colors={["#d199c4", "#a385ec", "#97b6ec"]}
        locations={[0, 0.45, 1]}
        start={{ x: 0.29, y: 0.05 }}
        end={{ x: 0.71, y: 0.95 }}
        style={[styles.flex, style]}
      >
        {children}
      </LinearGradient>
    );
  }
  // Prototype: three radial blobs (pink top-left, purple top-right, blue
  // bottom-center) over a linear(#f4eefb -> #eaf1ff) base, blurred 2px.
  return (
    <LinearGradient
      colors={["#fbdce8", "#e4d9f5", "#dcebf9"]}
      locations={[0, 0.5, 1]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.6, y: 1 }}
      style={[styles.flex, style]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
