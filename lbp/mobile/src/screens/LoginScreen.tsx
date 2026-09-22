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
            {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText} numberOfLines={1}>{t("login.submit")}</Text>}
          </Pressable>

          <Pressable onPress={() => navigation.navigate("ForgotPassword")} style={styles.outlineButton}>
            <Text style={styles.outlineButtonText} numberOfLines={1}>{t("login.forgotPassword")}</Text>
          </Pressable>

          <Pressable onPress={() => navigation.navigate("Signup")} style={styles.secondaryLink}>
            <Text style={styles.secondaryLinkText}>{t("login.noAccount")}</Text>
          </Pressable>

          {/* Alena: "or continue with надо прижать к нижней границе окна" -
              this spacer only does anything when the form is shorter than
              the screen (nothing to push against once content needs to
              scroll), which is the same "pin to bottom inside a
              ScrollView" trick as elsewhere in this app. */}
          <View style={styles.bottomSpacer} />
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
  // Alena: "отступ перед названием страницы отсутствует" - a bit more air
  // between the logo and the "Welcome back"/"Create your account" title
  // below it.
  logoWrap: { alignItems: "center", marginBottom: spacing.lg },
  // Alena: "огромное лого" - this was bumped up to 230x160 in an earlier
  // round (see the removed comment citing the prototype's 190px), which
  // read as too big once seen on a real device. Scaled back down, still
  // above the original 84px this whole thing started from.
  logo: { width: 148, height: 103 }, // logo-full.png is 900x625 - keep that aspect ratio
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
  // Alena: "labels ближе к предыдущему полю, чем к своему" - this used a
  // uniform `gap: spacing.sm` between every direct child PLUS label's own
  // marginBottom, so a label ended up 8px from the field above it (just
  // the parent gap) but 16px from its own field below it (gap + its
  // marginBottom) - the reverse of what a form label should do. Explicit
  // margins on the label itself instead of a parent gap: more space
  // before it (separating from the previous field), less after (binding
  // it to its own input).
  form: { flexGrow: 1 },
  label: { fontSize: 14.5, fontWeight: "700", color: colors.ink, marginTop: spacing.md, marginBottom: 6 },
  bottomSpacer: { flexGrow: 1, minHeight: spacing.lg },
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
