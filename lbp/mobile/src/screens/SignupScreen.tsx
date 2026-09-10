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

type Props = NativeStackScreenProps<RootStackParamList, "Signup">;

export default function SignupScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { signup } = useAuth();
  const { t } = useI18n();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!displayName.trim() || !email.trim() || password.length < 8) {
      setError(t("signup.errorFill"));
      return;
    }
    setSubmitting(true);
    try {
      await signup(email.trim(), password, displayName.trim());
    } catch (err) {
      if (err instanceof ApiError) {
        setError(describeSignupError(err, t));
      } else {
        setError(t("common.somethingWrong"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
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
        <Text style={styles.title}>{t("signup.title")}</Text>

        <View style={styles.form}>
          <Text style={styles.label}>{t("signup.nameLabel")}</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder={t("signup.namePlaceholder")}
            placeholderTextColor="#a3a3a3"
          />

          <Text style={styles.label}>{t("signup.emailLabel")}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder={t("signup.emailPlaceholder")}
            placeholderTextColor="#a3a3a3"
          />

          <Text style={styles.label}>{t("signup.passwordLabel")}</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!passwordVisible}
              placeholder={t("signup.passwordPlaceholder")}
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
            {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>{t("signup.submit")}</Text>}
          </Pressable>

          <Pressable onPress={() => navigation.navigate("Login")} style={styles.secondaryLink}>
            <Text style={styles.secondaryLinkText}>{t("signup.haveAccount")}</Text>
          </Pressable>

          <SocialAuthButtons intent="register" />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function describeSignupError(err: ApiError, t: (key: string) => string): string {
  if (err.status === 0) return err.message;
  if (err.status === 409) return t("signup.error409");
  if (err.status === 422) return t("signup.error422");
  return err.message || t("signup.errorDefault");
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
  title: { fontSize: 25, fontWeight: "800", color: colors.ink, textAlign: "center", marginBottom: spacing.lg },
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
  secondaryLink: { marginTop: spacing.md, alignItems: "center" },
  secondaryLinkText: { color: colors.blue, fontSize: 14, fontWeight: "600" },
});
