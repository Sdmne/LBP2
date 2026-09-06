import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { forgotPassword } from "../api/auth";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "ForgotPassword">;

// Mirrors scr-forgot-password from the prototype, simplified to a single
// step: email in, generic "check your email" message out. The prototype
// also has a 6-digit code entry step (scr-verify-code) before letting the
// person set a new password in-app - that needs POST /api/auth/reset-password
// wired up with the real code flow and is left for a follow-up pass; for
// now the backend's own emailed reset link (POST /api/auth/forgot-password)
// is the complete path, same as the website.
export default function ForgotPasswordScreen({ navigation }: Props) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!email.trim()) {
      setError(t("forgotPassword.errorEmpty"));
      return;
    }
    setSubmitting(true);
    try {
      await forgotPassword(email.trim());
      setSuccess(true);
    } catch {
      // Deliberately shows the same success message even on failure - the
      // backend itself doesn't reveal whether the email exists, so neither
      // should this screen.
      setSuccess(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => navigation.goBack()} style={styles.back} hitSlop={12}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <Text style={styles.title}>{t("forgotPassword.title")}</Text>
        <Text style={styles.subtitle}>{t("forgotPassword.subtitle")}</Text>

        {success ? (
          <View style={styles.form}>
            <Text style={styles.successText}>{t("forgotPassword.success")}</Text>
            <Pressable style={styles.primaryButton} onPress={() => navigation.goBack()}>
              <Text style={styles.primaryButtonText}>{t("forgotPassword.back")}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.label}>{t("forgotPassword.emailLabel")}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder={t("forgotPassword.emailPlaceholder")}
              placeholderTextColor="#a3a3a3"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable style={styles.primaryButton} onPress={handleSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>{t("forgotPassword.submit")}</Text>}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: { flexGrow: 1, padding: spacing.lg, paddingTop: spacing.xl, justifyContent: "center" },
  back: { position: "absolute", top: spacing.xl, left: spacing.lg, width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 26, color: colors.ink, marginTop: -2 },
  title: { fontSize: 25, fontWeight: "800", color: colors.ink, textAlign: "center", marginBottom: 8 },
  subtitle: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20, marginBottom: spacing.lg, paddingHorizontal: spacing.sm },
  form: { gap: spacing.sm },
  label: { fontSize: 14.5, fontWeight: "700", color: colors.ink, marginBottom: 8 },
  input: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bgSoft,
    paddingHorizontal: spacing.md,
    fontSize: 14.5,
    color: colors.ink,
  },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.xs },
  successText: { color: colors.ink, fontSize: 14.5, textAlign: "center", lineHeight: 21, marginBottom: spacing.lg },
  primaryButton: {
    height: 54,
    borderRadius: radius.pill,
    backgroundColor: colors.pink,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  primaryButtonText: { color: colors.white, fontSize: 15.5, fontWeight: "700" },
});
