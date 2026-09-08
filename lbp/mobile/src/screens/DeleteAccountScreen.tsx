import React, { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";

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
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  container: { flexGrow: 1, padding: spacing.lg, paddingBottom: spacing.xl },
  warningIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#feeceb", alignSelf: "center", alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  warningIconText: { color: colors.danger, fontSize: 30, fontWeight: "800" },
  title: { color: colors.ink, fontSize: 24, fontWeight: "800", textAlign: "center", marginTop: spacing.md },
  body: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: spacing.sm },
  summary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.md, gap: 10, marginVertical: spacing.lg },
  summaryText: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  label: { color: colors.ink, fontSize: 14, fontWeight: "700", marginBottom: 7, marginTop: spacing.sm },
  input: { height: 52, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.card, color: colors.ink, paddingHorizontal: spacing.md, fontSize: 14.5 },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
  deleteButton: { height: 54, backgroundColor: colors.danger, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  disabled: { opacity: 0.45 },
  deleteButtonText: { color: colors.white, fontSize: 15.5, fontWeight: "700" },
});
