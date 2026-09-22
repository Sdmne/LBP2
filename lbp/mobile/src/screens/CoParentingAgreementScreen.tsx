import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ApiError } from "../api/client";
import {
  fetchCoParentingAgreement,
  signCoParentingAgreement,
  type CoParentingAgreement,
} from "../api/familyRoom";
import { FAMILY_PLAN_SECTION_KEYS } from "../utils/familyPlan";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GradientBackground from "../components/GradientBackground";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "CoParentingAgreement">;

// Premium roadmap step 5 - "an AI-guided co-parenting agreement builder
// with e-signature" from the brainstormed list. Built as the "sign" layer
// on top of the EXISTING 10-section Family Plan (FamilyRoomScreen.tsx)
// rather than a separate questionnaire - that plan already covers exactly
// the ground a co-parenting agreement needs (legal custody, financial
// planning, living arrangements, etc.), with per-partner completion
// tracking already built. This screen adds: a gate on "both of you marked
// every section complete", a typed-full-name signature per person, and a
// locked, timestamped final record once both have signed.
//
// Deliberately NOT calling this a legally binding e-signature anywhere in
// the copy below - same honesty rule as every "request, not real billing"
// feature elsewhere in this app (see boost.ts/referral.ts/subscription.ts).
// No AI drafting in this v1 either - the "AI-guided" half of the original
// idea is a reasonable follow-up once this core sign/record mechanism is
// live and used, not a blocker to shipping it.
function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return iso;
  }
}

export default function CoParentingAgreementScreen({ route, navigation }: Props) {
  const { profileId, displayName } = route.params;
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  const [agreement, setAgreement] = useState<CoParentingAgreement | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "needsPremium" | "noMatch" | "error">("loading");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);

  const load = useCallback(() => {
    setStatus("loading");
    fetchCoParentingAgreement(profileId)
      .then((res) => {
        setAgreement(res.agreement);
        setStatus("ok");
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 402) setStatus("needsPremium");
        else if (err instanceof ApiError && err.status === 404) setStatus("noMatch");
        else setStatus("error");
      });
  }, [profileId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSign() {
    if (!fullName.trim() || !confirmed || signing) return;
    setSignError(null);
    setSigning(true);
    try {
      const res = await signCoParentingAgreement(profileId, fullName.trim());
      setAgreement(res.agreement);
      setFullName("");
      setConfirmed(false);
    } catch (err) {
      setSignError(err instanceof ApiError ? err.message : t("common.somethingWrong"));
    } finally {
      setSigning(false);
    }
  }

  if (status === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.gradientStart} />
      </View>
    );
  }

  if (status === "needsPremium") {
    return (
      <View style={styles.center}>
        <Text style={styles.stateTitle}>{t("familyRoom.premiumTitle")}</Text>
        <Text style={styles.stateBody}>{t("familyRoom.premiumBody")}</Text>
        <Pressable style={styles.primaryButton} onPress={() => navigation.navigate("Subscription")}>
          <Text style={styles.primaryButtonText}>{t("familyRoom.premiumButton")}</Text>
        </Pressable>
      </View>
    );
  }

  if (status === "noMatch") {
    return (
      <View style={styles.center}>
        <Text style={styles.stateTitle}>{t("familyRoom.noMatchTitle")}</Text>
        <Text style={styles.stateBody}>{t("familyRoom.noMatchBody")}</Text>
      </View>
    );
  }

  if (status === "error" || !agreement) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t("agreement.loadError")}</Text>
      </View>
    );
  }

  const sectionSource = agreement.status === "SIGNED" ? agreement.snapshot || [] : null;

  return (
    <GradientBackground variant="soft">
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: spacing.xl + insets.bottom }]}>
        <View style={styles.hero}>
          <Text style={styles.heroIcon}>✍️</Text>
          <Text style={styles.heroTitle}>{t("agreement.title")}</Text>
          <Text style={styles.heroSubtitle}>{t("agreement.subtitle", { name: displayName || "" })}</Text>
        </View>

        {!agreement.readyToSign ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("agreement.notReadyTitle")}</Text>
            <Text style={styles.cardBody}>{t("agreement.notReadyBody")}</Text>
            <Text style={styles.progressText}>
              {t("agreement.progressLabel", { done: agreement.sectionsCompleteCount, total: agreement.sectionsTotalCount })}
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round((agreement.sectionsCompleteCount / Math.max(1, agreement.sectionsTotalCount)) * 100)}%` },
                ]}
              />
            </View>
            <Pressable style={styles.primaryButton} onPress={() => navigation.goBack()}>
              <Text style={styles.primaryButtonText}>{t("agreement.notReadyCta")}</Text>
            </Pressable>
          </View>
        ) : agreement.status === "SIGNED" ? (
          <View style={styles.card}>
            <Text style={styles.signedBadge}>✓ {t("agreement.signedTitle")}</Text>
            <Text style={styles.cardBody}>
              {t("agreement.signedBody", { name: displayName || "", date: formatDate(agreement.signedAt) })}
            </Text>
            <View style={styles.signatureRow}>
              <View style={styles.signatureBox}>
                <Text style={styles.signatureName}>{agreement.myFullName}</Text>
                <Text style={styles.signatureDate}>{formatDate(agreement.mySignedAt)}</Text>
              </View>
              <View style={styles.signatureBox}>
                <Text style={styles.signatureName}>{agreement.partnerFullName}</Text>
                <Text style={styles.signatureDate}>{formatDate(agreement.partnerSignedAt)}</Text>
              </View>
            </View>
          </View>
        ) : agreement.mySigned ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("agreement.mySignedBadge", { date: formatDate(agreement.mySignedAt) })}</Text>
            <Text style={styles.cardBody}>{t("agreement.waitingForPartner", { name: displayName || "" })}</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("agreement.readyTitle")}</Text>
            <Text style={styles.cardBody}>{t("agreement.readyBody")}</Text>

            <Pressable style={styles.reviewToggle} onPress={() => setReviewOpen((prev) => !prev)}>
              <Text style={styles.reviewToggleText} numberOfLines={1}>{t("agreement.reviewSectionsToggle")}</Text>
              <Text style={styles.reviewToggleChevron}>{reviewOpen ? "⌃" : "⌄"}</Text>
            </Pressable>

            <TextInput
              style={styles.nameInput}
              value={fullName}
              onChangeText={setFullName}
              placeholder={t("agreement.signNamePlaceholder")}
              placeholderTextColor={colors.muted}
              autoCapitalize="words"
              maxLength={200}
            />

            <Pressable style={styles.checkboxRow} onPress={() => setConfirmed((prev) => !prev)}>
              <View style={[styles.checkboxBox, confirmed && styles.checkboxBoxChecked]}>
                {confirmed ? <Text style={styles.checkboxMark}>✓</Text> : null}
              </View>
              <Text style={styles.checkboxLabel}>{t("agreement.signCheckbox")}</Text>
            </Pressable>

            <Text style={styles.disclaimer}>{t("agreement.signDisclaimer")}</Text>

            {signError ? <Text style={styles.errorInline}>{signError}</Text> : null}

            <Pressable
              style={[styles.primaryButton, (!fullName.trim() || !confirmed || signing) && styles.primaryButtonDisabled]}
              onPress={handleSign}
              disabled={!fullName.trim() || !confirmed || signing}
            >
              {signing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryButtonText}>{t("agreement.signCta")}</Text>}
            </Pressable>
          </View>
        )}

        {(reviewOpen || sectionSource) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{sectionSource ? t("agreement.signedSectionsTitle") : t("agreement.reviewSectionsToggle")}</Text>
            {FAMILY_PLAN_SECTION_KEYS.map((key) => {
              const entry = sectionSource ? sectionSource.find((s) => s.key === key) : null;
              return (
                <View key={key} style={styles.sectionReadRow}>
                  <Text style={styles.sectionReadTitle}>{t(`familyRoom.section.${key}.title`)}</Text>
                  <Text style={styles.sectionReadBody}>{(entry?.content || "").trim() || t("agreement.sectionEmpty")}</Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl, backgroundColor: "transparent" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, backgroundColor: colors.bg },
  stateTitle: { fontSize: 17, fontWeight: "800", color: colors.ink, textAlign: "center", marginBottom: spacing.xs },
  stateBody: { fontSize: 13.5, color: colors.muted, textAlign: "center", marginBottom: spacing.md },
  errorText: { fontSize: 14, color: colors.muted, textAlign: "center" },
  errorInline: { fontSize: 12.5, color: "#c0392b", marginTop: spacing.xs },
  hero: { alignItems: "center", paddingHorizontal: spacing.md, gap: 4, marginBottom: spacing.xs },
  heroIcon: { fontSize: 30, marginBottom: 4 },
  heroTitle: { fontSize: 19, fontWeight: "800", color: colors.ink, textAlign: "center" },
  heroSubtitle: { fontSize: 13, color: colors.mutedOnGradient, textAlign: "center", lineHeight: 18 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTitle: { fontSize: 15.5, fontWeight: "800", color: colors.ink },
  cardBody: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  progressText: { fontSize: 12.5, color: colors.muted, fontWeight: "600" },
  progressTrack: { height: 8, borderRadius: radius.pill, backgroundColor: "rgba(2,8,23,0.08)", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.pink },
  primaryButton: {
    backgroundColor: colors.pink,
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xs,
  },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 14.5 },
  signedBadge: { fontSize: 16, fontWeight: "800", color: colors.pink },
  signatureRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  signatureBox: {
    flex: 1,
    backgroundColor: colors.tintPink,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: "center",
  },
  signatureName: { fontSize: 13.5, fontWeight: "700", color: colors.ink, textAlign: "center" },
  signatureDate: { fontSize: 11.5, color: colors.muted, marginTop: 2 },
  reviewToggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  reviewToggleText: { fontSize: 13.5, fontWeight: "700", color: colors.pink, flexShrink: 1, marginRight: spacing.sm },
  reviewToggleChevron: { fontSize: 14, color: colors.pink },
  nameInput: {
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.tintPink,
    paddingHorizontal: spacing.md,
    fontSize: 14.5,
    color: colors.ink,
  },
  checkboxRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxBoxChecked: { backgroundColor: colors.pink, borderColor: colors.pink },
  checkboxMark: { color: "#fff", fontSize: 13, fontWeight: "800" },
  checkboxLabel: { flex: 1, fontSize: 13, color: colors.ink, lineHeight: 18 },
  disclaimer: { fontSize: 11.5, color: colors.muted, lineHeight: 16, fontStyle: "italic" },
  sectionReadRow: { paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: colors.line },
  sectionReadTitle: { fontSize: 13.5, fontWeight: "700", color: colors.ink, marginBottom: 3 },
  sectionReadBody: { fontSize: 13, color: colors.muted, lineHeight: 18 },
});
