import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { fetchVideoVerificationStatus, submitVideoVerification } from "../api/videoVerification";
import { ApiError } from "../api/client";
import type { VideoVerificationStatus } from "../api/videoVerification";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import GradientBackground from "../components/GradientBackground";

// Premium roadmap step 9 - a distinct badge from the existing Didit
// identity verification (see VerificationScreen.tsx), styled to match it
// (same hero/status-card/button structure) so the two feel like one
// family of "trust" screens rather than two unrelated designs.
const MAX_DURATION_SECONDS = 15;

function guessMimeType(uri: string, assetMimeType?: string | null): string {
  if (assetMimeType) return assetMimeType;
  const lower = uri.toLowerCase();
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".webm")) return "video/webm";
  return "video/mp4";
}

export default function VideoVerificationScreen() {
  const { t } = useI18n();
  const [status, setStatus] = useState<VideoVerificationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setStatus(await fetchVideoVerificationStatus());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("videoVerification.loadError"));
    }
  }, [t]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function handlePicked(uri: string | undefined, mimeType: string | null | undefined) {
    if (!uri) return;
    setUploading(true);
    setError(null);
    try {
      await submitVideoVerification(uri, guessMimeType(uri, mimeType));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("videoVerification.uploadError"));
    } finally {
      setUploading(false);
    }
  }

  async function handleRecord() {
    if (uploading) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("videoVerification.cameraPermissionTitle"), t("videoVerification.cameraPermissionBody"));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: MAX_DURATION_SECONDS,
      cameraType: ImagePicker.CameraType.front,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    await handlePicked(result.assets[0].uri, result.assets[0].mimeType);
  }

  async function handlePickFromLibrary() {
    if (uploading) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("videoVerification.libraryPermissionTitle"), t("videoVerification.libraryPermissionBody"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: MAX_DURATION_SECONDS,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    await handlePicked(result.assets[0].uri, result.assets[0].mimeType);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.pink} />
      </View>
    );
  }

  const requestStatus = status?.requestStatus;
  const isApproved = !!status?.videoVerified;
  const isPending = requestStatus === "PENDING";
  const canSubmit = !isApproved && !isPending;

  let title = t("videoVerification.notStartedTitle");
  let body = t("videoVerification.notStartedBody");
  if (isApproved) {
    title = t("videoVerification.approvedTitle");
    body = t("videoVerification.approvedBody");
  } else if (isPending) {
    title = t("videoVerification.pendingTitle");
    body = t("videoVerification.pendingBody");
  } else if (requestStatus === "DECLINED") {
    title = t("videoVerification.declinedTitle");
    body = t("videoVerification.declinedBody");
  }

  return (
    <GradientBackground variant="soft">
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <Feather name="video" size={26} color={colors.pink} />
          </View>
          <Text style={styles.heroTitle}>{t("videoVerification.whyTitle")}</Text>
          <Text style={styles.heroBody}>{t("videoVerification.whyBody")}</Text>
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {canSubmit ? (
          <>
            <Text style={styles.note}>{t("videoVerification.instructions")}</Text>
            <Pressable style={styles.button} onPress={handleRecord} disabled={uploading}>
              {uploading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Feather name="video" size={17} color={colors.white} />
                  <Text style={styles.buttonText}>{t("videoVerification.recordButton")}</Text>
                </>
              )}
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={handlePickFromLibrary} disabled={uploading}>
              <Text style={styles.secondaryButtonText}>{t("videoVerification.libraryButton")}</Text>
            </Pressable>
          </>
        ) : null}

        <View style={styles.privacyRow}>
          <Feather name="lock" size={13} color={colors.mutedOnGradient} />
          <Text style={styles.privacyText}>{t("videoVerification.privacyNote")}</Text>
        </View>
      </ScrollView>
    </GradientBackground>
  );
}

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
  note: { fontSize: 13, color: colors.mutedOnGradient, lineHeight: 18, textAlign: "center", marginTop: spacing.xs },
  errorText: { fontSize: 13, color: colors.danger, marginTop: spacing.xs },
  button: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: colors.pink,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
  },
  buttonText: { color: colors.white, fontWeight: "700" },
  secondaryButton: {
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
  },
  secondaryButtonText: { color: colors.ink, fontWeight: "700" },
  privacyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  privacyText: { flex: 1, fontSize: 12, color: colors.mutedOnGradient, lineHeight: 17 },
});
