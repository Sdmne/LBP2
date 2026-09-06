import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { fetchSubscriptionStatus, requestSubscription } from "../api/subscription";
import { ApiError } from "../api/client";
import type { SubscriptionStatus } from "../api/types";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";

// "quarterly" is left out here on purpose - see the comment in
// src/api/subscription.ts, the backend currently rejects it.
const PLANS: { key: "monthly" | "annual"; labelKey: string }[] = [
  { key: "monthly", labelKey: "subscription.monthly" },
  { key: "annual", labelKey: "subscription.annual" },
];

export default function SubscriptionScreen() {
  const { t } = useI18n();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setStatus(await fetchSubscriptionStatus());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("subscription.loadError"));
    }
  }, [t]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function handleRequest(plan: "monthly" | "annual") {
    setRequesting(plan);
    setError(null);
    setMessage(null);
    try {
      const res = await requestSubscription(plan);
      setMessage(res.message || t("subscription.requestSentDefault"));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("subscription.requestError"));
    } finally {
      setRequesting(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.pink} />
      </View>
    );
  }

  if (!status) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (status.status === "VERIFICATION_REQUIRED") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t("subscription.verificationRequiredTitle")}</Text>
        <Text style={styles.body}>{t("subscription.verificationRequiredBody")}</Text>
      </View>
    );
  }

  if (status.isPremium) {
    return (
      <View style={styles.container}>
        <Text style={styles.badge}>{t("subscription.activeTitle")}</Text>
        <Text style={styles.body}>{t("subscription.activeBody")}</Text>
      </View>
    );
  }

  if (status.status === "PENDING") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t("subscription.pendingTitle")}</Text>
        <Text style={styles.body}>
          {t("subscription.pendingBody", { plan: status.request?.plan || t("subscription.pendingPlanFallback") })}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("subscription.title")}</Text>
      <Text style={styles.body}>{t("subscription.body")}</Text>
      {message ? <Text style={styles.success}>{message}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {PLANS.map((plan) => (
        <Pressable
          key={plan.key}
          style={styles.button}
          onPress={() => handleRequest(plan.key)}
          disabled={requesting !== null}
        >
          {requesting === plan.key ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>{t("subscription.requestButton", { plan: t(plan.labelKey) })}</Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { flex: 1, padding: spacing.lg, gap: spacing.sm },
  title: { fontSize: 20, fontWeight: "800", color: colors.ink },
  body: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  badge: { fontSize: 20, fontWeight: "800", color: colors.premium },
  success: { fontSize: 13, color: colors.success },
  errorText: { fontSize: 13, color: colors.danger },
  button: {
    backgroundColor: colors.pink,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  buttonText: { color: colors.white, fontWeight: "700" },
});
