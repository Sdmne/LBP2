import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import * as Application from "expo-application";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as WebBrowser from "expo-web-browser";
import { fetchSettings, updateSettings } from "../api/settings";
import { ApiError } from "../api/client";
import type { MemberSettings, NotificationSetting } from "../api/types";
import { useI18n, SUPPORTED_LOCALES, type Locale } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GradientBackground from "../components/GradientBackground";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { Feather } from "@expo/vector-icons";
import { SITE_BASE_URL } from "../config";

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

  // Incognito browsing - premium roadmap step 2 (step 1 was CatalogScreen's
  // Rewind button). Pro-only: tapping it on a non-Pro account shows the
  // same upgrade Alert pattern already used by FiltersScreen's premium-
  // locked fields and CatalogScreen's Rewind button, instead of a new
  // custom paywall UI. incognitoAvailable comes from the server (reflects
  // the CURRENT subscription, not a cached "ever paid" flag), so this
  // stays accurate even if a Pro subscription lapses without the app being
  // reopened first.
  function toggleIncognito(value: boolean) {
    if (!settings) return;
    if (!settings.incognitoAvailable) {
      Alert.alert(t("settings.incognitoLockedTitle"), t("settings.incognitoLockedBody"), [
        { text: t("filters.premiumLockedCancel"), style: "cancel" },
        { text: t("filters.premiumLockedUpgrade"), onPress: () => navigation.navigate("Subscription") },
      ]);
      return;
    }
    setSettings({ ...settings, incognitoEnabled: value });
    setSavingKey("incognitoEnabled");
    updateSettings({ incognitoEnabled: value })
      .catch(() => setSettings((prev) => (prev ? { ...prev, incognitoEnabled: !value } : prev)))
      .finally(() => setSavingKey(null));
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
    { icon: "video", label: t("settings.videoVerification"), onPress: () => navigation.navigate("VideoVerification") },
    { icon: "star", label: t("settings.premium"), onPress: () => navigation.navigate("Subscription") },
    { icon: "message-circle", label: t("settings.aiAdvisor"), onPress: () => navigation.navigate("AiAdvisor") },
    // Alena: "А где эти новые фичи в кабинете приложение" - the 4 new AI
    // tools from item 25 (quiz reflection / Ask AI / Agreement Draft /
    // Family Plan AI-assist) previously only surfaced through the one-shot
    // What's New screen (WhatsNewScreen.tsx), with no permanent way back to
    // them once that screen had been dismissed once per device. Family
    // Plan AI-assist has no standalone entry point of its own (it's a
    // per-section button inside an existing matched Family Room, not a
    // screen you navigate to directly - same gap WhatsNewScreen's own
    // "familyPlanAi" case documents), so it isn't listed here either; the
    // other three get real, permanent rows using the exact same
    // navigation/browser-opening logic WhatsNewScreen already uses for them.
    { icon: "sunrise", label: t("whatsnew.quizAiTitle"), onPress: () => navigation.navigate("CompatibilityQuiz") },
    {
      icon: "message-square",
      label: t("whatsnew.askAiTitle"),
      onPress: () => void WebBrowser.openBrowserAsync(`${SITE_BASE_URL}/${locale}/tools/ask-ai`),
    },
    {
      icon: "edit-3",
      label: t("whatsnew.agreementDraftTitle"),
      onPress: () => void WebBrowser.openBrowserAsync(`${SITE_BASE_URL}/${locale}/tools/agreement-draft`),
    },
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
        <View style={[styles.row, styles.rowDivider]}>
          <View>
            <View style={styles.rowLabelWithBadge}>
              <Text style={styles.rowLabel}>{t("settings.incognito")}</Text>
              {!settings.incognitoAvailable ? <Text style={styles.proBadge}>{t("settings.proBadge")}</Text> : null}
            </View>
            <Text style={styles.rowSubLabel}>{t("settings.incognitoSubtitle")}</Text>
          </View>
          <Switch
            value={settings.incognitoAvailable && settings.incognitoEnabled}
            onValueChange={toggleIncognito}
            disabled={savingKey === "incognitoEnabled"}
          />
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

      {/* Alena: "здесь тоже надо добавить про пуш" - this list of toggles
          already gates NEW_MATCH/NEW_LIKE/NEW_MESSAGE/PROFILE_VIEW/
          MARKETING on the backend (notification_preference_enabled() in
          main.py), and send_profile_notification() now sends a push alert
          through the same per-type gate whenever the profile has a
          registered push token, alongside email - see item 16. So the
          section title/caption here now say "Notifications" covering both
          channels, not just email, without adding a second set of toggles
          nobody asked for. */}
      <Text style={styles.sectionTitle}>{t("settings.emailNotifications")}</Text>
      <Text style={styles.sectionCaption}>{t("settings.notificationsCaption")}</Text>
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
        <Pressable style={styles.menuRow} onPress={() => navigation.navigate("TrustSafety")}>
          <View style={styles.iconWrap}>
            <Feather name="shield" size={16} color={colors.pink} />
          </View>
          <Text style={styles.linkText}>{t("settings.trustSafety")}</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </View>

      {/* Small diagnostic footer - lets Alena screenshot exactly which build
          and OTA update her phone is running when something "doesn't
          update", instead of guessing blind (2026-09-13: the Pro-tier
          plan-picker fix wasn't showing up after restarts, and there was no
          way to tell from the app itself whether the update had even been
          downloaded). Updates.updateId is null when running the embedded
          bundle (no OTA update ever applied since install), not an error. */}
      <Text style={styles.versionFooter}>
        v{Application.nativeApplicationVersion ?? "?"} ({Application.nativeBuildVersion ?? "?"})
      </Text>
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
  sectionCaption: {
    fontSize: 12.5,
    color: colors.muted,
    marginTop: -4,
    marginBottom: 8,
    lineHeight: 17,
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
  rowLabelWithBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowSubLabel: { fontSize: 12, color: colors.muted, marginTop: 2, maxWidth: 240 },
  proBadge: {
    fontSize: 10,
    fontWeight: "700",
    color: "#8a6d1f",
    backgroundColor: "#f6e6b8",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
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
  versionFooter: { fontSize: 11, color: colors.muted, textAlign: "center", marginTop: spacing.lg },
});
