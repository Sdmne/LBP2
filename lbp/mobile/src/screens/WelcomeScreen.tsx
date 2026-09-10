import React, { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import type { RootStackParamList } from "../navigation/RootNavigator";
import AuthMethodSheet from "../components/AuthMethodSheet";

type Props = NativeStackScreenProps<RootStackParamList, "Welcome">;

// Mirrors the prototype's scr-welcome (a full-bleed looping video behind
// the logo/tagline/buttons, plus a dark scrim gradient for text legibility -
// see .welcome-bg / .welcome-scrim in
// "Claude outputs/app-prototype-inline.html"). Decoded the video out of the
// prototype's own inline base64 data: URI to assets/welcome-hero.mp4 (see
// the git history of this file / mobile/README.md for that story).
//
// UPDATE (Sept 2026, same day): the first version of this screen used
// `expo-av`'s <Video>. Alena reported the app crashes on launch after that
// build. `expo-av` has been on Expo's own deprecation path since around
// SDK 52 (superseded by `expo-video`/`expo-audio`) and is a known source of
// New-Architecture crashes on newer SDKs - since this is the very first
// screen an unauthenticated user sees, a native crash in its video module
// would surface exactly as "crashes on launch" with no JS stack trace to
// go on. Rather than debug a deprecated library blind, switched to
// `expo-video` - the current, actively-maintained, New-Architecture-safe
// replacement Expo itself recommends for this exact "looping muted
// background video" use case.
//
// Needs `expo-video` as a dependency (not `expo-av` - remove that one, its
// native module being linked in at all could itself be what's crashing,
// independent of whether any JS code still renders its <Video>). From a
// real terminal with network access, before the next build:
//   npm uninstall expo-av
//   npx expo install expo-video
// This session's sandbox still has no npm registry access to do this step
// itself (confirmed multiple times today) - see mobile/README.md for the
// full rebuild instructions.
//
// RN's cover-fit center-crops like CSS object-fit:cover, but has no
// equivalent of the prototype's `object-position:50% 35%` (slightly
// favoring the upper part of the frame) - no focal-point option for cover
// here either, so the crop is plain-centered. Close enough for a small
// stock loop.
//
// UPDATE (Sept 2026): the prototype's intermediate "Continue with Email /
// Continue with Google" bottom sheet - previously skipped as a redundant
// extra tap since Login/Signup already had their own Google/Apple buttons
// - is real after all (Alena sent the actual prototype screenshot asking
// for it specifically). Both buttons below now open AuthMethodSheet
// instead of navigating straight to the form; the sheet's own "Continue
// with Email" is what does the actual navigation.
//
// UPDATE (Sept 2026): Alena flagged this screen (and others) as visibly off
// from the prototype despite the structural comment above being accurate -
// turned out the actual CSS values had drifted. Re-checked scr-welcome's
// real rules directly against "Claude outputs/app-prototype-inline.html"
// and fixed three concrete mismatches: the buttons were a white pill +
// outline pill with pink/white text (should be a blue->pink gradient pill
// and a flat pink pill, both with WHITE text - .welcome-btn.grad /
// .welcome-btn.solid), the logo was 120px square (prototype's
// .welcome-logo.real-logo img is 250px wide - now 220 to leave a little
// more breathing room against the tighter safe-area top inset RN adds),
// and the content padding was 56/24/24 instead of the prototype's
// 36/26/30. Lesson for the rest of the screen-by-screen pass: verify
// against the prototype's actual computed CSS values, not just structural
// similarity.
export default function WelcomeScreen({ navigation }: Props) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [sheetIntent, setSheetIntent] = useState<"login" | "register" | null>(null);

  const player = useVideoPlayer(require("../../assets/welcome-hero.mp4"), (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <View style={styles.flex}>
      <VideoView
        style={StyleSheet.absoluteFill}
        player={player}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
      />

      {/* Dark scrim gradient over the video for text legibility - matches
          the prototype's .welcome-scrim (the later, darker !important
          override, which is the one that actually renders). */}
      <LinearGradient
        colors={["rgba(2,8,23,0.5)", "rgba(2,8,23,0.32)", "rgba(2,8,23,0.4)", "rgba(2,8,23,0.8)"]}
        locations={[0, 0.3, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.content, { paddingBottom: spacing.lg + insets.bottom }]}>
        <View style={styles.logoWrap}>
          <Image source={require("../../assets/logo-full.png")} style={styles.logo} resizeMode="contain" />
        </View>

        <View style={styles.spacer} />

        <Text style={styles.tagline}>{t("welcome.tagline")}</Text>

        <Pressable style={styles.btn} onPress={() => setSheetIntent("register")}>
          <LinearGradient
            colors={[colors.blue, colors.pinkSoft]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.btnFill}
          >
            <Text style={styles.btnText}>{t("welcome.createAccount")}</Text>
          </LinearGradient>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnSolidPink]} onPress={() => setSheetIntent("login")}>
          <Text style={styles.btnText}>{t("welcome.haveAccount")}</Text>
        </Pressable>

        <Pressable onPress={() => navigation.navigate("Terms")} hitSlop={8}>
          <Text style={styles.terms}>{t("welcome.terms")}</Text>
        </Pressable>
      </View>

      <AuthMethodSheet
        visible={sheetIntent !== null}
        intent={sheetIntent === "login" ? "login" : "register"}
        onClose={() => setSheetIntent(null)}
        onContinueWithEmail={() => {
          const target = sheetIntent;
          setSheetIntent(null);
          navigation.navigate(target === "login" ? "Login" : "Signup");
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.ink },
  // Prototype's .welcome-content padding is 36px 26px 30px.
  content: { flex: 1, paddingHorizontal: 26, paddingTop: 36, paddingBottom: spacing.lg },
  logoWrap: { alignItems: "center", marginTop: spacing.sm },
  // Prototype's .welcome-logo.real-logo img is 250px wide, transparent PNG
  // with the real "Let's BeParents" wordmark baked in (extracted from the
  // prototype's own inline base64 - see logo-full.png) and just a
  // drop-shadow filter, no card/background behind it at all. No
  // borderRadius/backgroundColor here - those were wrapping the OLD
  // icon-only asset (which has an opaque white square baked into its own
  // pixels) in a second, redundant white box.
  logo: {
    width: 250,
    height: 174, // real aspect ratio of logo-full.png (900x625)
    shadowColor: "rgba(2,8,23,0.35)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  spacer: { flex: 1 },
  tagline: {
    fontSize: 21,
    fontWeight: "700",
    color: colors.white,
    textAlign: "center",
    marginBottom: spacing.lg,
    lineHeight: 27,
    textShadowColor: "rgba(2,8,23,0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  // Prototype's .welcome-btn: both variants are filled with white text -
  // .grad (blue->pink gradient, "Create an account") and .solid (flat
  // pink, "I have an account"). This used to be a white pill + an outline
  // pill instead, which doesn't match the prototype at all.
  btn: { height: 54, borderRadius: radius.pill, marginBottom: spacing.sm, overflow: "hidden" },
  btnFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  btnSolidPink: { backgroundColor: colors.pink, alignItems: "center", justifyContent: "center" },
  btnText: { color: colors.white, fontSize: 15, fontWeight: "700" },
  terms: { fontSize: 11, color: "rgba(255,255,255,0.85)", textAlign: "center", lineHeight: 16, marginTop: spacing.xs },
});
