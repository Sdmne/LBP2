import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";

export default function VerifyCodeScreen() {
  const { user, confirmEmailCode, resendEmailVerification, logout } = useAuth();
  const { t, locale } = useI18n();
  const inputRef = useRef<TextInput>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(60);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  async function submit() {
    if (code.length !== 6 || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await confirmEmailCode(code);
    } catch (error) {
      setNotice(error instanceof ApiError && error.status === 400 ? t("verifyCode.invalid") : t("common.somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (seconds > 0 || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const status = await resendEmailVerification(locale);
      setNotice(status === "EMAIL_DELIVERY_FAILED" ? t("verifyCode.deliveryFailed") : t("verifyCode.resent"));
      setSeconds(60);
    } catch {
      setNotice(t("common.somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.container}>
        <Image source={require("../../assets/icon.png")} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>{t("verifyCode.title")}</Text>
        <Text style={styles.subtitle}>{t("verifyCode.subtitle", { email: user?.email || "" })}</Text>

        <Pressable style={styles.codeRow} onPress={() => inputRef.current?.focus()} accessibilityRole="button">
          {Array.from({ length: 6 }, (_, index) => (
            <View key={index} style={[styles.codeCell, index === code.length && code.length < 6 && styles.codeCellActive]}>
              <Text style={styles.codeDigit}>{code[index] || ""}</Text>
            </View>
          ))}
        </Pressable>
        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={6}
          style={styles.hiddenInput}
          accessibilityLabel={t("verifyCode.inputLabel")}
          autoFocus
        />

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        <Pressable style={[styles.primaryButton, code.length !== 6 && styles.buttonDisabled]} onPress={submit} disabled={busy || code.length !== 6}>
          {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>{t("verifyCode.submit")}</Text>}
        </Pressable>
        <Pressable style={styles.linkButton} onPress={resend} disabled={busy || seconds > 0}>
          <Text style={[styles.linkText, seconds > 0 && styles.linkDisabled]}>
            {seconds > 0 ? t("verifyCode.resendIn", { seconds }) : t("verifyCode.resend")}
          </Text>
        </Pressable>
        <Pressable style={styles.linkButton} onPress={() => void logout()} disabled={busy}>
          <Text style={styles.secondaryLink}>{t("verifyCode.signOut")}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg },
  logo: { width: 80, height: 80, borderRadius: radius.md, marginBottom: spacing.lg },
  title: { color: colors.ink, fontSize: 25, fontWeight: "800", textAlign: "center" },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: spacing.sm, maxWidth: 320 },
  codeRow: { flexDirection: "row", gap: 8, marginTop: spacing.xl, marginBottom: spacing.md },
  codeCell: { width: 42, height: 52, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  codeCellActive: { borderColor: colors.pink },
  codeDigit: { color: colors.ink, fontSize: 22, fontWeight: "700" },
  hiddenInput: { position: "absolute", width: 1, height: 1, opacity: 0 },
  notice: { color: colors.danger, fontSize: 13, textAlign: "center", marginBottom: spacing.sm },
  primaryButton: { width: "100%", maxWidth: 340, height: 54, borderRadius: radius.pill, backgroundColor: colors.pink, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  buttonDisabled: { opacity: 0.45 },
  primaryButtonText: { color: colors.white, fontSize: 15.5, fontWeight: "700" },
  linkButton: { padding: spacing.sm, marginTop: spacing.sm },
  linkText: { color: colors.blueDark, fontSize: 14, fontWeight: "600" },
  linkDisabled: { color: colors.muted },
  secondaryLink: { color: colors.muted, fontSize: 14 },
});
