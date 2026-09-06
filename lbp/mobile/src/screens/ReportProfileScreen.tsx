import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { reportProfile } from "../api/reports";
import { ApiError } from "../api/client";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "ReportProfile">;

// Same reason list as the real Report user screen (matches what's already
// live in the HTML prototype and the production reference screenshots) -
// the backend itself takes free-text `reason`, this fixed list is a product
// choice, not a backend constraint. The value sent to the backend stays
// this canonical English string regardless of display language, the same
// way a <select>'s value differs from its visible label - only the label
// shown to the person is translated (via reportProfile.reason.<value>).
const REASONS = ["Spam", "Harassment", "Inappropriate Content", "Fake Profile", "Scam", "Other"];

export default function ReportProfileScreen({ route, navigation }: Props) {
  const { profileId, displayName } = route.params;
  const { t } = useI18n();
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!selected) return;
    setSubmitting(true);
    try {
      await reportProfile(profileId, selected);
      Alert.alert(t("reportProfile.submittedTitle"), t("reportProfile.submittedBody"), [
        { text: t("common.ok"), onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert(t("reportProfile.failTitle"), err instanceof ApiError ? err.message : t("common.pleaseTryAgain"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("reportProfile.title", { name: displayName || t("reportProfile.thisProfile") })}</Text>
      {REASONS.map((reason) => {
        const isSelected = reason === selected;
        return (
          <Pressable key={reason} style={styles.option} onPress={() => setSelected(reason)}>
            <View style={[styles.radio, isSelected && styles.radioSelected]}>
              {isSelected ? <View style={styles.radioDot} /> : null}
            </View>
            <Text style={styles.optionLabel}>{t(`reportProfile.reason.${reason}`)}</Text>
          </Pressable>
        );
      })}
      <Pressable
        style={[styles.submitButton, !selected && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={!selected || submitting}
      >
        {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitText}>{t("reportProfile.submit")}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg },
  title: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: spacing.md },
  option: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 12 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: colors.gradientEnd },
  radioDot: { width: 12, height: 12, borderRadius: radius.pill, backgroundColor: colors.gradientEnd },
  optionLabel: { fontSize: 15, color: colors.text },
  submitButton: {
    backgroundColor: colors.danger,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  submitButtonDisabled: { opacity: 0.45 },
  submitText: { color: colors.white, fontWeight: "700" },
});
