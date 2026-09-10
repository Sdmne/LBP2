import React, { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View, Pressable } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
// SDK 57 bumped expo-file-system to a new class-based File/Directory API
// as the default export - the classic promise-based one this screen uses
// (cacheDirectory, writeAsStringAsync) still exists, just moved to this
// "/legacy" subpath rather than being removed.
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { getQuizContent, computeQuizResults, quizResultsAsText } from "../data/resources";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GradientBackground from "../components/GradientBackground";

type Step = "intro" | number | "results";

// Mirrors the website's CompatibilityQuiz component exactly: same intro ->
// 26 questions (one at a time) -> results flow, same "no score, no
// pass/fail" reflection framing, entirely local state - no backend call
// anywhere, matching the site (this is explicitly single-person,
// client-side-only in the real product too, see src/data/resources.ts).
// The web version also offers a "Print" button; there's no direct RN
// equivalent, so "Share results" (native OS share sheet) covers both saving
// and printing - iOS's share sheet has its own Print option built in.
//
// Content (questions/sections/copy) is locale-aware via getQuizContent() -
// see the note at the top of data/resources.ts on why ru/es have original
// translations rather than ported website copy.
type Props = NativeStackScreenProps<RootStackParamList, "CompatibilityQuiz">;

export default function CompatibilityQuizScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t, locale } = useI18n();
  const content = getQuizContent(locale);
  const [step, setStep] = useState<Step>("intro");
  const [answers, setAnswers] = useState<(string | null)[]>(() => content.questions.map(() => null));
  const [sharing, setSharing] = useState(false);
  const totalQuestions = content.questions.length;

  function setAnswer(index: number, value: string) {
    setAnswers((prev) => prev.map((a, i) => (i === index ? value : a)));
  }

  async function handleShareResults() {
    const results = computeQuizResults(answers, content);
    const text = quizResultsAsText(answers, results, content);
    setSharing(true);
    try {
      const uri = `${FileSystem.cacheDirectory}LetsBeParents-Compatibility-Quiz-Results.txt`;
      await FileSystem.writeAsStringAsync(uri, text);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert(t("quiz.results.savedTitle"), t("quiz.results.savedBody", { uri }));
      }
    } catch {
      Alert.alert(t("quiz.results.shareErrorTitle"), t("quiz.results.shareErrorBody"));
    } finally {
      setSharing(false);
    }
  }

  if (step === "intro") {
    return (
      <GradientBackground variant="soft">
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}>
        <Text style={styles.introTitle}>{t("quiz.intro.title")}</Text>
        <Text style={styles.introBody}>{t("quiz.intro.body")}</Text>
        <View style={styles.introBox}>
          <Text style={styles.introBoxHeading}>{t("quiz.intro.beforeYouStart")}</Text>
          <Text style={styles.introBoxItem}>• {t("quiz.intro.questionsCount", { count: totalQuestions })}</Text>
          <Text style={styles.introBoxItem}>• {t("quiz.intro.duration")}</Text>
          <Text style={styles.introBoxItem}>• {t("quiz.intro.canGoBack")}</Text>
          <Text style={styles.introBoxItem}>• {t("quiz.intro.freeTextOptional")}</Text>
        </View>
        <View style={styles.introBox}>
          <Text style={styles.introBoxHeading}>{t("quiz.intro.privacyHeading")}</Text>
          <Text style={styles.introBoxItem}>{t("quiz.intro.privacyBody")}</Text>
        </View>
        <Pressable style={styles.primaryButton} onPress={() => setStep(0)}>
          <Text style={styles.primaryButtonText}>{t("quiz.intro.startButton")}</Text>
        </Pressable>
      </ScrollView>
      </GradientBackground>
    );
  }

  if (step === "results") {
    const results = computeQuizResults(answers, content);
    return (
      <GradientBackground variant="soft">
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}>
        <Text style={styles.resultsTitle}>{t("quiz.results.title")}</Text>
        <Text style={styles.resultsSub}>{t("quiz.results.subtitle")}</Text>

        {results.strongest.length > 0 ? (
          <View style={styles.resultGroup}>
            <Text style={styles.resultGroupHeading}>{t("quiz.results.strongestHeading")}</Text>
            {results.strongest.map((s) => (
              <View key={s} style={styles.resultCard}>
                <Text style={styles.resultCardTitle}>{content.strengthCopy[s].title}</Text>
                <Text style={styles.resultCardBody}>{content.strengthCopy[s].copy}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.resultGroup}>
          <Text style={styles.resultGroupHeading}>{t("quiz.results.discussHeading")}</Text>
          {results.discuss.length > 0 ? (
            results.discuss.map((s) => (
              <View key={s} style={styles.resultCard}>
                <Text style={styles.resultCardTitle}>{content.discussCopy[s].title}</Text>
                <Text style={styles.resultCardBody}>{content.discussCopy[s].copy}</Text>
              </View>
            ))
          ) : (
            <View style={styles.resultCard}>
              <Text style={styles.resultCardBody}>{t("quiz.results.discussEmptyBody")}</Text>
            </View>
          )}
        </View>

        {results.prompts.length > 0 ? (
          <View style={styles.resultGroup}>
            <Text style={styles.resultGroupHeading}>{t("quiz.results.promptsHeading")}</Text>
            {results.prompts.map((prompt) => (
              <Text key={prompt} style={styles.promptItem}>
                → {prompt}
              </Text>
            ))}
          </View>
        ) : null}

        <Pressable style={styles.primaryButton} onPress={handleShareResults} disabled={sharing}>
          {sharing ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>{t("quiz.results.shareButton")}</Text>}
        </Pressable>
        <Text style={styles.noScore}>{t("quiz.results.noScore")}</Text>

        <View style={styles.nextSteps}>
          <Pressable
            onPress={() => navigation.replace("ResourceTool", { categorySlug: "co-parenting", toolSlug: "questions-to-ask" })}
          >
            <Text style={styles.nextStepLink}>{t("quiz.results.nextStepQuestions")}</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.replace("ResourceTool", { categorySlug: "co-parenting", toolSlug: "planning-template" })}
          >
            <Text style={styles.nextStepLink}>{t("quiz.results.nextStepPlan")}</Text>
          </Pressable>
        </View>
      </ScrollView>
      </GradientBackground>
    );
  }

  const index = step;
  const question = content.questions[index];
  const answer = answers[index];
  const canAdvance = question.type === "text" || Boolean(answer);
  const isLast = index === totalQuestions - 1;

  function goNext() {
    if (isLast) setStep("results");
    else setStep(index + 1);
  }
  function goBack() {
    if (index === 0) setStep("intro");
    else setStep(index - 1);
  }

  return (
    <GradientBackground variant="soft">
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${((index + 1) / totalQuestions) * 100}%` }]} />
      </View>
      <Text style={styles.progressLabel}>
        {t("quiz.question.progressLabel", { n: question.section, section: content.sections[question.section - 1] })}
      </Text>
      <Text style={styles.questionPrompt}>{question.prompt}</Text>

      {question.type === "select" ? (
        <>
          <Text style={styles.questionHint}>{t("quiz.question.hintSelect")}</Text>
          <View style={styles.optionsList}>
            {question.options?.map((option) => (
              <Pressable
                key={option}
                style={[styles.optionButton, answer === option && styles.optionButtonSelected]}
                onPress={() => setAnswer(index, option)}
              >
                <Text style={[styles.optionText, answer === option && styles.optionTextSelected]}>{option}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <>
          <Text style={styles.questionHint}>{t("quiz.question.hintText")}</Text>
          <TextInput
            style={styles.textArea}
            value={answer ?? ""}
            onChangeText={(value) => setAnswer(index, value)}
            multiline
            numberOfLines={4}
            placeholder=""
          />
        </>
      )}

      <View style={styles.navRow}>
        <Pressable style={styles.backLink} onPress={goBack}>
          <Text style={styles.backLinkText}>{t("quiz.question.back")}</Text>
        </Pressable>
        <Pressable style={[styles.primaryButton, styles.navPrimaryButton, !canAdvance && styles.disabledButton]} onPress={goNext} disabled={!canAdvance}>
          <Text style={styles.primaryButtonText}>{isLast ? t("quiz.question.seeResults") : t("quiz.question.next")}</Text>
        </Pressable>
      </View>
      <Text style={styles.navNote}>{t("quiz.question.note")}</Text>
    </ScrollView>
      </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  introTitle: { fontSize: 22, fontWeight: "800", color: colors.text },
  introBody: { fontSize: 14, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 20 },
  introBox: { backgroundColor: colors.bgSoft, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.md },
  introBoxHeading: { fontSize: 15, fontWeight: "800", color: colors.text, marginBottom: spacing.xs },
  introBoxItem: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs, lineHeight: 18 },
  primaryButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.gradientStart,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: { color: colors.white, fontWeight: "700" },
  disabledButton: { opacity: 0.5 },
  resultsTitle: { fontSize: 22, fontWeight: "800", color: colors.text },
  resultsSub: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs },
  resultGroup: { marginTop: spacing.xl },
  resultGroupHeading: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: spacing.sm },
  resultCard: { backgroundColor: colors.bgSoft, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm },
  resultCardTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  resultCardBody: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs, lineHeight: 18 },
  promptItem: { fontSize: 13, color: colors.text, marginTop: spacing.sm },
  noScore: { fontSize: 11, color: colors.textMuted, textAlign: "center", marginTop: spacing.sm },
  nextSteps: { marginTop: spacing.xl, gap: spacing.sm },
  nextStepLink: { fontSize: 14, fontWeight: "700", color: colors.gradientStart, marginTop: spacing.xs },
  progressTrack: { height: 6, borderRadius: radius.pill, backgroundColor: colors.bgSoft, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: radius.pill, backgroundColor: colors.gradientStart },
  progressLabel: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm, fontWeight: "700" },
  questionPrompt: { fontSize: 20, fontWeight: "800", color: colors.text, marginTop: spacing.md },
  questionHint: { fontSize: 13, color: colors.textMuted, marginTop: spacing.sm },
  optionsList: { marginTop: spacing.md, gap: spacing.sm },
  optionButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  optionButtonSelected: { borderColor: colors.gradientStart, backgroundColor: colors.bgSoft },
  optionText: { fontSize: 14, color: colors.text },
  optionTextSelected: { fontWeight: "700", color: colors.gradientStart },
  textArea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    fontSize: 14,
    color: colors.text,
    textAlignVertical: "top",
    minHeight: 100,
  },
  navRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.xl },
  backLink: { paddingVertical: 14, paddingHorizontal: spacing.md },
  backLinkText: { fontSize: 14, fontWeight: "700", color: colors.textMuted },
  navPrimaryButton: { flex: 1, marginTop: 0 },
  navNote: { fontSize: 11, color: colors.textMuted, marginTop: spacing.sm, textAlign: "center" },
});
