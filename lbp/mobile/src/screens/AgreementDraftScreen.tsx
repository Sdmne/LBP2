import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { generateAgreementDraft } from "../api/agreementDraft";
import { ApiError } from "../api/client";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import GradientBackground from "../components/GradientBackground";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "AgreementDraft">;

// Native version of the website's free "AI Agreement Draft" tool (backlog
// item 25, backend: POST /api/public/agreement-draft) - same "Конечно
// хочу" request as AskAiScreen.tsx (see that file's header comment for the
// full context); previously opened the website page in expo-web-browser
// from WhatsNewScreen/SettingsScreen.
//
// Unlike Ask AI, this endpoint isn't a back-and-forth chat - it takes a
// small structured form (agreement type, optional jurisdiction, key
// points) and returns one draft document - so this screen is a form that
// flips to a result view, not a message list. Free, unauthenticated,
// stateless server-side (api/agreementDraft.ts), rate-limited to 5
// drafts/day per IP.
export default function AgreementDraftScreen({}: Props) {
  const { t, locale } = useI18n();
  const [agreementType, setAgreementType] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [keyPoints, setKeyPoints] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftResult, setDraftResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const canSubmit = agreementType.trim().length > 0 && keyPoints.trim().length > 0 && !generating;

  async function submit() {
    if (!canSubmit) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await generateAgreementDraft({
        locale,
        agreementType: agreementType.trim(),
        jurisdiction: jurisdiction.trim() || undefined,
        keyPoints: keyPoints.trim(),
      });
      setDraftResult(res.draft);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError(t("agreementDraft.dailyLimitReached"));
      } else if (err instanceof ApiError && err.status === 503) {
        setError(t("agreementDraft.notConfigured"));
      } else {
        setError(err instanceof ApiError ? err.message : t("agreementDraft.error"));
      }
    } finally {
      setGenerating(false);
    }
  }

  function startOver() {
    setDraftResult(null);
    setError(null);
    setCopied(false);
  }

  async function handleCopy() {
    if (!draftResult) return;
    await Clipboard.setStringAsync(draftResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleShare() {
    if (!draftResult) return;
    Share.share({ message: draftResult }).catch(() => {
      // Same "silent failure would look like nothing happened" reasoning
      // as ReferralScreen.tsx's handleShare - swallow rather than surface
      // a scary error for what's usually just the user cancelling the
      // share sheet.
    });
  }

  if (draftResult) {
    return (
      <GradientBackground variant="soft">
        <ScrollView contentContainerStyle={styles.resultContainer}>
          <View style={styles.resultHeaderRow}>
            <Feather name="file-text" size={20} color={colors.pink} />
            <Text style={styles.resultTitle}>{t("agreementDraft.resultTitle")}</Text>
          </View>
          <View style={styles.resultCard}>
            <Text style={styles.resultText}>{draftResult}</Text>
          </View>
          <Text style={styles.disclaimer}>{t("agreementDraft.disclaimer")}</Text>
          <View style={styles.resultActions}>
            <Pressable style={styles.actionButton} onPress={() => void handleCopy()}>
              <Feather name={copied ? "check" : "copy"} size={16} color={colors.ink} />
              <Text style={styles.actionButtonText}>{copied ? t("agreementDraft.copied") : t("agreementDraft.copy")}</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={handleShare}>
              <Feather name="share-2" size={16} color={colors.ink} />
              <Text style={styles.actionButtonText}>{t("agreementDraft.share")}</Text>
            </Pressable>
          </View>
          <Pressable style={styles.newDraftButton} onPress={startOver}>
            <Text style={styles.newDraftButtonText}>{t("agreementDraft.newDraft")}</Text>
          </Pressable>
        </ScrollView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground variant="soft">
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.center}>
            <Feather name="edit-3" size={36} color={colors.muted} />
            <Text style={styles.intro}>{t("whatsnew.agreementDraftBody")}</Text>
          </View>

          <Text style={styles.label}>{t("agreementDraft.typeLabel")}</Text>
          <TextInput
            style={styles.input}
            value={agreementType}
            onChangeText={setAgreementType}
            placeholder={t("agreementDraft.typePlaceholder")}
            placeholderTextColor={colors.muted}
            maxLength={120}
          />

          <Text style={styles.label}>{t("agreementDraft.jurisdictionLabel")}</Text>
          <TextInput
            style={styles.input}
            value={jurisdiction}
            onChangeText={setJurisdiction}
            placeholder={t("agreementDraft.jurisdictionPlaceholder")}
            placeholderTextColor={colors.muted}
            maxLength={200}
          />

          <Text style={styles.label}>{t("agreementDraft.keyPointsLabel")}</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={keyPoints}
            onChangeText={setKeyPoints}
            placeholder={t("agreementDraft.keyPointsPlaceholder")}
            placeholderTextColor={colors.muted}
            multiline
            maxLength={4000}
            textAlignVertical="top"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={[styles.generateButton, !canSubmit && styles.disabled]} onPress={() => void submit()} disabled={!canSubmit}>
            {generating ? <ActivityIndicator color={colors.white} /> : <Text style={styles.generateButtonText}>{t("agreementDraft.generate")}</Text>}
          </Pressable>

          <Text style={styles.disclaimer}>{t("agreementDraft.disclaimer")}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, padding: spacing.lg, paddingBottom: spacing.xl },
  center: { alignItems: "center", justifyContent: "center", gap: spacing.sm, marginBottom: spacing.md },
  intro: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20, maxWidth: 320 },
  label: { fontSize: 13, fontWeight: "700", color: colors.ink, marginBottom: 6, marginTop: spacing.md },
  input: {
    width: "100%",
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.white,
    fontSize: 14,
    color: colors.ink,
  },
  textarea: { minHeight: 140 },
  error: { fontSize: 13, color: colors.danger, marginTop: spacing.md, textAlign: "center" },
  disclaimer: { fontSize: 11.5, color: colors.muted, textAlign: "center", lineHeight: 16, marginTop: spacing.md },
  generateButton: {
    height: 52,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.pink,
    marginTop: spacing.lg,
  },
  disabled: { opacity: 0.5 },
  generateButtonText: { color: colors.white, fontSize: 14.5, fontWeight: "700" },
  resultContainer: { padding: spacing.lg, paddingBottom: spacing.xl },
  resultHeaderRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  resultTitle: { fontSize: 18, fontWeight: "800", color: colors.ink },
  resultCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md },
  resultText: { fontSize: 14.5, color: colors.ink, lineHeight: 22 },
  resultActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 46,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  actionButtonText: { fontSize: 13.5, fontWeight: "700", color: colors.ink },
  newDraftButton: { height: 46, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  newDraftButtonText: { fontSize: 13.5, fontWeight: "700", color: colors.pink },
});
