import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ApiError } from "../api/client";
import { fetchCompatibilityReport, type CompatibilityReport } from "../api/compatibility";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "CompatibilityReport">;

// Two-sided "Compatibility Score & Why you match" (Family Builder) /
// "Detailed Compatibility Report" (Family Builder Pro) - see
// src/api/compatibility.ts and backend/main.py's COMPATIBILITY SCORE
// section for the full rationale, especially why this never shows a raw
// percentage or pass/fail (matches the standalone CompatibilityQuizScreen's
// own rule). Gating mirrors FamilyRoomScreen exactly: Premium (402) and an
// active match (404) are both server-checked and rendered here, not
// guessed client-side.
export default function CompatibilityReportScreen({ route, navigation }: Props) {
  const { profileId, displayName } = route.params;
  const { t } = useI18n();

  const [report, setReport] = useState<CompatibilityReport | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "needsPremium" | "noMatch" | "error">("loading");

  const load = useCallback(() => {
    setStatus("loading");
    fetchCompatibilityReport(profileId)
      .then((res) => {
        setReport(res);
        setStatus("ok");
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 402) setStatus("needsPremium");
        else if (err instanceof ApiError && err.status === 404) setStatus("noMatch");
        else setStatus("error");
      });
  }, [profileId]);

  useEffect(() => {
    navigation.setOptions({
      title: displayName ? `${t("compatibilityReport.title")} · ${displayName}` : t("compatibilityReport.title"),
    });
  }, [navigation, displayName, t]);

  useEffect(() => {
    load();
  }, [load]);

  if (status === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.pink} />
      </View>
    );
  }

  if (status === "needsPremium") {
    return (
      <View style={styles.center}>
        <Text style={styles.stateTitle}>{t("compatibilityReport.premiumTitle")}</Text>
        <Text style={styles.stateBody}>{t("compatibilityReport.premiumBody")}</Text>
        <Pressable style={styles.primaryButton} onPress={() => navigation.navigate("Subscription")}>
          <Text style={styles.primaryButtonText}>{t("compatibilityReport.premiumButton")}</Text>
        </Pressable>
      </View>
    );
  }

  if (status === "noMatch") {
    return (
      <View style={styles.center}>
        <Text style={styles.stateTitle}>{t("compatibilityReport.noMatchTitle")}</Text>
        <Text style={styles.stateBody}>{t("compatibilityReport.noMatchBody")}</Text>
      </View>
    );
  }

  if (status === "error" || !report) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t("compatibilityReport.loadError")}</Text>
      </View>
    );
  }

  if (report.status === "incomplete") {
    const body = !report.youCompleted
      ? t("compatibilityReport.incompleteYouBody")
      : t("compatibilityReport.incompleteThemBody");
    return (
      <View style={styles.center}>
        <Text style={styles.stateTitle}>{t("compatibilityReport.incompleteTitle")}</Text>
        <Text style={styles.stateBody}>{body}</Text>
        {!report.youCompleted && (
          <Pressable style={styles.primaryButton} onPress={() => navigation.navigate("CompatibilityAnswers")}>
            <Text style={styles.primaryButtonText}>{t("compatibilityReport.answerButton")}</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("compatibilityReport.strongestTitle")}</Text>
        {report.strongest.length === 0 ? (
          <Text style={styles.emptyText}>{t("compatibilityReport.emptyStrongest")}</Text>
        ) : (
          report.strongest.map((label) => (
            <View key={label} style={styles.pill}>
              <Text style={styles.pillText}>{label}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("compatibilityReport.worthDiscussingTitle")}</Text>
        {report.worthDiscussing.length === 0 ? (
          <Text style={styles.emptyText}>{t("compatibilityReport.emptyWorthDiscussing")}</Text>
        ) : (
          report.worthDiscussing.map((label) => (
            <View key={label} style={[styles.pill, styles.pillMuted]}>
              <Text style={[styles.pillText, styles.pillTextMuted]}>{label}</Text>
            </View>
          ))
        )}
      </View>

      {report.talkingPoints.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("compatibilityReport.talkingPointsTitle")}</Text>
          {report.talkingPoints.map((point, index) => (
            <Text key={index} style={styles.talkingPoint}>
              • {point}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.sm },
  stateTitle: { fontSize: 18, fontWeight: "800", color: colors.text, textAlign: "center" },
  stateBody: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20 },
  errorText: { color: colors.danger },
  primaryButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.pink,
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
  },
  primaryButtonText: { color: colors.white, fontWeight: "700", fontSize: 14 },
  container: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTitle: { fontSize: 17, fontWeight: "800", color: colors.ink, marginBottom: spacing.xs },
  emptyText: { fontSize: 13, color: colors.muted, fontStyle: "italic" },
  pill: {
    backgroundColor: colors.tintPink,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    alignSelf: "flex-start",
  },
  pillText: { color: colors.pink, fontWeight: "700", fontSize: 14 },
  pillMuted: { backgroundColor: colors.tint },
  pillTextMuted: { color: colors.blueDark },
  talkingPoint: { fontSize: 14, color: colors.text, lineHeight: 20 },
});
