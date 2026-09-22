import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchPurchasesStatus, type PurchaseProductId, type PurchasesStatus } from "../api/purchases";
import { ApiError } from "../api/client";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import type { RootStackParamList } from "../navigation/RootNavigator";
import GradientBackground from "../components/GradientBackground";

// TEMP DISABLED for OTA safety (2026-09-15, item 19) - same reasoning as
// AuthContext.tsx's registerForPushNotifications()/unregisterCurrentPushToken()
// stubs for item 16. `react-native-purchases` is not yet in package.json,
// so the real implementation (utils/purchases.ts, already written and
// ready) statically imports a native module Metro cannot resolve at all -
// not "resolves but no-ops at runtime", genuinely unresolvable, since the
// package isn't installed. If this screen imported that file directly, it
// would break the JS bundle for EVERY user on the next `eas update`
// (already-installed users can only get code via OTA until a new native
// build ships - there is no way to ship this file's real import safely
// before then). Stubbed to safe no-ops here so the screen itself can ship
// today and Alena can see/test the UI and copy; re-wire the three lines
// below back to a real `import { fetchProductPrices, purchaseProduct,
// purchasesAvailableForPlatform } from "../utils/purchases"` together with
// the next `eas build`, after `npx expo install react-native-purchases`.
// See pending-mobile-tasks.md item 19.
async function fetchProductPrices(_ids: PurchaseProductId[]): Promise<Partial<Record<PurchaseProductId, string>>> {
  return {};
}
async function purchaseProduct(_id: PurchaseProductId): Promise<{ ok: true } | { ok: false; cancelled: boolean; error: string }> {
  return { ok: false, cancelled: false, error: "not_configured" };
}
function purchasesAvailableForPlatform(): boolean {
  return Platform.OS === "ios";
}

type Props = NativeStackScreenProps<RootStackParamList, "Purchases">;

// Item 19 - one-time RevenueCat purchases. Alena, 2026-09-15: "И где здесь
// можно посмотреть что можно купить руководство и цена... нигде нет
// информации" / "Так сейчас создай экраны сам для приложения и сайта" -
// this is that screen. Reached from the Me tab's "Boosts & extras" row
// (see MeProfileScreen.tsx).
//
// Each item shows either a live store price (fetchProductPrices(), once
// react-native-purchases + real App Store/Google Play products exist) or
// falls back to the translated approximate price Alena gave verbatim on
// 2026-09-15 - so this screen already reads correctly today, before the
// SDK is even installed, and upgrades itself automatically once it is.
//
// Scope note (flagged in the project doc, not hidden here): these are
// single-unit purchases, not the tiered 1/5/10-pack bulk-discount
// structure from Alena's original HER/Tinder reference screenshots - she
// gave one flat price per item, not pack tiers, so that's what ships
// first. Tiered Boost packs are a natural fast-follow if she wants them
// once this is live.
const ITEMS: {
  id: PurchaseProductId;
  icon: keyof typeof Feather.glyphMap;
  titleKey: string;
  bodyKey: string;
  priceKey: string;
}[] = [
  { id: "lbp_boost_1x", icon: "zap", titleKey: "purchases.boostTitle", bodyKey: "purchases.boostBody", priceKey: "purchases.boostPrice" },
  { id: "lbp_superlike_1x", icon: "star", titleKey: "purchases.superlikeTitle", bodyKey: "purchases.superlikeBody", priceKey: "purchases.superlikePrice" },
  { id: "lbp_rewind_1x", icon: "rotate-ccw", titleKey: "purchases.rewindTitle", bodyKey: "purchases.rewindBody", priceKey: "purchases.rewindPrice" },
  { id: "lbp_likes_unlock_48h", icon: "eye", titleKey: "purchases.likesUnlockTitle", bodyKey: "purchases.likesUnlockBody", priceKey: "purchases.likesUnlockPrice" },
  { id: "lbp_compat_report_unlock_1x", icon: "activity", titleKey: "purchases.compatUnlockTitle", bodyKey: "purchases.compatUnlockBody", priceKey: "purchases.compatUnlockPrice" },
  { id: "lbp_extra_likes_pack_10", icon: "heart", titleKey: "purchases.extraLikesTitle", bodyKey: "purchases.extraLikesBody", priceKey: "purchases.extraLikesPrice" },
];

function statusBadge(id: PurchaseProductId, status: PurchasesStatus | null, t: (key: string, vars?: Record<string, string | number>) => string): string | null {
  if (!status) return null;
  switch (id) {
    case "lbp_boost_1x":
      return status.boostActive ? t("purchases.activeLabel") : null;
    case "lbp_likes_unlock_48h":
      return status.likesUnlocked ? t("purchases.activeLabel") : null;
    case "lbp_superlike_1x":
      return status.superLikeCredits > 0 ? t("purchases.creditsLabel", { count: status.superLikeCredits }) : null;
    case "lbp_rewind_1x":
      return status.rewindCredits > 0 ? t("purchases.creditsLabel", { count: status.rewindCredits }) : null;
    case "lbp_compat_report_unlock_1x":
      return status.compatReportUnlockCredits > 0 ? t("purchases.creditsLabel", { count: status.compatReportUnlockCredits }) : null;
    case "lbp_extra_likes_pack_10":
      return status.bonusLikesToday > 0 ? t("purchases.creditsLabel", { count: status.bonusLikesToday }) : null;
    default:
      return null;
  }
}

export default function PurchasesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const [status, setStatus] = useState<PurchasesStatus | null>(null);
  const [prices, setPrices] = useState<Partial<Record<PurchaseProductId, string>>>({});
  const [purchasingId, setPurchasingId] = useState<PurchaseProductId | null>(null);
  const androidLocked = !purchasesAvailableForPlatform();

  const loadStatus = useCallback(() => {
    fetchPurchasesStatus()
      .then(setStatus)
      .catch(() => {
        // Non-fatal - the buy buttons still work without a status badge,
        // same "degrade gracefully" approach as everywhere else in the app.
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStatus();
    }, [loadStatus]),
  );

  useEffect(() => {
    fetchProductPrices(ITEMS.map((item) => item.id)).then(setPrices);
  }, []);

  async function handleBuy(id: PurchaseProductId) {
    setPurchasingId(id);
    try {
      const result = await purchaseProduct(id);
      if (result.ok) {
        Alert.alert(t("purchases.successMessage"));
        // The webhook that actually grants the credit/effect is usually
        // near-instant but not guaranteed to have landed yet - a short
        // delay avoids a false "nothing happened" read on the refetch.
        setTimeout(loadStatus, 1200);
      } else if (!result.cancelled) {
        const message =
          result.error === "not_configured" || result.error === "not_available"
            ? t("purchases.notConfiguredError")
            : t("purchases.errorGeneric");
        Alert.alert(message);
      }
    } catch (err) {
      Alert.alert(err instanceof ApiError ? err.message : t("purchases.errorGeneric"));
    } finally {
      setPurchasingId(null);
    }
  }

  return (
    <GradientBackground variant="soft">
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
      >
        <Text style={styles.intro}>{t("purchases.intro")}</Text>

        {androidLocked ? (
          <View style={styles.androidNotice}>
            <Feather name="info" size={16} color={colors.mutedOnGradient} />
            <Text style={styles.androidNoticeText}>{t("purchases.androidNotice")}</Text>
          </View>
        ) : null}

        {ITEMS.map((item) => {
          const badge = statusBadge(item.id, status, t);
          const isPurchasing = purchasingId === item.id;
          return (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardIconWrap}>
                <Feather name={item.icon} size={18} color={colors.pink} />
              </View>
              <View style={styles.cardTextWrap}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{t(item.titleKey)}</Text>
                  {badge ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{badge}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.cardBody}>{t(item.bodyKey)}</Text>
                <Text style={styles.cardPrice}>{prices[item.id] ?? t(item.priceKey)}</Text>
              </View>
              <Pressable
                style={[styles.buyButton, androidLocked && styles.buyButtonDisabled]}
                onPress={androidLocked ? undefined : () => handleBuy(item.id)}
                disabled={androidLocked || isPurchasing}
              >
                {isPurchasing ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.buyButtonText}>
                    {androidLocked ? t("purchases.comingSoonButton") : t("purchases.buyButton")}
                  </Text>
                )}
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg },
  intro: { fontSize: 13.5, color: colors.mutedOnGradient, lineHeight: 19, marginBottom: spacing.md },
  androidNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: colors.tint,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  androidNoticeText: { flex: 1, fontSize: 12.5, color: colors.mutedOnGradient, lineHeight: 17 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  cardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.tintPink,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTextWrap: { flex: 1 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 14.5, fontWeight: "700", color: colors.ink, flexShrink: 1 },
  cardBody: { fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 16 },
  cardPrice: { fontSize: 13, fontWeight: "700", color: colors.pink, marginTop: 4 },
  badge: { backgroundColor: colors.success, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  badgeText: { fontSize: 10.5, fontWeight: "800", color: colors.white },
  buyButton: {
    backgroundColor: colors.pink,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 84,
    alignItems: "center",
  },
  buyButtonDisabled: { backgroundColor: colors.line },
  buyButtonText: { color: colors.white, fontSize: 12.5, fontWeight: "800" },
});
