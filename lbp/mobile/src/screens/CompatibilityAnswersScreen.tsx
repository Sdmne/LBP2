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
// UPDATE (Sept 2026): Alena - "Вопросы и варианты ответов - перевели
// конечно" (translate the questions and answer options too). The
// questionnaire content itself (question.prompt / option.label) comes
// straight from the backend's COMPATIBILITY_QUESTIONS bank in English
// only (see backend/main.py's comment on that list - it's deliberately
// one shared bank so both sides of a match comparison read identical
// wording). Translating it there would mean localizing the API response
// itself, which is more backend surface than this needs. Since only the
// STORED value (option.key, a stable id like "structured"/"undecided") is
// ever compared - never the display text - it's safe to translate purely
// on the display side here: two matched members can each read their own
// locale's wording for the same underlying answer with no effect on
// comparison logic. Keyed by question id (not by prompt text) so a wording
// tweak on the backend doesn't silently break the lookup - it just falls
// back to the English text below, exactly like the rest of this app's
// missing-translation fallback.
type CompatibilityTranslation = { prompt: string; options: Record<string, string> };
const COMPATIBILITY_TRANSLATIONS_RU: Record<string, CompatibilityTranslation> = {
  par_style: {
    prompt: "Какой стиль воспитания вам ближе в повседневной жизни?",
    options: {
      structured: "Чёткий, с понятным распорядком",
      balanced: "Баланс между структурой и гибкостью",
      flexible: "Гибкий, ориентированный на ребёнка",
      undecided: "Пока не определился(-лась)",
    },
  },
  par_discipline: {
    prompt: "Как вы относитесь к дисциплине и правилам?",
    options: {
      firm: "Чёткие правила с последовательными последствиями",
      moderate: "В основном мягкое руководство, немного правил",
      relaxed: "Очень мало правил, много самостоятельности",
      undecided: "Пока не определился(-лась)",
    },
  },
  par_values: {
    prompt: "Что для вас важнее всего в воспитании ребёнка?",
    options: {
      achievement: "Структура, достижения и ответственность",
      independence: "Самостоятельность и самовыражение",
      connection: "Эмоциональная близость и связь",
      undecided: "Пока не определился(-лась)",
    },
  },
  inv_daily: {
    prompt: "Насколько активно вы хотите участвовать в повседневном уходе?",
    options: {
      primary: "Быть основным, непосредственно вовлечённым родителем",
      equal: "Равное, совместное участие",
      supportive: "Поддерживать, но не быть основным опекуном",
      undecided: "Пока не определился(-лась)",
    },
  },
  inv_decisions: {
    prompt: "Как вы хотите принимать решения по воспитанию вместе?",
    options: {
      joint: "Всегда совместно, по всем вопросам",
      divided: "Разделить по областям (один отвечает за здоровье, другой — за учёбу и т.д.)",
      flexible: "Решает тот, кто свободен в данный момент",
      undecided: "Пока не определился(-лась)",
    },
  },
  inv_financial: {
    prompt: "Как вы представляете распределение финансовой ответственности?",
    options: {
      equal: "Делить поровну",
      proportional: "Пропорционально доходу",
      oneLead: "Один из нас берёт на себя основную часть",
      undecided: "Пока не определился(-лась)",
    },
  },
  time_when: {
    prompt: "Когда вы хотели бы начать?",
    options: {
      asap: "Как можно скорее",
      withinYear: "В течение следующего года",
      coupleYears: "В ближайшие пару лет",
      undecided: "Пока не определился(-лась)",
    },
  },
  time_pace: {
    prompt: "Как вы относитесь к темпу знакомства друг с другом перед этим?",
    options: {
      fast: "Готов(а) действовать быстро, как только придём к согласию",
      moderate: "Несколько месяцев на знакомство сначала",
      slow: "Хотел(а) бы больше времени перед принятием решения",
      undecided: "Пока не определился(-лась)",
    },
  },
  time_more: {
    prompt: "Вы видите это как одного ребёнка или, возможно, больше?",
    options: {
      one: "Одного ребёнка",
      open: "Открыт(а) к более чем одному",
      undecided: "Пока не определился(-лась)",
    },
  },
  bound_contact: {
    prompt: "Насколько тесным должно быть общение ребёнка с вами обоими по мере взросления?",
    options: {
      close: "Тесное участие обоих, постоянно",
      defined: "Регулярное, но чётко спланированное общение",
      limited: "Ограниченное, с чёткими рамками общение",
      undecided: "Пока не определился(-лась)",
    },
  },
  bound_conflict: {
    prompt: "Как вы предпочитаете решать разногласия?",
    options: {
      talkImmediately: "Обсуждать сразу же",
      coolOff: "Взять паузу, а потом обсудить",
      mediator: "При необходимости привлечь нейтральную третью сторону",
      undecided: "Пока не определился(-лась)",
    },
  },
  bound_privacy: {
    prompt: "Насколько публичной должна быть эта договорённость (семья, друзья, интернет)?",
    options: {
      open: "Полностью открыто для всех",
      selective: "Открыто только для близких родственников/друзей",
      private: "Очень приватно, только для тех, кому нужно знать",
      undecided: "Пока не определился(-лась)",
    },
  },
};

const COMPATIBILITY_TRANSLATIONS: Partial<Record<string, Record<string, CompatibilityTranslation>>> = {
  ru: COMPATIBILITY_TRANSLATIONS_RU,
};

function localizedPrompt(question: CompatibilityQuestion, locale: string): string {
  return COMPATIBILITY_TRANSLATIONS[locale]?.[question.id]?.prompt ?? question.prompt;
}

function localizedOptionLabel(question: CompatibilityQuestion, option: CompatibilityQuestion["options"][number], locale: string): string {
  return COMPATIBILITY_TRANSLATIONS[locale]?.[question.id]?.options[option.key] ?? option.label;
}

export default function CompatibilityAnswersScreen({ navigation }: Props) {
  const { t, locale } = useI18n();
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
          <Text style={styles.prompt}>{localizedPrompt(question, locale)}</Text>
          {question.options.map((option) => {
            const selected = answers[question.id] === option.key;
            return (
              <Pressable
                key={option.key}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => setAnswers((prev) => ({ ...prev, [question.id]: option.key }))}
              >
                <View style={[styles.radio, selected && styles.radioSelected]} />
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{localizedOptionLabel(question, option, locale)}</Text>
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
