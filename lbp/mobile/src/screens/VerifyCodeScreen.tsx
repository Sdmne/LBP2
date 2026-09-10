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
  container: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  logo: { width: 64, height: 64, marginBottom: spacing.md },
  title: { fontSize: 21, fontWeight: "800", color: colors.ink, textAlign: "center", marginBottom: 10 },
  subtitle: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20, marginBottom: spacing.lg },
  codeRow: { flexDirection: "row", gap: 8, marginBottom: spacing.lg },
  codeCell: {
    width: 44,
    height: 54,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  codeCellActive: { borderColor: colors.pink },
  codeDigit: { fontSize: 22, fontWeight: "700", color: colors.ink },
  hiddenInput: { position: "absolute", opacity: 0, height: 1, width: 1 },
  notice: { fontSize: 13, color: colors.danger, textAlign: "center", marginBottom: spacing.md },
  primaryButton: {
    width: "100%",
    height: 52,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.pink,
    marginBottom: spacing.sm,
  },
  buttonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: "#fff", fontSize: 14.5, fontWeight: "700" },
  linkButton: { marginTop: spacing.sm, padding: spacing.sm },
  linkText: { color: colors.pink, fontSize: 13.5, fontWeight: "600" },
  linkDisabled: { color: colors.muted },
  secondaryLink: { color: colors.muted, fontSize: 13.5, fontWeight: "600" },
});
