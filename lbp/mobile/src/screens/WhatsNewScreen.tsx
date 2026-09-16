import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import type { RootStackParamList } from "../navigation/RootNavigator";
import GradientBackground from "../components/GradientBackground";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import { markWhatsNewSeen } from "../utils/whatsNew";
import { SITE_BASE_URL } from "../config";

// Mirrors the website's new homepage "What's new" section (Alena: "и в
// приложении надо какой-то экран создать при входе первый раз что
// появилось на сайте") - same 8 items, same three tiers, same target
// screens where a real route exists. Shown once ever per device (see
// utils/whatsNew.ts + the one-shot push in RootNavigator, same pattern
// already used for the post-signup ProfileWizard push) to every signed-in
// user, existing or new - not gated behind first-ever-login specifically,
// per Alena's explicit choice ("Всем существующим пользователям один раз").
//
// Two items have no standalone deep-link target of their own (same gap as
// on the website): Profile Boost lives inside the Me tab, and message
// starters live inside an existing chat thread - both fall back to the
// nearest generic screen (Me tab / Messages tab) rather than a dead link.
type ItemKey =
  | "boost"
  | "referral"
  | "safety"
  | "video"
  | "messages"
  | "insight"
  | "agreement"
  | "community"
  | "quizAi"
  | "askAi"
  | "agreementDraft"
  | "familyPlanAi";

type Tier = "free" | "builder" | "pro";

const ICONS: Record<ItemKey, keyof typeof Feather.glyphMap> = {
  boost: "zap",
  referral: "gift",
  safety: "shield",
  video: "check-circle",
  messages: "message-circle",
  insight: "trending-up",
  agreement: "file-text",
  community: "users",
  // Sept 2026 AI growth push (4 new items, item 25 in the project log) -
  // mirrors the website's landing-whatsnew "sparkle"/"message"/"agreement"
  // icons where they line up; askAi/agreementDraft have no in-app screen
  // of their own (they're public website tools), so openItem() below opens
  // them in the in-app browser instead of navigating to a native screen.
  quizAi: "star",
  askAi: "message-square",
  agreementDraft: "edit-3",
  familyPlanAi: "cpu",
};

const ITEMS: { key: ItemKey; tier: Tier; titleKey: string; bodyKey: string }[] = [
  { key: "boost", tier: "free", titleKey: "whatsnew.boostTitle", bodyKey: "whatsnew.boostBody" },
  { key: "referral", tier: "free", titleKey: "whatsnew.referralTitle", bodyKey: "whatsnew.referralBody" },
  { key: "safety", tier: "free", titleKey: "whatsnew.safetyTitle", bodyKey: "whatsnew.safetyBody" },
  { key: "video", tier: "free", titleKey: "whatsnew.videoTitle", bodyKey: "whatsnew.videoBody" },
  { key: "messages", tier: "builder", titleKey: "whatsnew.messagesTitle", bodyKey: "whatsnew.messagesBody" },
  { key: "insight", tier: "builder", titleKey: "whatsnew.insightTitle", bodyKey: "whatsnew.insightBody" },
  { key: "agreement", tier: "pro", titleKey: "whatsnew.agreementTitle", bodyKey: "whatsnew.agreementBody" },
  { key: "community", tier: "pro", titleKey: "whatsnew.communityTitle", bodyKey: "whatsnew.communityBody" },
  { key: "quizAi", tier: "free", titleKey: "whatsnew.quizAiTitle", bodyKey: "whatsnew.quizAiBody" },
  { key: "askAi", tier: "free", titleKey: "whatsnew.askAiTitle", bodyKey: "whatsnew.askAiBody" },
  { key: "agreementDraft", tier: "free", titleKey: "whatsnew.agreementDraftTitle", bodyKey: "whatsnew.agreementDraftBody" },
  { key: "familyPlanAi", tier: "pro", titleKey: "whatsnew.familyPlanAiTitle", bodyKey: "whatsnew.familyPlanAiBody" },
];

const TIER_COLORS: Record<Tier, { bg: string; text: string }> = {
  free: { bg: "#e7f6ec", text: "#1e8a4c" },
  builder: { bg: "#e8f1ff", text: colors.blueDark },
  pro: { bg: colors.tintPink, text: colors.pink },
};

export default function WhatsNewScreen() {
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  function tierLabel(tier: Tier) {
    if (tier === "free") return t("subscription.tierNameExploreShort");
    if (tier === "builder") return t("subscription.tierNameBuilderShort");
    return t("subscription.tierNameProShort");
  }

  function dismiss() {
    markWhatsNewSeen();
    navigation.replace("MainTabs");
  }

  function openItem(key: ItemKey) {
    markWhatsNewSeen();
    switch (key) {
      // Boost and message starters have no standalone route of their own
      // (Boost lives inside the Me tab, message starters inside an
      // existing chat thread) - land on the nearest tab instead.
      case "boost":
        navigation.replace("MainTabs", { screen: "Me" });
        return;
      case "messages":
        navigation.replace("MainTabs", { screen: "Messages" });
        return;
      case "referral":
        navigation.replace("Referral");
        return;
      case "safety":
        navigation.replace("SafetyCheckIn");
        return;
      case "video":
        navigation.replace("VideoVerification");
        return;
      case "insight":
        navigation.replace("AiAdvisor");
        return;
      case "agreement":
        // No generic entry point (needs a matched profileId) - same gap as
        // the website, which falls back to the pricing page.
        navigation.replace("Subscription");
        return;
      case "community":
        navigation.replace("Community");
        return;
      case "quizAi":
        // The AI reflection lives inside the existing quiz results screen
        // (a button there, not a separate route) - opening the quiz itself
        // gets a person straight to it either way.
        navigation.replace("CompatibilityQuiz");
        return;
      case "askAi":
      case "agreementDraft":
        // Both are free public website tools with no native screen of
        // their own (backend/main.py's public/ask-ai and
        // public/agreement-draft, item 25) - open them in the in-app
        // browser, same pattern SubscriptionScreen.tsx already uses for
        // the Terms/Privacy links.
        void WebBrowser.openBrowserAsync(`${SITE_BASE_URL}/${locale}/tools/${key === "askAi" ? "ask-ai" : "agreement-draft"}`);
        return;
      case "familyPlanAi":
        // No generic entry point (needs a matched profileId, same as
        // "agreement" above) - falls back to the pricing page since this
        // is a Family Builder Pro feature.
        navigation.replace("Subscription");
        return;
    }
  }

  return (
    <GradientBackground variant="vivid">
      <View style={{ flex: 1 }}>
        <Pressable
          style={[styles.closeButton, { top: insets.top + spacing.sm }]}
          onPress={dismiss}
          hitSlop={10}
        >
          <Feather name="x" size={20} color={colors.ink} />
        </Pressable>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + spacing.xl + spacing.lg, paddingBottom: spacing.xl + insets.bottom },
          ]}
        >
          <Text style={styles.eyebrow}>{t("whatsnew.eyebrow")}</Text>
          <Text style={styles.title}>{t("whatsnew.title")}</Text>
          <Text style={styles.intro}>{t("whatsnew.intro")}</Text>

          <View style={styles.list}>
            {ITEMS.map((item) => {
              const tierStyle = TIER_COLORS[item.tier];
              return (
                <Pressable key={item.key} style={styles.card} onPress={() => openItem(item.key)}>
                  <View style={styles.iconWrap}>
                    <Feather name={ICONS[item.key]} size={20} color={colors.white} />
                  </View>
                  <View style={styles.cardBody}>
                    <View style={[styles.tierBadge, { backgroundColor: tierStyle.bg }]}>
                      <Text style={[styles.tierBadgeText, { color: tierStyle.text }]}>{tierLabel(item.tier)}</Text>
                    </View>
                    <Text style={styles.cardTitle}>{t(item.titleKey)}</Text>
                    <Text style={styles.cardBodyText}>{t(item.bodyKey)}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#a3a3a3" />
                </Pressable>
              );
            })}
          </View>

          <Pressable style={styles.ctaButton} onPress={dismiss}>
            <Text style={styles.ctaButtonText}>{t("whatsnew.continue")}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    position: "absolute",
    right: spacing.md,
    zIndex: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: { paddingHorizontal: spacing.lg },
  eyebrow: { fontSize: 12.5, fontWeight: "800", letterSpacing: 1.5, color: colors.pink, textAlign: "center" },
  title: { fontSize: 26, fontWeight: "800", color: colors.ink, textAlign: "center", marginTop: spacing.sm, lineHeight: 32 },
  intro: { fontSize: 14.5, color: colors.mutedOnGradient, textAlign: "center", marginTop: spacing.sm, lineHeight: 21, marginBottom: spacing.lg },
  list: { gap: spacing.sm },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.pink,
  },
  cardBody: { flex: 1, minWidth: 0 },
  tierBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, marginBottom: 4 },
  tierBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase" },
  cardTitle: { fontSize: 14.5, fontWeight: "700", color: colors.ink },
  cardBodyText: { fontSize: 12.5, color: colors.muted, marginTop: 2, lineHeight: 17 },
  ctaButton: {
    backgroundColor: colors.pink,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  ctaButtonText: { color: colors.white, fontSize: 15, fontWeight: "800" },
});
