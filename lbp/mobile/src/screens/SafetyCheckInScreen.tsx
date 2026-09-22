import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  cancelSafetyCheckin,
  createSafetyCheckin,
  fetchSafetyCheckins,
  markSafetyCheckinSafe,
  type SafetyCheckin,
} from "../api/safetyCheckin";
import { ApiError } from "../api/client";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GradientBackground from "../components/GradientBackground";

// Premium roadmap step 7: safety check-in for first in-person meetings.
// Deliberately free for everyone, not Premium-gated - see safetyCheckin.ts's
// header comment for why. Also deliberately honest about what the app CAN
// and CANNOT do: there is no push-notification delivery in this app yet
// (see the standing push-notification item in the project doc) and no SMS/
// email-to-a-third-party integration, so this never implies the app itself
// will alert anyone if a check-in goes overdue. It only (a) tracks the plan
// and deadline for the member to see in-app, highlighted once overdue, and
// (b) hands them a pre-written message to send to a trusted contact
// themselves via the native share sheet - the same honesty pattern as every
// "not real X yet" feature elsewhere in this app.
const HOUR_OPTIONS = [1, 2, 4, 6, 24];

function formatWhen(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function SafetyCheckInScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [checkins, setCheckins] = useState<SafetyCheckin[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [withWhom, setWithWhom] = useState("");
  const [plan, setPlan] = useState("");
  const [hours, setHours] = useState(4);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetchSafetyCheckins();
      setCheckins(res.checkins);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("safety.loadError"));
    }
  }, [t]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const now = Date.now();
  const pending = useMemo(() => (checkins || []).filter((c) => c.status === "PENDING"), [checkins]);
  const history = useMemo(() => (checkins || []).filter((c) => c.status !== "PENDING"), [checkins]);

  async function handleCreate() {
    if (!plan.trim()) return;
    setCreateError(null);
    setCreating(true);
    try {
      await createSafetyCheckin({ withWhom: withWhom.trim() || null, plan: plan.trim(), hoursUntilCheckIn: hours });
      setWithWhom("");
      setPlan("");
      setHours(4);
      await load();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : t("common.somethingWrong"));
    } finally {
      setCreating(false);
    }
  }

  async function handleMarkSafe(id: number) {
    setBusyId(id);
    try {
      await markSafetyCheckinSafe(id);
      await load();
    } catch {
      // silent - the row just stays pending, member can retry
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(id: number) {
    setBusyId(id);
    try {
      await cancelSafetyCheckin(id);
      await load();
    } catch {
      // silent
    } finally {
      setBusyId(null);
    }
  }

  function handleShare(checkin: SafetyCheckin) {
    const who = checkin.withWhom ? t("safety.shareWith", { who: checkin.withWhom }) : t("safety.shareWithSomeone");
    const message = t("safety.shareMessage", {
      who,
      plan: checkin.plan || "",
      when: formatWhen(checkin.checkInByAt),
    });
    // Same silent-failure fix as ReferralScreen's handleShare - see its
    // comment for why a bare .catch(() => undefined) reads as a dead
    // button when Share.share() rejects on a given device.
    Share.share({ message }).catch(() => {
      Alert.alert(t("common.shareUnavailableTitle"), message);
    });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.pink} />
      </View>
    );
  }

  return (
    <GradientBackground variant="soft">
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: spacing.xl + insets.bottom }]}>
        <Text style={styles.title}>{t("safety.title")}</Text>
        <Text style={styles.subtitle}>{t("safety.subtitle")}</Text>

        <View style={styles.disclaimerBox}>
          <Feather name="info" size={14} color={colors.muted} />
          <Text style={styles.disclaimerText}>{t("safety.disclaimer")}</Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {pending.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t("safety.upcoming")}</Text>
            {pending.map((checkin) => {
              const isOverdue = !!checkin.checkInByAt && new Date(checkin.checkInByAt).getTime() < now;
              return (
                <View key={checkin.id} style={[styles.card, isOverdue && styles.cardOverdue]}>
                  {checkin.withWhom ? <Text style={styles.cardWith}>{checkin.withWhom}</Text> : null}
                  <Text style={styles.cardPlan}>{checkin.plan}</Text>
                  <Text style={[styles.cardWhen, isOverdue && styles.cardWhenOverdue]}>
                    {isOverdue
                      ? t("safety.overdueSince", { when: formatWhen(checkin.checkInByAt) })
                      : t("safety.checkInBy", { when: formatWhen(checkin.checkInByAt) })}
                  </Text>
                  <View style={styles.cardActions}>
                    <Pressable
                      style={styles.safeBtn}
                      onPress={() => handleMarkSafe(checkin.id)}
                      disabled={busyId === checkin.id}
                    >
                      <Feather name="check-circle" size={14} color="#fff" />
                      <Text style={styles.safeBtnText}>{t("safety.imSafe")}</Text>
                    </Pressable>
                    <Pressable style={styles.shareBtn} onPress={() => handleShare(checkin)}>
                      <Feather name="share-2" size={14} color={colors.blue} />
                      <Text style={styles.shareBtnText}>{t("safety.sharePlan")}</Text>
                    </Pressable>
                    <Pressable
                      style={styles.cancelBtn}
                      onPress={() => handleCancel(checkin.id)}
                      disabled={busyId === checkin.id}
                    >
                      <Text style={styles.cancelBtnText}>{t("safety.cancel")}</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("safety.newCheckIn")}</Text>
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>{t("safety.withWhomLabel")}</Text>
            <TextInput
              style={styles.input}
              value={withWhom}
              onChangeText={setWithWhom}
              placeholder={t("safety.withWhomPlaceholder")}
              placeholderTextColor={colors.muted}
            />
            <Text style={styles.fieldLabel}>{t("safety.planLabel")}</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={plan}
              onChangeText={setPlan}
              placeholder={t("safety.planPlaceholder")}
              placeholderTextColor={colors.muted}
              multiline
            />
            <Text style={styles.fieldLabel}>{t("safety.hoursLabel")}</Text>
            <View style={styles.hoursRow}>
              {HOUR_OPTIONS.map((h) => (
                <Pressable
                  key={h}
                  style={[styles.hourChip, hours === h && styles.hourChipActive]}
                  onPress={() => setHours(h)}
                >
                  <Text style={[styles.hourChipText, hours === h && styles.hourChipTextActive]}>
                    {t("safety.hoursValue", { count: h })}
                  </Text>
                </Pressable>
              ))}
            </View>
            {createError ? <Text style={styles.errorText}>{createError}</Text> : null}
            <Pressable
              style={[styles.createBtn, !plan.trim() && styles.createBtnDisabled]}
              onPress={handleCreate}
              disabled={creating || !plan.trim()}
            >
              {creating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.createBtnText}>{t("safety.createCta")}</Text>
              )}
            </Pressable>
          </View>
        </View>

        {history.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t("safety.history")}</Text>
            {history.map((checkin) => (
              <View key={checkin.id} style={styles.historyRow}>
                <Feather
                  name={checkin.status === "SAFE" ? "check-circle" : "x-circle"}
                  size={15}
                  color={checkin.status === "SAFE" ? colors.success : colors.muted}
                />
                <Text style={styles.historyText} numberOfLines={1}>
                  {checkin.plan}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { padding: spacing.md, gap: spacing.md },
  title: { fontSize: 20, fontWeight: "800", color: colors.ink },
  subtitle: { fontSize: 13.5, color: colors.muted, lineHeight: 19, marginTop: -4 },
  disclaimerBox: {
    flexDirection: "row",
    gap: spacing.xs,
    backgroundColor: colors.bgSoft,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: "flex-start",
  },
  disclaimerText: { flex: 1, fontSize: 12, color: colors.muted, lineHeight: 16 },
  errorText: { color: colors.danger, fontSize: 12.5 },
  section: { gap: spacing.sm },
  sectionLabel: { fontSize: 13, fontWeight: "700", color: colors.muted },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: 6,
  },
  cardOverdue: { borderColor: colors.danger, backgroundColor: "#fff5f4" },
  cardWith: { fontSize: 15, fontWeight: "800", color: colors.ink },
  cardPlan: { fontSize: 13.5, color: colors.text, lineHeight: 18 },
  cardWhen: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  cardWhenOverdue: { color: colors.danger },
  cardActions: { flexDirection: "row", gap: spacing.xs, marginTop: 4, flexWrap: "wrap" },
  safeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.success,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  safeBtnText: { color: "#fff", fontSize: 12.5, fontWeight: "700" },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: colors.blue,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  shareBtnText: { color: colors.blue, fontSize: 12.5, fontWeight: "700" },
  cancelBtn: { paddingHorizontal: 8, paddingVertical: 7, justifyContent: "center" },
  cancelBtnText: { color: colors.muted, fontSize: 12.5, fontWeight: "600" },
  fieldLabel: { fontSize: 12.5, fontWeight: "700", color: colors.muted, marginTop: spacing.xs },
  input: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.md,
    padding: spacing.sm,
    fontSize: 14,
    color: colors.text,
  },
  inputMultiline: { minHeight: 60, textAlignVertical: "top" },
  hoursRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  hourChip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  hourChipActive: { backgroundColor: colors.pink, borderColor: colors.pink },
  hourChipText: { fontSize: 12.5, fontWeight: "600", color: colors.ink },
  hourChipTextActive: { color: "#fff" },
  createBtn: {
    backgroundColor: colors.pink,
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  createBtnDisabled: { opacity: 0.5 },
  createBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  historyRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: 4 },
  historyText: { flex: 1, fontSize: 13, color: colors.muted },
});
