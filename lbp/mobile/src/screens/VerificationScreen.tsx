import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as WebBrowser from "expo-web-browser";
import { Feather } from "@expo/vector-icons";
import { fetchVerificationStatus, startVerification } from "../api/verification";
import { fetchPhotos } from "../api/photos";
import { ApiError } from "../api/client";
import type { VerificationStatus } from "../api/types";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import GradientBackground from "../components/GradientBackground";
import type { RootStackParamList } from "../navigation/RootNavigator";

// Real provider, confirmed from the actual webhook integration (see
// startVerification()/main.py's Didit webhook handler) - didit.me's own
// "Verification Privacy Notice" is the specific page for what happens to
// the ID/selfie data submitted during a verification session, not their
// general site privacy policy.
const DIDIT_PRIVACY_URL = "https://didit.me/terms/verification-privacy-notice/";

const STATUS_KEYS: Record<string, { title: string; body: string }> = {
  NOT_STARTED: { title: "verification.notStartedTitle", body: "verification.notStartedBody" },
  PENDING: { title: "verification.pendingTitle", body: "verification.pendingBody" },
  IN_REVIEW: { title: "verification.inReviewTitle", body: "verification.inReviewBody" },
  APPROVED: { title: "verification.approvedTitle", body: "verification.approvedBody" },
  DECLINED: { title: "verification.declinedTitle", body: "verification.declinedBody" },
  EXPIRED: { title: "verification.expiredTitle", body: "verification.expiredBody" },
  ABANDONED: { title: "verification.abandonedTitle", body: "verification.abandonedBody" },
};

export default function VerificationScreen() {
  const { t, locale } = useI18n();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  // Prototype's #scr-verification shows the person's actual primary
  // photo (".ver-photo-wrap") with a "Change main photo" link -
  // VerificationStatus.primaryPhoto is only a boolean, so the real
  // thumbnail comes from a second call to GET /api/member/photos
  // (same endpoint the Photos screen uses), not fabricated.
  const [primaryPhotoUrl, setPrimaryPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setStatus(await fetchVerificationStatus());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("verification.loadError"));
    }
    try {
      const res = await fetchPhotos();
      setPrimaryPhotoUrl(res.items.find((p) => p.position === 0)?.publicUrl || null);
    } catch {
      // Non-critical - the screen still works without the preview.
    }
  }, [t]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function handleStart() {
    setStarting(true);
    setError(null);
    try {
      const res = await startVerification(locale);
      if (res.url) {
        await WebBrowser.openBrowserAsync(res.url);
        // The person completes verification in the browser, then Didit
        // calls the backend's webhook - refresh once they're back.
        await load();
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(t("verification.needPhotoFirst"));
      } else if (err instanceof ApiError && err.status === 503) {
        setError(t("verification.notConfigured"));
      } else {
        setError(err instanceof ApiError ? err.message : t("verification.startError"));
      }
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.pink} />
      </View>
    );
  }

  const statusKeys = status ? STATUS_KEYS[status.status] : null;
  const title = statusKeys ? t(statusKeys.title) : status?.status;
  const body = statusKeys ? t(statusKeys.body) : "";
  const canStart = status && ["NOT_STARTED", "DECLINED", "EXPIRED", "ABANDONED"].includes(status.status);
  const hasActiveSession = status && ["PENDING", "IN_REVIEW"].includes(status.status) && status.url;

  return (
    <GradientBackground variant="soft">
    <ScrollView contentContainerStyle={styles.container}>
      {/* Alena: "надо сделать более красивый экран и про то как мы хотим
          создать безопасную среду и поэтому важна верификация" - the
          screen previously jumped straight to the raw status with no
          framing at all. This hero runs regardless of status (including
          APPROVED - a verified member should still see why it mattered). */}
      <View style={styles.hero}>
        <View style={styles.heroIconWrap}>
          <Feather name="shield" size={26} color={colors.pink} />
        </View>
        <Text style={styles.heroTitle}>{t("verification.whyTitle")}</Text>
        <Text style={styles.heroBody}>{t("verification.whyBody")}</Text>
      </View>

      {status ? (
        <View style={styles.statusCard}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
      ) : null}

      {status && !status.primaryPhoto ? (
        <Text style={styles.notice}>{t("verification.needPhoto")}</Text>
      ) : null}

      {status?.status !== "APPROVED" ? (
        <>
          {primaryPhotoUrl ? (
            <View style={styles.photoWrap}>
              <Image source={{ uri: primaryPhotoUrl }} style={styles.photo} />
              <Text style={styles.photoLabel}>{t("verification.yourMainPhoto")}</Text>
            </View>
          ) : null}

          <Pressable style={styles.changePhotoLink} onPress={() => navigation.navigate("Photos")}>
            <Text style={styles.changePhotoText}>{t("verification.changeMainPhoto")}</Text>
          </Pressable>
        </>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {canStart || hasActiveSession ? (
        <Pressable style={styles.button} onPress={handleStart} disabled={starting}>
          {starting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>{hasActiveSession ? t("verification.continue") : t("verification.start")}</Text>
          )}
        </Pressable>
      ) : null}

      {/* Names the real provider + links their actual verification-specific
          privacy notice (not didit.me's general site policy) - Alena:
          "где-то про то какой сервис мы используем и ссылка на их
          правила". */}
      <Pressable style={styles.providerRow} onPress={() => WebBrowser.openBrowserAsync(DIDIT_PRIVACY_URL)}>
        <Feather name="lock" size={13} color={colors.mutedOnGradient} />
        <View style={styles.providerTextWrap}>
          <Text style={styles.providerBody}>{t("verification.poweredBy")}</Text>
          <Text style={styles.providerLink}>{t("verification.privacyLink")}</Text>
        </View>
      </Pressable>
    </ScrollView>
    </GradientBackground>
  );
}

// Alena (after verifying successfully): "и здесь опять не оч ровно и
// красиво" - `container` already puts a uniform `gap: spacing.sm` between
// every top-level block, but photoWrap/providerRow each ALSO carried their
// own marginTop on top of that gap - doubling up the spacing before them
// specifically (most visible on the approved/no-photo-section state her
// screenshot showed, where statusCard sits directly above providerRow with
// a visibly bigger gap than the hero-to-statusCard gap above it). Removed
// the redundant per-block margins so the vertical rhythm down the screen
// is consistent everywhere; the button's own larger marginTop is kept
// deliberately (it's meant to stand apart as the CTA).
const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { flexGrow: 1, padding: spacing.lg, gap: spacing.sm, backgroundColor: "transparent" },
  hero: { alignItems: "center", marginBottom: spacing.sm, paddingHorizontal: spacing.md },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.tintPink,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  heroTitle: { fontSize: 18, fontWeight: "800", color: colors.ink, textAlign: "center" },
  heroBody: { fontSize: 13.5, color: colors.mutedOnGradient, lineHeight: 19, textAlign: "center", marginTop: 6 },
  statusCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 4,
  },
  title: { fontSize: 18, fontWeight: "800", color: colors.ink },
  body: { fontSize: 14, color: colors.mutedOnGradient, lineHeight: 20 },
  notice: { fontSize: 13, fontWeight: "700", color: colors.premiumDark, marginTop: spacing.xs },
  errorText: { fontSize: 13, color: colors.danger, marginTop: spacing.xs },
  button: {
    backgroundColor: colors.pink,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  buttonText: { color: colors.white, fontWeight: "700" },
  photoWrap: { alignItems: "center" },
  photo: { width: 140, height: 140, borderRadius: radius.lg, backgroundColor: colors.border },
  photoLabel: { fontSize: 12, color: colors.muted, marginTop: spacing.xs },
  changePhotoLink: { alignItems: "center", marginTop: spacing.xs },
  changePhotoText: { fontSize: 13.5, fontWeight: "700", color: colors.blueDark },
  providerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  providerTextWrap: { flex: 1 },
  providerBody: { fontSize: 12, color: colors.mutedOnGradient, lineHeight: 17 },
  providerLink: { fontSize: 12.5, fontWeight: "700", color: colors.blueDark, marginTop: 3 },
});
