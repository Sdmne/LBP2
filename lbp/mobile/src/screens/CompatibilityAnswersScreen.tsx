import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ApiError } from "../api/client";
import {
  fetchCompatibilityAnswers,
  fetchCompatibilityQuestions,
  saveCompatibilityAnswers,
  type CompatibilityQuestion,
} from "../api/compatibility";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "CompatibilityAnswers">;

// Fill-in-once form for the persisted compatibility questionnaire behind
// "Compatibility Score" / "Detailed Compatibility Report" (see
// src/api/compatibility.ts and backend/main.py's COMPATIBILITY SCORE
// section). Free for everyone to fill in, same as the standalone Quiz -
// the Premium gate is only on viewing a two-sided report with a match
// (CompatibilityReportScreen). Questions/options come from the backend
// (English only for now, same as the Quiz and Resources content) so the
// question bank stays in exactly one place and both sides of a comparison
// are always reading the same wording.
export default function CompatibilityAnswersScreen({ navigation }: Props) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [questions, setQuestions] = useState<CompatibilityQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [q, a] = await Promise.all([fetchCompatibilityQuestions(), fetchCompatibilityAnswers()]);
      setQuestions(q.items);
      setAnswers(a.answers);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("compatibility.loadError"));
    }
  }, [t]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);

  async function handleSave() {
    setSaving(true);
    try {
      await saveCompatibilityAnswers(answers);
      Alert.alert(t("compatibility.savedTitle"), t("compatibility.savedBody"));
    } catch (err) {
      Alert.alert(t("compatibility.saveErrorTitle"), err instanceof ApiError ? err.message : t("common.pleaseTryAgain"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.pink} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: spacing.xl + insets.bottom }]}>
      <Text style={styles.intro}>{t("compatibility.intro")}</Text>
      <Text style={styles.progress}>{t("compatibility.progress", { done: answeredCount, total: questions.length })}</Text>

      {questions.map((question) => (
        <View style={styles.card} key={question.id}>
          <Text style={styles.prompt}>{question.prompt}</Text>
          {question.options.map((option) => {
            const selected = answers[question.id] === option.key;
            return (
              <Pressable
                key={option.key}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => setAnswers((prev) => ({ ...prev, [question.id]: option.key }))}
              >
                <View style={[styles.radio, selected && styles.radioSelected]} />
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}

      <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveButtonText}>{t("compatibility.save")}</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  errorText: { color: colors.danger },
  container: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  intro: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  progress: { fontSize: 13, fontWeight: "700", color: colors.blueDark },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.xs,
  },
  prompt: { fontSize: 15, fontWeight: "700", color: colors.ink, marginBottom: spacing.xs },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 8,
  },
  optionSelected: {},
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.line,
  },
  radioSelected: {
    borderColor: colors.pink,
    backgroundColor: colors.pink,
  },
  optionText: { fontSize: 14, color: colors.ink, flex: 1 },
  optionTextSelected: { fontWeight: "700" },
  saveButton: {
    backgroundColor: colors.pink,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: colors.white, fontWeight: "700", fontSize: 15 },
});
