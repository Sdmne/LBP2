import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { ApiError } from "../api/client";
import SocialAuthButtons from "../components/SocialAuthButtons";
import { colors, radius, spacing } from "../theme";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!email.trim() || !password) {
      setError(t("login.errorEmpty"));
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      // No manual navigation needed - RootNavigator swaps to MainTabs as
      // soon as isAuthenticated flips to true.
    } catch (err) {
      if (err instanceof ApiError) {
        setError(describeAuthError(err, t));
      } else {
        setError(t("common.somethingWrong"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.logoWrap}>
          <Image source={require("../../assets/icon.png")} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={styles.title}>{t("login.title")}</Text>
        <Text style={styles.subtitle}>{t("login.subtitle")}</Text>

        <View style={styles.form}>
          <Text style={styles.label}>{t("login.emailLabel")}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder={t("login.emailPlaceholder")}
            placeholderTextColor="#a3a3a3"
          />

          <Text style={styles.label}>{t("login.passwordLabel")}</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!passwordVisible}
              autoComplete="password"
              placeholder={t("login.passwordPlaceholder")}
              placeholderTextColor="#a3a3a3"
            />
            <Pressable
              style={styles.passwordToggle}
              onPress={() => setPasswordVisible((v) => !v)}
              hitSlop={8}
            >
              <Text style={styles.passwordToggleText}>{passwordVisible ? "🙈" : "👁️"}</Text>
            </Pressable>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={styles.primaryButton} onPress={handleSubmit} disabled={submitting}>
            {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>{t("login.submit")}</Text>}
          </Pressable>

          <Pressable onPress={() => navigation.navigate("ForgotPassword")} style={styles.outlineButton}>
            <Text style={styles.outlineButtonText}>{t("login.forgotPassword")}</Text>
          </Pressable>

          <Pressable onPress={() => navigation.navigate("Signup")} style={styles.secondaryLink}>
            <Text style={styles.secondaryLinkText}>{t("login.noAccount")}</Text>
          </Pressable>

          <SocialAuthButtons intent="login" />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function describeAuthError(err: ApiError, t: (key: string) => string): string {
  switch (err.status) {
    case 0:
      return err.message;
    case 404:
      return t("login.error404");
    case 401:
      return t("login.error401");
    case 403:
      return t("login.error403");
    case 409:
      return t("login.error409");
    default:
      return err.message || t("login.errorDefault");
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: { flexGrow: 1, padding: spacing.lg, paddingTop: spacing.xl, justifyContent: "center" },
  logoWrap: { alignItems: "center", marginBottom: spacing.md },
  logo: { width: 84, height: 84, borderRadius: radius.md },
  title: { fontSize: 25, fontWeight: "800", color: colors.ink, textAlign: "center", marginBottom: 8 },
  subtitle: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20, marginBottom: spacing.lg, paddingHorizontal: spacing.sm },
  form: { gap: spacing.sm },
  label: { fontSize: 14.5, fontWeight: "700", color: colors.ink, marginTop: spacing.sm, marginBottom: 4 },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 14.5,
    backgroundColor: colors.bgSoft,
    color: colors.ink,
  },
  passwordRow: { flexDirection: "row", alignItems: "center" },
  passwordInput: { flex: 1, paddingRight: spacing.xl + spacing.md },
  passwordToggle: { position: "absolute", right: spacing.md, padding: spacing.xs },
  passwordToggleText: { fontSize: 18 },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.xs },
  primaryButton: {
    height: 54,
    backgroundColor: colors.pink,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
  },
  primaryButtonText: { color: colors.white, fontSize: 15.5, fontWeight: "700" },
  outlineButton: {
    height: 48,
    borderWidth: 1.5,
    borderColor: colors.pink,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  outlineButtonText: { color: colors.pink, fontSize: 14.5, fontWeight: "700" },
  secondaryLink: { marginTop: spacing.md, alignItems: "center" },
  secondaryLinkText: { color: colors.blue, fontSize: 14, fontWeight: "600" },
});
