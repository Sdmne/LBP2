import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { fetchReferralStatus, redeemReferralCode } from "../api/referral";
import { ApiError } from "../api/client";
import type { ReferralStatus } from "../api/referral";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Premium roadmap step 4 - "Invite friends". Reached from MeProfileScreen's
// new row. Two independent halves on one screen: (1) your own code + a
// share button, always shown; (2) a one-time "enter a friend's code" field,
// shown only until redeemedCode comes back non-null (the backend only ever
// accepts one redemption per profile - see member_referral_redeem()).
export default function ReferralScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<ReferralStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redeemInput, setRedeemInput] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetchReferralStatus();
      setStatus(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("referral.loadError"));
    }
  }, [t]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  function handleShare() {
    if (!status) return;
    const message = t("referral.shareMessage", { code: status.code });
    // Alena: "Здесь нет поделиться" - tapping Share visibly did nothing.
    // Share.share() used to fail completely silently (bare .catch(() =>
    // undefined)) on whatever error it hit, so a rejection here - a real
    // possibility on some Android OEM builds/share-target configurations,
    // not something this app controls - looked exactly like a dead button.
    // Falling back to an Alert with the same message means tapping Share
    // always visibly does SOMETHING, and she can still copy/forward the
    // code by hand if the native sheet itself won't open on her device.
    Share.share({ message }).catch(() => {
      Alert.alert(t("common.shareUnavailableTitle"), message);
    });
  }

  async function handleRedeem() {
    const code = redeemInput.trim().toUpperCase();
    if (!code) return;
    setRedeemError(null);
    setRedeeming(true);
    try {
      await redeemReferralCode(code);
      setRedeemInput("");
      await load();
    } catch (err) {
      setRedeemError(err instanceof ApiError ? err.message : t("common.somethingWrong"));
    } finally {
      setRedeeming(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.pink} />
      </View>
    );
  }

  if (error || !status) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || t("referral.loadError")}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: spacing.xl + insets.bottom }]}>
      <View style={styles.iconWrap}>
        <Feather name="gift" size={26} color={colors.pink} />
      </View>
      <Text style={styles.headline}>{t("referral.headline")}</Text>
      <Text style={styles.subhead}>{t("referral.subhead", { hours: 48 })}</Text>

      <View style={styles.codeCard}>
        <Text style={styles.codeLabel}>{t("referral.yourCode")}</Text>
        <Text style={styles.code}>{status.code}</Text>
        <Pressable style={styles.shareBtn} onPress={handleShare}>
          <Feather name="share-2" size={15} color="#fff" />
          <Text style={styles.shareBtnText}>{t("referral.share")}</Text>
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{status.referredCount}</Text>
          <Text style={styles.statLabel}>{t("referral.statInvited")}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{status.rewardedCount}</Text>
          <Text style={styles.statLabel}>{t("referral.statRewarded")}</Text>
        </View>
      </View>

      {status.redeemedCode ? (
        <View style={styles.redeemedCard}>
          <Feather name="check-circle" size={16} color={colors.pink} />
          <Text style={styles.redeemedText}>{t("referral.redeemedWith", { code: status.redeemedCode })}</Text>
        </View>
      ) : (
        <View style={styles.redeemCard}>
          <Text style={styles.redeemLabel}>{t("referral.haveCode")}</Text>
          <View style={styles.redeemRow}>
            <TextInput
              style={styles.redeemInput}
              value={redeemInput}
              onChangeText={setRedeemInput}
              placeholder={t("referral.codePlaceholder")}
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={32}
            />
            <Pressable
              style={[styles.redeemBtn, (!redeemInput.trim() || redeeming) && styles.redeemBtnDisabled]}
              onPress={handleRedeem}
              disabled={!redeemInput.trim() || redeeming}
            >
              {redeeming ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.redeemBtnText}>{t("referral.redeemCta")}</Text>}
            </Pressable>
          </View>
          {redeemError ? <Text style={styles.redeemError}>{redeemError}</Text> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, backgroundColor: colors.bg },
  errorText: { fontSize: 14, color: colors.muted, textAlign: "center" },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.tintPink,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: spacing.sm,
  },
  headline: { fontSize: 18, fontWeight: "700", color: colors.ink, textAlign: "center" },
  subhead: { fontSize: 13, color: colors.muted, textAlign: "center", marginTop: 6, marginBottom: spacing.lg, paddingHorizontal: spacing.md },
  codeCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  codeLabel: { fontSize: 11.5, color: colors.muted, fontWeight: "600" },
  code: { fontSize: 30, fontWeight: "800", color: colors.ink, letterSpacing: 4, marginTop: 6, marginBottom: spacing.md },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.pink,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  shareBtnText: { fontSize: 13.5, color: "#fff", fontWeight: "700" },
  statsRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.lg },
  statBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  statNumber: { fontSize: 20, fontWeight: "800", color: colors.ink },
  statLabel: { fontSize: 11.5, color: colors.muted, marginTop: 2 },
  redeemedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.tintPink,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  redeemedText: { fontSize: 13, color: colors.ink, flex: 1 },
  redeemCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  redeemLabel: { fontSize: 13.5, color: colors.ink, fontWeight: "600", marginBottom: spacing.sm },
  redeemRow: { flexDirection: "row", gap: spacing.sm },
  redeemInput: {
    flex: 1,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.tintPink,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    color: colors.ink,
    letterSpacing: 1,
  },
  redeemBtn: {
    backgroundColor: colors.pink,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  redeemBtnDisabled: { opacity: 0.5 },
  redeemBtnText: { fontSize: 13.5, color: "#fff", fontWeight: "700" },
  redeemError: { fontSize: 12, color: "#c0392b", marginTop: spacing.sm },
});
