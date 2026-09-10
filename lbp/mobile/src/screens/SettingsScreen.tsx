import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { fetchSettings, updateSettings } from "../api/settings";
import { ApiError } from "../api/client";
import type { MemberSettings, NotificationSetting } from "../api/types";
import { useI18n, SUPPORTED_LOCALES, type Locale } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GradientBackground from "../components/GradientBackground";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { Feather } from "@expo/vector-icons";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

// Keys into NOTIFICATION_LABELS below are the 5 fixed notification types the
// backend knows about (DEFAULT_NOTIFICATION_SETTINGS in main.py: NEW_MATCH,
// NEW_LIKE, NEW_MESSAGE, PROFILE_VIEW, MARKETING).
const NOTIFICATION_KEYS: Record<string, string> = {
  NEW_MATCH: "settings.notif.NEW_MATCH",
  NEW_LIKE: "settings.notif.NEW_LIKE",
  NEW_MESSAGE: "settings.notif.NEW_MESSAGE",
  PROFILE_VIEW: "settings.notif.PROFILE_VIEW",
  MARKETING: "settings.notif.MARKETING",
};

// Restyled (Sep 2026) to match the prototype's #scr-app-settings: grouped
// white "pf-card" sections with a section title above each, hairline-
// divided rows inside, and colored icon-wrap circles for the account
// sub-navigation links (.pf-card/.menu-row) instead of the earlier flat
// list of separately-boxed rows. Only restyled - no new settings were
// added or removed (no logout/delete-account row here, since neither
// exists in this screen or its navigation today; adding either would be a
// new feature, not a design pass).
export default function SettingsScreen({ navigation }: Props) {
  const { t, locale, setLocale } = useI18n();
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<MemberSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings()
      .then(setSettings)
      .catch((err) => setError(err instanceof ApiError ? err.message : t("settings.loadError")))
      .finally(() => setLoading(false));
  }, [t]);

  // Same field the site's Settings page writes (interfaceLanguage) - saving
  // it here means someone who set their language in the app sees the same
  // language on the website too, and vice versa (see src/i18n/I18nContext.tsx,
  // which reads this field back on login).
  async function changeLanguage(next: Locale) {
    if (!settings || next === locale) return;
    const previous = locale;
    setLocale(next); // instant UI switch, optimistic
    setSettings({ ...settings, interfaceLanguage: next });
    setSavingKey("interfaceLanguage");
    try {
      await updateSettings({ interfaceLanguage: next });
    } catch {
      setLocale(previous);
      setSettings((prev) => (prev ? { ...prev, interfaceLanguage: previous } : prev));
    } finally {
      setSavingKey(null);
    }
  }

  async function toggleVisible(value: boolean) {
    if (!settings) return;
    setSettings({ ...settings, visibleInCatalog: value });
    setSavingKey("visibleInCatalog");
    try {
      await updateSettings({ visibleInCatalog: value });
    } catch {
      setSettings((prev) => (prev ? { ...prev, visibleInCatalog: !value } : prev));
    } finally {
      setSavingKey(null);
    }
  }

  async function toggleNotification(type: string, value: boolean) {
    if (!settings) return;
    const next: NotificationSetting[] = settings.notificationSettings.map((row) =>
      row.type === type ? { ...row, emailEnabled: value } : row,
    );
    setSettings({ ...settings, notificationSettings: next });
    setSavingKey(type);
    try {
      await updateSettings({ notificationSettings: next });
    } catch {
      setSettings((prev) => (prev ? { ...prev, notificationSettings: settings.notificationSettings } : prev));
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

  if (error || !settings) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || t("settings.loadError")}</Text>
      </View>
    );
  }

  const accountLinks: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void }[] = [
    { icon: "image", label: t("settings.photos"), onPress: () => navigation.navigate("Photos") },
    { icon: "check-circle", label: t("settings.verification"), onPress: () => navigation.navigate("Verification") },
    { icon: "star", label: t("settings.premium"), onPress: () => navigation.navigate("Subscription") },
    { icon: "slash", label: t("settings.blockedUsers"), onPress: () => navigation.navigate("BlockedUsers") },
    { icon: "bookmark", label: t("settings.savedListings"), onPress: () => navigation.navigate("Favourites") },
    { icon: "heart", label: t("settings.compatibilityProfile"), onPress: () => navigation.navigate("CompatibilityAnswers") },
    { icon: "lock", label: t("settings.privacy"), onPress: () => navigation.navigate("Privacy") },
    { icon: "trash-2", label: t("settings.deleteAccount"), onPress: () => navigation.navigate("DeleteAccount") },
  ];

  return (
    <GradientBackground variant="soft">
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: spacing.xl + insets.bottom }]}>
      <Text style={styles.sectionTitle}>{t("settings.discovery")}</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t("settings.showInBrowse")}</Text>
          <Switch value={settings.visibleInCatalog} onValueChange={toggleVisible} disabled={savingKey === "visibleInCatalog"} />
        </View>
      </View>

      <Text style={styles.sectionTitle}>{t("settings.language")}</Text>
      <View style={styles.languageRow}>
        {SUPPORTED_LOCALES.map((entry) => {
          const active = locale === entry.code;
          return (
            <Pressable
              key={entry.code}
              style={[styles.languageChip, active && styles.languageChipActive]}
              onPress={() => void changeLanguage(entry.code)}
              disabled={savingKey === "interfaceLanguage"}
            >
              <Text style={[styles.languageChipText, active && styles.languageChipTextActive]}>{entry.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>{t("settings.emailNotifications")}</Text>
      <View style={styles.card}>
        {settings.notificationSettings.map((row, index) => (
          <View key={row.type} style={[styles.row, index < settings.notificationSettings.length - 1 && styles.rowDivider]}>
            <Text style={styles.rowLabel}>{NOTIFICATION_KEYS[row.type] ? t(NOTIFICATION_KEYS[row.type]) : row.type}</Text>
            <Switch value={row.emailEnabled} onValueChange={(value) => toggleNotification(row.type, value)} disabled={savingKey === row.type} />
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>{t("settings.account")}</Text>
      <View style={styles.card}>
        {accountLinks.map((link, index) => (
          <Pressable
            key={link.label}
            style={[styles.menuRow, index < accountLinks.length - 1 && styles.rowDivider]}
            onPress={link.onPress}
          >
            <View style={styles.iconWrap}>
              <Feather name={link.icon} size={16} color={colors.pink} />
            </View>
            <Text style={styles.linkText}>{link.label}</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>{t("settings.legal")}</Text>
      <View style={styles.card}>
        <Pressable style={styles.menuRow} onPress={() => navigation.navigate("Terms")}>
          <View style={styles.iconWrap}>
            <Feather name="file-text" size={16} color={colors.pink} />
          </View>
          <Text style={styles.linkText}>{t("settings.termsPrivacy")}</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </View>
    </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: colors.danger },
  container: { padding: spacing.md, paddingBottom: spacing.xl, backgroundColor: "transparent" },
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: spacing.lg,
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
    paddingVertical: 13,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  rowLabel: { fontSize: 14.5, color: colors.ink },
  languageRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  languageChip: {
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: colors.card,
  },
  languageChipActive: { backgroundColor: colors.pink, borderColor: colors.pink },
  languageChipText: { fontSize: 13, fontWeight: "600", color: colors.ink },
  languageChipTextActive: { color: colors.white },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  iconWrap: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: colors.tintPink },
  linkText: { flex: 1, fontSize: 14.5, color: colors.ink },
  chevron: { fontSize: 18, color: colors.muted },
});
