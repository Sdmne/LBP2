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
import {
  QUIZ_QUESTIONS,
  QUIZ_SECTIONS,
  QUIZ_STRENGTH_COPY,
  QUIZ_DISCUSS_COPY,
  computeQuizResults,
  quizResultsAsText,
} from "../data/resources";
import { colors, radius, spacing } from "../theme";

type Step = "intro" | number | "results";

// Mirrors the website's CompatibilityQuiz component exactly: same intro ->
// 26 questions (one at a time) -> results flow, same "no score, no
// pass/fail" reflection framing, entirely local state - no backend call
// anywhere, matching the site (this is explicitly single-person,
// client-side-only in the real product too, see src/data/resources.ts).
// The web version also offers a "Print" button; there's no direct RN
// equivalent, so "Share results" (native OS share sheet) covers both saving
// and printing - iOS's share sheet has its own Print option built in.
type Props = NativeStackScreenProps<RootStackParamList, "CompatibilityQuiz">;

export default function CompatibilityQuizScreen({ navigation }: Props) {
  const [step, setStep] = useState<Step>("intro");
  const [answers, setAnswers] = useState<(string | null)[]>(() => QUIZ_QUESTIONS.map(() => null));
  const [sharing, setSharing] = useState(false);
  const totalQuestions = QUIZ_QUESTIONS.length;

  function setAnswer(index: number, value: string) {
    setAnswers((prev) => prev.map((a, i) => (i === index ? value : a)));
  }

  async function handleShareResults() {
    const results = computeQuizResults(answers);
    const text = quizResultsAsText(answers, results);
    setSharing(true);
    try {
      const uri = `${FileSystem.cacheDirectory}LetsBeParents-Compatibility-Quiz-Results.txt`;
      await FileSystem.writeAsStringAsync(uri, text);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert("Results saved", `Saved to ${uri}`);
      }
    } catch {
      Alert.alert("Couldn't share your results", "Please try again.");
    } finally {
      setSharing(false);
    }
  }

  if (step === "intro") {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.introTitle}>Could you see yourself parenting well with this person?</Text>
        <Text style={styles.introBody}>
          This quiz won't tell you whether you should co-parent. It helps you see where expectations align - and
          what's worth discussing further.
        </Text>
        <View style={styles.introBox}>
          <Text style={styles.introBoxHeading}>Before you start</Text>
          <Text style={styles.introBoxItem}>• {totalQuestions} questions</Text>
          <Text style={styles.introBoxItem}>• About 5 minutes</Text>
          <Text style={styles.introBoxItem}>• You can go back and edit answers</Text>
          <Text style={styles.introBoxItem}>• Free-text answers are optional</Text>
        </View>
        <View style={styles.introBox}>
          <Text style={styles.introBoxHeading}>Privacy</Text>
          <Text style={styles.introBoxItem}>
            Your answers stay on this device and are never shared automatically.
          </Text>
        </View>
        <Pressable style={styles.primaryButton} onPress={() => setStep(0)}>
          <Text style={styles.primaryButtonText}>Start the quiz →</Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (step === "results") {
    const results = computeQuizResults(answers);
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.resultsTitle}>What your answers suggest</Text>
        <Text style={styles.resultsSub}>A reflection of your priorities - not a verdict.</Text>

        {results.strongest.length > 0 ? (
          <View style={styles.resultGroup}>
            <Text style={styles.resultGroupHeading}>Your strongest areas</Text>
            {results.strongest.map((s) => (
              <View key={s} style={styles.resultCard}>
                <Text style={styles.resultCardTitle}>{QUIZ_STRENGTH_COPY[s].title}</Text>
                <Text style={styles.resultCardBody}>{QUIZ_STRENGTH_COPY[s].copy}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.resultGroup}>
          <Text style={styles.resultGroupHeading}>Worth discussing</Text>
          {results.discuss.length > 0 ? (
            results.discuss.map((s) => (
              <View key={s} style={styles.resultCard}>
                <Text style={styles.resultCardTitle}>{QUIZ_DISCUSS_COPY[s].title}</Text>
                <Text style={styles.resultCardBody}>{QUIZ_DISCUSS_COPY[s].copy}</Text>
              </View>
            ))
          ) : (
            <View style={styles.resultCard}>
              <Text style={styles.resultCardBody}>
                You answered fairly decisively across the board - that's a good sign, but it's still worth having
                these conversations out loud with a potential co-parent, not just with yourself.
              </Text>
            </View>
          )}
        </View>

        {results.prompts.length > 0 ? (
          <View style={styles.resultGroup}>
            <Text style={styles.resultGroupHeading}>Questions to explore together</Text>
            {results.prompts.map((prompt) => (
              <Text key={prompt} style={styles.promptItem}>
                → {prompt}
              </Text>
            ))}
          </View>
        ) : null}

        <Pressable style={styles.primaryButton} onPress={handleShareResults} disabled={sharing}>
          {sharing ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Share results</Text>}
        </Pressable>
        <Text style={styles.noScore}>No compatibility %</Text>

        <View style={styles.nextSteps}>
          <Pressable
            onPress={() => navigation.replace("ResourceTool", { categorySlug: "co-parenting", toolSlug: "questions-to-ask" })}
          >
            <Text style={styles.nextStepLink}>Questions to Ask a Potential Co-Parent →</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.replace("ResourceTool", { categorySlug: "co-parenting", toolSlug: "planning-template" })}
          >
            <Text style={styles.nextStepLink}>Create a Co-Parenting Plan →</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  const index = step;
  const question = QUIZ_QUESTIONS[index];
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${((index + 1) / totalQuestions) * 100}%` }]} />
      </View>
      <Text style={styles.progressLabel}>
        Section {question.section} of 8 - {QUIZ_SECTIONS[question.section - 1]}
      </Text>
      <Text style={styles.questionPrompt}>{question.prompt}</Text>

      {question.type === "select" ? (
        <>
          <Text style={styles.questionHint}>Choose the answer that feels closest to you.</Text>
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
          <Text style={styles.questionHint}>Optional - write as much or as little as you like.</Text>
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
          <Text style={styles.backLinkText}>Back</Text>
        </Pressable>
        <Pressable style={[styles.primaryButton, styles.navPrimaryButton, !canAdvance && styles.disabledButton]} onPress={goNext} disabled={!canAdvance}>
          <Text style={styles.primaryButtonText}>{isLast ? "See results →" : "Next →"}</Text>
        </Pressable>
      </View>
      <Text style={styles.navNote}>Answers can be changed before you reach your results.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
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
