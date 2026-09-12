import React, { useRef, useState } from "react";
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ActivityIndicator } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { requestSubscription, type RequestableTier, type SubscriptionPlan } from "../api/subscription";
import { ApiError } from "../api/client";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "LikesPaywall">;

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Item 0(b) - the polished, sales-oriented paywall screen Alena asked for
// ("когда нажимаешь посмотреть все лайки должен выскакивает очень
// продающий экран типа как у her"), reachable from the Likes screen's
// upgrade entry points. Two things this deliberately does NOT copy from
// her "her" reference, both to stay honest about what this app actually
// does:
// - No weekly/annual options or invented "Save 64%/82%/85%" badges - only
//   the three plan+period combinations with a real, already-confirmed
//   price exist anywhere in this codebase (SubscriptionScreen.tsx), and
//   the one savings badge shown (33%) is the real Builder
//   monthly-vs-quarterly math, not a made-up number.
// - No "auto-renews" / billing disclaimer - subscription.body already
//   states plainly that these are requests a human reviews, not live
//   in-app billing yet (no RevenueCat/IAP integration exists), so this
//   screen reuses that exact copy instead of implying real subscription
//   billing that isn't there.
const SLIDES = [
  { icon: "heart" as const, titleKey: "likes.previewLockedTitle", bodyKey: "likes.previewLockedBody" },
  { icon: "eye" as const, titleKey: "paywall.visitorsTitle", bodyKey: "paywall.visitorsBody" },
  { icon: "activity" as const, titleKey: "paywall.compatibilityTitle", bodyKey: "paywall.compatibilityBody" },
] as const;

type PlanOption = { tier: RequestableTier; period: SubscriptionPlan; nameKey: string; priceKey: string; badgeKey?: string };

const PLAN_OPTIONS: PlanOption[] = [
  { tier: "BUILDER", period: "monthly", nameKey: "subscription.tierNameBuilderShort", priceKey: "subscription.priceBuilderMonthly" },
  {
    tier: "BUILDER",
    period: "quarterly",
    nameKey: "subscription.tierNameBuilderShort",
    priceKey: "subscription.priceBuilderQuarterly",
    badgeKey: "paywall.save33Badge",
  },
  { tier: "PRO", period: "monthly", nameKey: "subscription.tierNameProShort", priceKey: "subscription.priceProMonthly" },
];

export default function LikesPaywallScreen({ navigation }: Props) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [slideIndex, setSlideIndex] = useState(0);
  const [selected, setSelected] = useState(1); // default to the real-savings Builder quarterly card
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  function onSlideScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (index !== slideIndex) setSlideIndex(index);
  }

  async function handleContinue() {
    const plan = PLAN_OPTIONS[selected];
    setRequesting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await requestSubscription(plan.period, plan.tier);
      setMessage(res.message || t("subscription.requestSentDefault"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("subscription.requestError"));
    } finally {
      setRequesting(false);
    }
  }

  const selectedPlan = PLAN_OPTIONS[selected];

  return (
    <View style={styles.container}>
      <ScrollView bounces={false} contentContainerStyle={{ paddingBottom: spacing.xl + insets.bottom }}>
        <View style={styles.hero}>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onSlideScroll}
          >
            {SLIDES.map((slide, index) => (
              <LinearGradient
                key={index}
                colors={["#4e9bff", "#f070a9"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.slide, { width: SCREEN_WIDTH }]}
              >
                <View style={styles.slideIconWrap}>
                  <Feather name={slide.icon} size={30} color={colors.white} />
                </View>
                <Text style={styles.slideTitle}>{t(slide.titleKey)}</Text>
                <Text style={styles.slideBody}>{t(slide.bodyKey)}</Text>
              </LinearGradient>
            ))}
          </ScrollView>
          <View style={styles.dotsRow}>
            {SLIDES.map((_, index) => (
              <View key={index} style={[styles.dot, index === slideIndex && styles.dotActive]} />
            ))}
          </View>
          <Pressable
            style={[styles.closeButton, { top: insets.top + spacing.sm }]}
            onPress={() => navigation.goBack()}
            hitSlop={10}
          >
            <Feather name="x" size={20} color={colors.white} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={styles.sectionTitle}>{t("subscription.compareTitle")}</Text>

          {PLAN_OPTIONS.map((option, index) => {
            const isSelected = selected === index;
            return (
              <Pressable
                key={index}
                style={[styles.planCard, isSelected && styles.planCardSelected]}
                onPress={() => setSelected(index)}
              >
                <View style={styles.planCardMain}>
                  <View style={styles.planCardNameRow}>
                    <Text style={styles.planCardName}>{t(option.nameKey)}</Text>
                    {option.badgeKey ? (
                      <View style={styles.planBadge}>
                        <Text style={styles.planBadgeText}>{t(option.badgeKey)}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.planCardPrice}>{t(option.priceKey)}</Text>
                </View>
                <Feather
                  name={isSelected ? "check-circle" : "circle"}
                  size={22}
                  color={isSelected ? colors.pink : colors.line}
                />
              </Pressable>
            );
          })}

          <Text style={styles.disclaimer}>{t("subscription.body")}</Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {message ? <Text style={styles.messageText}>{message}</Text> : null}

          {message ? (
            <Pressable style={styles.ctaButton} onPress={() => navigation.goBack()}>
              <Text style={styles.ctaButtonText}>{t("common.done")}</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.ctaButton} onPress={handleContinue} disabled={requesting}>
              {requesting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.ctaButtonText}>
                  {t("subscription.getPlanButton", { plan: t(selectedPlan.nameKey), price: t(selectedPlan.priceKey) })}
                </Text>
              )}
            </Pressable>
          )}

          {!message ? (
            <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.notNow}>
              <Text style={styles.notNowText}>{t("paywall.notNow")}</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  hero: { position: "relative" },
  slide: { height: 320, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  slideIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  slideTitle: { fontSize: 22, fontWeight: "800", color: colors.white, textAlign: "center", marginBottom: 8 },
  slideBody: { fontSize: 14, color: "rgba(255,255,255,0.9)", textAlign: "center", lineHeight: 20 },
  dotsRow: { position: "absolute", bottom: spacing.md, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.45)" },
  dotActive: { backgroundColor: colors.white, width: 18 },
  closeButton: {
    position: "absolute",
    right: spacing.md,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  body: { padding: spacing.lg },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: colors.ink, marginBottom: spacing.md },
  planCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.line,
    marginBottom: spacing.sm,
  },
  planCardSelected: { borderColor: colors.pink, backgroundColor: colors.tintPink },
  planCardMain: { flex: 1 },
  planCardNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  planCardName: { fontSize: 15, fontWeight: "800", color: colors.ink },
  planBadge: { backgroundColor: colors.pink, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  planBadgeText: { fontSize: 10.5, fontWeight: "800", color: colors.white },
  planCardPrice: { fontSize: 13.5, color: colors.muted, marginTop: 2 },
  disclaimer: { fontSize: 11.5, color: colors.muted, textAlign: "center", marginTop: spacing.sm, marginBottom: spacing.md, lineHeight: 16 },
  errorText: { fontSize: 13, color: colors.danger, textAlign: "center", marginBottom: spacing.sm },
  messageText: { fontSize: 13, color: colors.ink, textAlign: "center", marginBottom: spacing.sm, fontWeight: "600" },
  ctaButton: { backgroundColor: colors.pink, borderRadius: radius.pill, paddingVertical: 14, alignItems: "center" },
  ctaButtonText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  notNow: { alignItems: "center", marginTop: spacing.md },
  notNowText: { fontSize: 13, color: colors.muted, fontWeight: "600" },
});
