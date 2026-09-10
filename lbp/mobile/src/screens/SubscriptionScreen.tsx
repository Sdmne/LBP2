import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Feather } from "@expo/vector-icons";
import { fetchSubscriptionStatus, requestSubscription } from "../api/subscription";
import type { SubscriptionPlan, RequestableTier } from "../api/subscription";
import { ApiError } from "../api/client";
import type { SubscriptionStatus } from "../api/types";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import { SITE_BASE_URL } from "../config";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

// Real Family-Builder-vs-Pro tiers (Sept 2026), matching the site's live
// /pricing page (PRICING_TEXT in frontend/src/ui.tsx) and the backend's
// SUBSCRIPTION_TIER_RANK / profile_tier(). "annual" has no known price from
// the site (it only ever published monthly + a 3-month/quarterly note), so
// it's offered as a billing-cadence choice without an invented price - the
// actual charge is still confirmed manually by the team on review, this
// isn't live in-app billing yet (RevenueCat is a planned follow-up).
const PERIODS: { key: SubscriptionPlan; labelKey: string }[] = [
  { key: "monthly", labelKey: "subscription.monthly" },
  { key: "quarterly", labelKey: "subscription.quarterly" },
  { key: "annual", labelKey: "subscription.annual" },
];

// The PeriodPicker toggles `period` but the price text below it was
// always the flat monthly figure regardless of selection (Alena's "не
// меняется цена если выбрать квартал" report) - these derive the
// displayed price/note from the actual selection. Builder has a real
// confirmed quarterly figure (site's own €49.99/3mo); neither tier has a
// confirmed annual price (see the PERIODS comment above), so annual shows
// the monthly figure with an explicit note rather than inventing a number.
function builderPriceLabel(period: SubscriptionPlan, t: Translate): string {
  if (period === "quarterly") return t("subscription.priceBuilderQuarterly");
  return t("subscription.priceBuilderMonthly");
}
function builderPriceNote(period: SubscriptionPlan, t: Translate): string | null {
  if (period === "annual") return t("subscription.priceAnnualNote");
  if (period === "monthly") return t("subscription.priceBuilderQuarterlyNote");
  return null;
}
function proPriceNote(period: SubscriptionPlan, t: Translate): string | null {
  return period === "monthly" ? null : t("subscription.priceAnnualNote");
}

export default function SubscriptionScreen() {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<SubscriptionPlan>("monthly");
  // Which tier card is selected in the 3-way comparison (Alena's
  // reference mockup: tap a card, the picker/CTA below reflects it) -
  // defaults to Builder, the actual highlighted/recommended tier.
  const [selectedTier, setSelectedTier] = useState<RequestableTier>("BUILDER");
  const [requesting, setRequesting] = useState<RequestableTier | null>(null);
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

  async function handleRequest(tier: RequestableTier) {
    setRequesting(tier);
    setError(null);
    setMessage(null);
    try {
      const res = await requestSubscription(period, tier);
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

  const freeLikes = status.limits?.freeLikesPerDay ?? 3;
  const premiumLikes = status.limits?.premiumLikesPerDay ?? 15;

  // Already on the top tier - nothing left to upgrade to.
  if (status.tier === "PRO") {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.badge}>{t("subscription.activeTitle")}</Text>
        <Text style={styles.body}>{t("subscription.activeBody")}</Text>
        <FeatureList
          items={[
            t("subscription.proFeature1"),
            t("subscription.proFeature2"),
            t("subscription.proFeature3"),
            t("subscription.proFeature4"),
            t("subscription.proFeature5"),
          ]}
        />
      </ScrollView>
    );
  }

  // Builder and Explore both land on the same tier-comparison screen -
  // Builder just starts on the Pro card (its only real upgrade) with its
  // own card marked "current" instead of tappable. See TierComparison for
  // why this now matches Alena's reference mockup, and the two spots
  // where its copy deliberately differs from what the mockup shows.
  return (
    <TierComparison
      currentTier={status.tier === "BUILDER" ? "BUILDER" : "EXPLORE"}
      freeLikes={freeLikes}
      premiumLikes={premiumLikes}
      period={period}
      setPeriod={setPeriod}
      selectedTier={selectedTier}
      setSelectedTier={setSelectedTier}
      requesting={requesting}
      onRequest={handleRequest}
      message={message}
      error={error}
      t={t}
      locale={locale}
    />
  );
}

// Alena's reference mockup ("Family Builder Pro" pricing screen): a dark
// teal hero banner, three tappable tier cards (light-blue Explore / white
// Builder / pink "Best value" Pro), an auto-renew note, a compact grouped
// comparison table, and one big gradient CTA button reflecting whichever
// card is selected. Shared between the Explore (nothing active yet) and
// Builder (offering the Pro upgrade) states - see the two callers above -
// so `currentTier` marks whichever card is the account's real plan as
// "Current plan" instead of tappable, and selection starts on the actual
// recommended upgrade for that state.
//
// Two things deliberately differ from the reference's literal text:
// - The reference's Pro column shows "Unlimited" likes/day. The backend
//   only has two real limits (free vs premium - see limits.premium_likes_
//   per_day in main.py), and Builder/Pro share the premium one; Pro does
//   NOT actually get more or unlimited likes. Shows the real shared
//   number for both instead of a number this app can't back up.
// - The reference's Pro card and its "Build your family" row both say
//   "AI Family Advisor". There's no AI advisor feature anywhere in this
//   codebase (Family Room's plan notes/checklist/documents are real, an
//   AI advisor isn't) - uses the real feature name instead.
function TierComparison({
  currentTier,
  freeLikes,
  premiumLikes,
  period,
  setPeriod,
  selectedTier,
  setSelectedTier,
  requesting,
  onRequest,
  message,
  error,
  t,
  locale,
}: {
  currentTier: "EXPLORE" | "BUILDER";
  freeLikes: number;
  premiumLikes: number;
  period: SubscriptionPlan;
  setPeriod: (plan: SubscriptionPlan) => void;
  selectedTier: RequestableTier;
  setSelectedTier: (tier: RequestableTier) => void;
  requesting: RequestableTier | null;
  onRequest: (tier: RequestableTier) => void;
  message: string | null;
  error: string | null;
  t: Translate;
  locale: string;
}) {
  const termsUrl = `${SITE_BASE_URL}/${locale}/pages/terms-of-use`;
  const privacyUrl = `${SITE_BASE_URL}/${locale}/pages/privacy-policy`;
  const selectedTierName = selectedTier === "PRO" ? t("subscription.tierNamePro") : t("subscription.tierNameBuilder");
  const selectedTierPrice = selectedTier === "PRO" ? t("subscription.priceProMonthly") : builderPriceLabel(period, t);
  const isCurrentSelected = selectedTier === currentTier;

  return (
    <ScrollView contentContainerStyle={styles.tierScrollContainer}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>{t("subscription.tierNamePro")}</Text>
        <Text style={styles.heroSubtitle}>{t("subscription.heroSubtitle")}</Text>
      </View>

      <View style={styles.tierScreenBody}>
        {message ? <Text style={styles.success}>{message}</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.tierRow}>
          <View style={[styles.tierCard, styles.tierCardFree]}>
            <Text style={styles.tierCardLabel}>{t("subscription.tierNameExploreShort")}</Text>
            <Text style={styles.tierCardPrice}>{t("subscription.priceZero")}</Text>
            <Text style={styles.tierCardNote}>{t("subscription.forever")}</Text>
            <Text style={styles.tierCardNote}>{t("subscription.likesPerDayShort", { count: freeLikes })}</Text>
            {currentTier === "EXPLORE" ? (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>{t("subscription.currentPlanBadge")}</Text>
              </View>
            ) : null}
          </View>

          <Pressable
            style={[styles.tierCard, selectedTier === "BUILDER" && styles.tierCardActive]}
            onPress={() => currentTier !== "BUILDER" && setSelectedTier("BUILDER")}
            disabled={currentTier === "BUILDER"}
          >
            <Text style={styles.tierCardLabel}>{t("subscription.tierNameBuilderShort")}</Text>
            <Text style={styles.tierCardPrice}>{builderPriceLabel(period, t)}</Text>
            {period === "monthly" ? <Text style={styles.tierCardNote}>{t("subscription.perMonth")}</Text> : null}
            {builderPriceNote(period, t) ? <Text style={styles.tierCardNote}>{builderPriceNote(period, t)}</Text> : null}
            {currentTier === "BUILDER" ? (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>{t("subscription.currentPlanBadge")}</Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable
            style={[styles.tierCard, styles.tierCardBest, selectedTier === "PRO" && styles.tierCardActive]}
            onPress={() => setSelectedTier("PRO")}
          >
            <View style={styles.bestValueBadgeWrap}>
              <Text style={styles.bestValueBadge}>{t("subscription.bestValueBadge")}</Text>
            </View>
            <Text style={[styles.tierCardLabel, styles.tierCardLabelPro]}>{t("subscription.tierNameProShort")}</Text>
            <Text style={styles.tierCardPrice}>{t("subscription.priceProMonthly")}</Text>
            <Text style={styles.tierCardNote}>{t("subscription.perMonth")}</Text>
            <Text style={styles.tierCardNote}>{t("subscription.proCardExtra")}</Text>
            {selectedTier === "PRO" && proPriceNote(period, t) ? <Text style={styles.tierCardNote}>{proPriceNote(period, t)}</Text> : null}
          </Pressable>
        </View>

        <Text style={styles.renewNote}>{t("subscription.autoRenewNote")}</Text>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <View style={styles.tableFeatureCol} />
            <Text style={styles.tableColHeader}>{t("subscription.tierNameExploreShort")}</Text>
            <Text style={styles.tableColHeader}>{t("subscription.tierNameBuilderShort")}</Text>
            <Text style={[styles.tableColHeader, styles.tableColHeaderPro]}>{t("subscription.tierNameProShort")}</Text>
          </View>

          <TableGroup title={t("subscription.groupMatch")}>
            <TableRow label={t("subscription.likesPerDayLabel")} free={String(freeLikes)} builder={String(premiumLikes)} pro={String(premiumLikes)} />
          </TableGroup>

          <TableGroup title={t("subscription.groupCompatibility")}>
            <TableRow label={t("subscription.compatibilityRowLabel")} builder pro />
          </TableGroup>

          <TableGroup title={t("subscription.groupConnect")}>
            <TableRow label={t("subscription.connectRowLabel")} builder pro />
          </TableGroup>

          <TableGroup title={t("subscription.groupFamily")}>
            <TableRow label={t("subscription.proFeature3")} pro />
          </TableGroup>
        </View>

        {!isCurrentSelected ? (
          <>
            {selectedTier === "BUILDER" ? <PeriodPicker period={period} setPeriod={setPeriod} t={t} /> : null}

            <Pressable style={styles.ctaButton} onPress={() => onRequest(selectedTier)} disabled={requesting !== null}>
              {requesting === selectedTier ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.ctaButtonText}>
                  {t("subscription.getPlanButton", { plan: selectedTierName, price: selectedTierPrice })}
                </Text>
              )}
            </Pressable>
          </>
        ) : null}

        <Text style={styles.legalNote}>
          {t("subscription.legalNotePrefix")}{" "}
          <Text style={styles.legalLink} onPress={() => WebBrowser.openBrowserAsync(termsUrl)}>
            {t("subscription.termsLink")}
          </Text>{" "}
          {t("subscription.legalNoteAnd")}{" "}
          <Text style={styles.legalLink} onPress={() => WebBrowser.openBrowserAsync(privacyUrl)}>
            {t("subscription.privacyLink")}
          </Text>
          .
        </Text>
      </View>
    </ScrollView>
  );
}

// One row of the comparison table - a checkmark/cross by default, or an
// explicit value (e.g. a likes-per-day number) when `free`/`builder`/`pro`
// is a string instead of a boolean.
function TableRow({
  label,
  free = false,
  builder = false,
  pro = false,
}: {
  label: string;
  free?: boolean | string;
  builder?: boolean | string;
  pro?: boolean | string;
}) {
  return (
    <View style={styles.tableRow}>
      <Text style={styles.tableRowLabel}>{label}</Text>
      <TableCell value={free} />
      <TableCell value={builder} />
      <TableCell value={pro} />
    </View>
  );
}

function TableCell({ value }: { value: boolean | string }) {
  if (typeof value === "string") {
    return (
      <View style={styles.tableCell}>
        <Text style={styles.tableCellValue}>{value}</Text>
      </View>
    );
  }
  return (
    <View style={styles.tableCell}>
      {value ? (
        <Feather name="check" size={15} color={colors.success} />
      ) : (
        <Feather name="x" size={15} color={colors.line} />
      )}
    </View>
  );
}

function TableGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={styles.tableGroupTitle}>{title}</Text>
      {children}
    </View>
  );
}

function PeriodPicker({
  period,
  setPeriod,
  t,
}: {
  period: SubscriptionPlan;
  setPeriod: (plan: SubscriptionPlan) => void;
  t: Translate;
}) {
  return (
    <View style={styles.periodRow}>
      {PERIODS.map((option) => (
        <Pressable
          key={option.key}
          style={[styles.periodChip, period === option.key && styles.periodChipActive]}
          onPress={() => setPeriod(option.key)}
        >
          <Text style={[styles.periodChipText, period === option.key && styles.periodChipTextActive]}>
            {t(option.labelKey)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function FeatureList({ items }: { items: string[] }) {
  return (
    <View style={styles.featureList}>
      {items.map((item, index) => (
        <View key={index} style={styles.featureRow}>
          <Text style={styles.featureCheck}>✓</Text>
          <Text style={styles.featureText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { flexGrow: 1, padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  tierScrollContainer: { flexGrow: 1, paddingBottom: spacing.xl },
  // Reference mockup's dark teal hero banner behind the screen title -
  // a plain gradient rather than the mockup's photo illustration (no
  // image asset to source for that here).
  hero: {
    backgroundColor: colors.ink,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  heroTitle: { fontSize: 24, fontWeight: "800", color: colors.white },
  heroSubtitle: { fontSize: 13.5, color: "rgba(255,255,255,0.85)", marginTop: 4 },
  tierScreenBody: { padding: spacing.lg, gap: spacing.sm },
  ctaButton: {
    backgroundColor: colors.pink,
    borderRadius: radius.pill,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  ctaButtonText: { color: colors.white, fontWeight: "800", fontSize: 15 },
  title: { fontSize: 20, fontWeight: "800", color: colors.ink },
  body: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  badge: { fontSize: 20, fontWeight: "800", color: colors.premium },
  success: { fontSize: 13, color: colors.success },
  errorText: { fontSize: 13, color: colors.danger },
  tierRow: { flexDirection: "row", gap: 8, marginTop: spacing.sm },
  tierCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.line,
    padding: spacing.sm,
    gap: 4,
    minHeight: 96,
  },
  tierCardFree: { backgroundColor: colors.bgSoft },
  tierCardActive: { borderColor: colors.pink },
  tierCardBest: { backgroundColor: colors.tintPink, borderColor: colors.pink, position: "relative", marginTop: 10 },
  tierCardLabel: { fontSize: 12.5, fontWeight: "700", color: colors.muted, textTransform: "uppercase" },
  tierCardLabelPro: { color: colors.pink },
  tierCardPrice: { fontSize: 16, fontWeight: "800", color: colors.ink, marginTop: 2 },
  tierCardNote: { fontSize: 10.5, color: colors.muted, marginTop: 2 },
  renewNote: { fontSize: 11.5, color: colors.muted, textAlign: "center", marginTop: spacing.xs },
  table: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: spacing.md,
    overflow: "hidden",
  },
  tableHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  tableFeatureCol: { flex: 1.6 },
  tableColHeader: { flex: 1, fontSize: 12, fontWeight: "700", color: colors.muted, textAlign: "center" },
  tableColHeaderPro: { color: colors.pink },
  tableGroupTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    backgroundColor: colors.bgSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  tableRowLabel: { flex: 1.6, fontSize: 12.5, color: colors.text },
  tableCell: { flex: 1, alignItems: "center", justifyContent: "center" },
  tableCellValue: { fontSize: 12.5, fontWeight: "700", color: colors.ink },
  legalNote: { fontSize: 11.5, color: colors.muted, textAlign: "center", lineHeight: 17, marginTop: spacing.sm },
  legalLink: { color: colors.blueDark, fontWeight: "700" },
  bestValueBadgeWrap: { position: "absolute", top: -10, right: 8, zIndex: 1 },
  bestValueBadge: {
    backgroundColor: colors.pink,
    color: colors.white,
    fontSize: 10,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  currentBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.tint,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    marginTop: spacing.xs,
  },
  currentBadgeText: { fontSize: 11, fontWeight: "800", color: colors.blueDark },
  featureList: { gap: 6, marginTop: spacing.xs },
  featureRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.xs },
  featureCheck: { color: colors.success, fontWeight: "800", fontSize: 13 },
  featureText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
  periodRow: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.sm },
  periodChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
  },
  periodChipActive: { backgroundColor: colors.pink, borderColor: colors.pink },
  periodChipText: { fontSize: 12, fontWeight: "700", color: colors.muted },
  periodChipTextActive: { color: colors.white },
});
