import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Welcome">;

// Play the supplied welcome video behind the existing controls.
export default function WelcomeScreen({ navigation }: Props) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const player = useVideoPlayer(require("../../assets/welcome-hero.mp4"), (video) => {
    video.loop = true;
    video.muted = true;
    video.play();
  });

  return (
    <View style={styles.flex}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        surfaceType="textureView"
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
          <Image source={require("../../assets/icon.png")} style={styles.logo} resizeMode="contain" />
        </View>

        <View style={styles.spacer} />

        <Text style={styles.tagline}>{t("welcome.tagline")}</Text>

        <Pressable style={[styles.btn, styles.btnSolidWhite]} onPress={() => navigation.navigate("Signup")}>
          <Text style={styles.btnSolidWhiteText}>{t("welcome.createAccount")}</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnOutline]} onPress={() => navigation.navigate("Login")}>
          <Text style={styles.btnOutlineText}>{t("welcome.haveAccount")}</Text>
        </Pressable>

        <Text style={styles.terms}>{t("welcome.terms")}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.ink },
  content: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl + spacing.lg, paddingBottom: spacing.lg },
  logoWrap: { alignItems: "center" },
  logo: { width: 120, height: 120, borderRadius: radius.lg, backgroundColor: colors.white },
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
  btn: { height: 54, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  btnSolidWhite: { backgroundColor: colors.white },
  btnSolidWhiteText: { color: colors.pink, fontSize: 15.5, fontWeight: "700" },
  btnOutline: { borderWidth: 1.5, borderColor: colors.white },
  btnOutlineText: { color: colors.white, fontSize: 15.5, fontWeight: "700" },
  terms: { fontSize: 11, color: "rgba(255,255,255,0.85)", textAlign: "center", lineHeight: 16, marginTop: spacing.xs },
});
