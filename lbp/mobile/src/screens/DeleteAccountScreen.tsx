import React, { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import GradientBackground from "../components/GradientBackground";

export default function DeleteAccountScreen() {
  const { deleteAccount } = useAuth();
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = reason.trim().length > 0 && confirmation.trim().toUpperCase() === "DELETE";

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(reason.trim());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.somethingWrong"));
      setBusy(false);
    }
  }

  return (
    <GradientBackground variant="soft">
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.warningIcon}><Text style={styles.warningIconText}>!</Text></View>
        <Text style={styles.title}>{t("deleteAccount.title")}</Text>
        <Text style={styles.body}>{t("deleteAccount.body")}</Text>
        <View style={styles.summary}>
          <Text style={styles.summaryText}>{t("deleteAccount.matches")}</Text>
          <Text style={styles.summaryText}>{t("deleteAccount.messages")}</Text>
          <Text style={styles.summaryText}>{t("deleteAccount.photos")}</Text>
        </View>
        <Text style={styles.label}>{t("deleteAccount.reasonLabel")}</Text>
        <TextInput style={styles.input} value={reason} onChangeText={setReason} placeholder={t("deleteAccount.reasonPlaceholder")} placeholderTextColor="#94a3b8" maxLength={255} />
        <Text style={styles.label}>{t("deleteAccount.confirmLabel")}</Text>
        <TextInput style={styles.input} value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" autoCorrect={false} placeholder="DELETE" placeholderTextColor="#94a3b8" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={[styles.deleteButton, !valid && styles.disabled]} onPress={submit} disabled={!valid || busy}>
          {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.deleteButtonText}>{t("deleteAccount.submit")}</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "transparent" },
  container: { flexGrow: 1, alignItems: "center", padding: spacing.xl },
  warningIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#feeceb",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  warningIconText: { fontSize: 26, fontWeight: "800", color: colors.danger },
  title: { fontSize: 20, fontWeight: "800", color: colors.ink, textAlign: "center", marginBottom: 8 },
  body: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20, marginBottom: spacing.md },
  summary: {
    width: "100%",
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: 6,
  },
  summaryText: { fontSize: 13, color: colors.ink },
  label: { alignSelf: "flex-start", fontSize: 13, fontWeight: "700", color: colors.ink, marginBottom: 6, marginTop: spacing.sm },
  input: {
    width: "100%",
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    fontSize: 14,
    color: colors.ink,
  },
  error: { fontSize: 13, color: colors.danger, marginTop: spacing.sm, textAlign: "center" },
  deleteButton: {
    width: "100%",
    height: 52,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.danger,
    marginTop: spacing.lg,
  },
  disabled: { opacity: 0.5 },
  deleteButtonText: { color: "#fff", fontSize: 14.5, fontWeight: "700" },
});
