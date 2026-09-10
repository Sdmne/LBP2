import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { fetchPrivacyConsent, savePrivacyConsent } from "../api/privacy";
import type { ConsentCategory, PrivacyConsentState } from "../api/privacy";
import { ApiError } from "../api/client";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GradientBackground from "../components/GradientBackground";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Privacy">;

// Real, per-member analytics/marketing consent (Sept 2026) - backed by the
// dedicated profile_consents table (see main.py's own comment block above
// GET/POST /api/member/privacy/consent), not a local-only switch. This is
// NOT the same thing as the "Marketing" row under Settings > Notifications
// (that one is whether to receive marketing push/email - a delivery
// preference); this screen is consent for being tracked at all.
//
// Honest by design: as of this build, neither the app nor the website has
// any analytics or marketing SDK wired in, so these toggles have nothing
// real to switch on/off yet - the banner below says so plainly rather than
// implying an off switch for tracking that doesn't exist.
const CATEGORIES: { key: ConsentCategory; titleKey: string; bodyKey: string }[] = [
  { key: "analytics", titleKey: "privacy.analyticsTitle", bodyKey: "privacy.analyticsBody" },
  { key: "marketing", titleKey: "privacy.marketingTitle", bodyKey: "privacy.marketingBody" },
];

export default function PrivacyScreen({ navigation }: Props) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [consent, setConsent] = useState<PrivacyConsentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<ConsentCategory | null>(null);

  useEffect(() => {
    fetchPrivacyConsent()
      .then((res) => setConsent(res.consent))
      .catch((err) => setError(err instanceof ApiError ? err.message : t("privacy.loadError")))
      .finally(() => setLoading(false));
  }, [t]);

  async function toggle(category: ConsentCategory, value: boolean) {
    if (!consent) return;
    const previous = consent;
    setConsent({ ...consent, [category]: { granted: value, decided: true, updatedAt: new Date().toISOString() } });
    setSavingKey(category);
    setError(null);
    try {
      const res = await savePrivacyConsent({ [category]: value });
      setConsent(res.consent);
    } catch (err) {
      setConsent(previous);
      setError(err instanceof ApiError ? err.message : t("privacy.saveError"));
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.pink} />
      </View>
    );
  }

  if (!consent) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || t("privacy.loadError")}</Text>
      </View>
    );
  }

  return (
    <GradientBackground variant="soft">
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: spacing.xl + insets.bottom }]}>
      <View style={styles.honestyBanner}>
        <Text style={styles.honestyBannerText}>{t("privacy.honestyNote")}</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Text style={styles.sectionTitle}>{t("privacy.sectionTitle")}</Text>
      <View style={styles.card}>
        {CATEGORIES.map((category, index) => {
          const state = consent[category.key];
          return (
            <View key={category.key} style={[styles.row, index > 0 && styles.rowDivider]}>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{t(category.titleKey)}</Text>
                <Text style={styles.rowBody}>{t(category.bodyKey)}</Text>
                <Text style={styles.rowMeta}>
                  {state.decided
                    ? state.granted
                      ? t("privacy.statusOn")
                      : t("privacy.statusOff")
                    : t("privacy.statusUndecided")}
                </Text>
              </View>
              <Switch
                value={state.granted}
                onValueChange={(value) => toggle(category.key, value)}
                disabled={savingKey === category.key}
              />
            </View>
          );
        })}
        <View style={[styles.row, styles.rowDivider]}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>{t("privacy.strictlyNecessaryTitle")}</Text>
            <Text style={styles.rowBody}>{t("privacy.strictlyNecessaryBody")}</Text>
          </View>
          <Switch value={true} disabled />
        </View>
      </View>

      <Pressable style={styles.deleteRow} onPress={() => navigation.navigate("DeleteAccount")}>
        <Text style={styles.deleteRowText}>{t("privacy.deleteAccount")}</Text>
      </Pressable>

      <Text style={styles.footnote}>{t("privacy.footnote")}</Text>
    </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: colors.danger, fontSize: 13, marginBottom: spacing.xs },
  container: { padding: spacing.md, backgroundColor: "transparent", gap: spacing.xs },
  honestyBanner: {
    backgroundColor: colors.tint,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  honestyBannerText: { fontSize: 13, color: colors.ink, lineHeight: 18 },
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: spacing.md,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.line },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 14.5, fontWeight: "700", color: colors.ink },
  rowBody: { fontSize: 12.5, color: colors.muted, lineHeight: 17 },
  rowMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  deleteRow: { marginTop: spacing.md, alignItems: "center", paddingVertical: spacing.sm },
  deleteRowText: { color: colors.danger, fontSize: 14.5, fontWeight: "700" },
  footnote: { fontSize: 11.5, color: colors.muted, lineHeight: 16, marginTop: spacing.md },
});
