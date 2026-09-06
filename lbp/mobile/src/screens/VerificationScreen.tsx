import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { fetchVerificationStatus, startVerification } from "../api/verification";
import { ApiError } from "../api/client";
import type { VerificationStatus } from "../api/types";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";

const STATUS_KEYS: Record<string, { title: string; body: string }> = {
  NOT_STARTED: { title: "verification.notStartedTitle", body: "verification.notStartedBody" },
  PENDING: { title: "verification.pendingTitle", body: "verification.pendingBody" },
  IN_REVIEW: { title: "verification.inReviewTitle", body: "verification.inReviewBody" },
  APPROVED: { title: "verification.approvedTitle", body: "verification.approvedBody" },
  DECLINED: { title: "verification.declinedTitle", body: "verification.declinedBody" },
  EXPIRED: { title: "verification.expiredTitle", body: "verification.expiredBody" },
  ABANDONED: { title: "verification.abandonedTitle", body: "verification.abandonedBody" },
};

export default function VerificationScreen() {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setStatus(await fetchVerificationStatus());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("verification.loadError"));
    }
  }, [t]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function handleStart() {
    setStarting(true);
    setError(null);
    try {
      const res = await startVerification(locale);
      if (res.url) {
        await WebBrowser.openBrowserAsync(res.url);
        // The person completes verification in the browser, then Didit
        // calls the backend's webhook - refresh once they're back.
        await load();
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(t("verification.needPhotoFirst"));
      } else if (err instanceof ApiError && err.status === 503) {
        setError(t("verification.notConfigured"));
      } else {
        setError(err instanceof ApiError ? err.message : t("verification.startError"));
      }
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.pink} />
      </View>
    );
  }

  const statusKeys = status ? STATUS_KEYS[status.status] : null;
  const title = statusKeys ? t(statusKeys.title) : status?.status;
  const body = statusKeys ? t(statusKeys.body) : "";
  const canStart = status && ["NOT_STARTED", "DECLINED", "EXPIRED", "ABANDONED"].includes(status.status);
  const hasActiveSession = status && ["PENDING", "IN_REVIEW"].includes(status.status) && status.url;

  return (
    <View style={styles.container}>
      {status ? (
        <>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
        </>
      ) : null}

      {status && !status.primaryPhoto ? (
        <Text style={styles.notice}>{t("verification.needPhoto")}</Text>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {canStart || hasActiveSession ? (
        <Pressable style={styles.button} onPress={handleStart} disabled={starting}>
          {starting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>{hasActiveSession ? t("verification.continue") : t("verification.start")}</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { flex: 1, padding: spacing.lg, gap: spacing.sm },
  title: { fontSize: 20, fontWeight: "800", color: colors.ink },
  body: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  notice: { fontSize: 13, color: colors.premium, marginTop: spacing.xs },
  errorText: { fontSize: 13, color: colors.danger, marginTop: spacing.xs },
  button: {
    backgroundColor: colors.pink,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  buttonText: { color: colors.white, fontWeight: "700" },
});
