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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { ApiError } from "../api/client";
import SocialAuthButtons from "../components/SocialAuthButtons";
import { colors, radius, spacing } from "../theme";
import { Feather } from "@expo/vector-icons";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
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
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: spacing.xl + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => navigation.goBack()} style={styles.back} hitSlop={12}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.logoWrap}>
          <Image source={require("../../assets/logo-full.png")} style={styles.logo} resizeMode="contain" />
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
              <Feather name={passwordVisible ? "eye-off" : "eye"} size={18} color={colors.muted} />
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
  container: { flexGrow: 1, padding: spacing.lg, paddingTop: spacing.xl },
  logoWrap: { alignItems: "center", marginBottom: spacing.md },
  // Prototype's .auth-logo img is 190px wide - this was 84px.
  logo: { width: 230, height: 160 }, // logo-full.png is 900x625 - keep that aspect ratio
  // Prototype's .ob-back: a floating 38x38 circular white pill with a
  // subtle shadow (scr-login/scr-forgot-password in
  // "Claude outputs/app-prototype-inline.html") - this screen had no back
  // button at all before, relying only on the OS back gesture.
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
    shadowColor: colors.ink,
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 10,
    elevation: 3,
  },
  backText: { fontSize: 22, color: colors.ink, marginTop: -2 },
  title: { fontSize: 25, fontWeight: "800", color: colors.ink, textAlign: "center", marginBottom: 8 },
  subtitle: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20, marginBottom: spacing.lg, paddingHorizontal: spacing.sm },
  form: { gap: spacing.sm },
  label: { fontSize: 14.5, fontWeight: "700", color: colors.ink, marginBottom: spacing.xs * 2 },
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
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.xs },
  primaryButton: {
    height: 54,
    backgroundColor: colors.pink,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
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
