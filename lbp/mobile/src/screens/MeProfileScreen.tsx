import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing, tabBarClearance } from "../theme";
import GradientBackground from "../components/GradientBackground";
import AppHeader from "../components/AppHeader";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MainTabsParamList } from "../navigation/MainTabs";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { openFamilyPlan } from "../utils/familyPlan";
import { fetchSubscriptionStatus } from "../api/subscription";
import { fetchMe } from "../api/profile";
import type { SubscriptionTier } from "../api/types";

type Props = BottomTabScreenProps<MainTabsParamList, "Me">;

// UPDATE (Sept 2026): this is the real equivalent of the prototype's
// #scr-profile-settings (same 5th/last tab-bar position) - it was showing
// only avatar/name/email + 3 links, missing the prototype's actual content:
// a "Current plan" card and a verified badge on the name. Both are now real
// (profileVerified/isPremium come from GET /api/auth/me, see
// AuthContext.tsx), so they're shown here instead of left out. Not added:
// the prototype's "Profile strength %" (no backend field for it).
// The avatar's edit-pencil button still routes to Photos (the closest
// real profile-editing surface for the photo itself).
//
// UPDATE 2 (Sept 2026, same session): "Edit profile" is now real too -
// EditProfileScreen.tsx (PATCH /api/member/profile has always existed on
// the backend; this was the missing mobile screen). Added as the first
// row, matching the prototype's own menu order.
export default function MeProfileScreen(_props: Props) {
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [loggingOut, setLoggingOut] = useState(false);
  // Reset per avatarUrl (not just once) so switching to a NEW photo after
  // a previous one failed to load tries the new URL fresh, instead of
  // staying stuck on the placeholder from an unrelated earlier failure.
  const [avatarPhotoFailed, setAvatarPhotoFailed] = useState(false);
  // AuthContext's `user` is only ever public_user() + profileVerified/
  // isPremium/profileCompleteness (see /api/auth/me in main.py) - it has
  // NO avatarUrl field at all, so `user?.avatarUrl` referenced here
  // before was always undefined and this always fell through to the
  // initial-letter placeholder no matter what photo was set (the actual
  // cause of Alena's "я поставила фото а на иконке в кабинете ничего не
  // изменилось" - not a rendering bug, a data-source bug). The real
  // avatar lives on the profile, via GET /api/member/me
  // (MemberProfileSummary.avatarUrl) - same endpoint EditProfileScreen
  // already uses to prefill its form. Fetched on every focus (not just
  // once) so returning here right after setting a new primary photo on
  // the Photos screen shows it immediately.
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  useEffect(() => {
    setAvatarPhotoFailed(false);
  }, [avatarUrl]);
  // The plan card used to read only `user.isPremium`, a flag cached in
  // AuthContext from login and never refreshed - if the account's tier
  // changed after that (exactly what Alena's test account does), this
  // screen kept showing the stale value while SubscriptionScreen (which
  // fetches fresh every time it mounts) showed the real one, producing
  // her "at first it shows premium, inside it says free" report. Fetching
  // the same GET /api/member/subscription SubscriptionScreen uses, and
  // re-fetching on every focus, makes the two screens structurally unable
  // to disagree.
  const [tier, setTier] = useState<SubscriptionTier | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchSubscriptionStatus()
        .then((status) => {
          if (!cancelled) setTier(status.tier);
        })
        .catch(() => {
          // Leave the previous value (or the isPremium fallback below) in
          // place rather than showing an error on what's a secondary card.
        });
      fetchMe()
        .then((res) => {
          if (!cancelled) setAvatarUrl(res.profile?.avatarUrl ?? null);
        })
        .catch(() => {
          // Leave the previous value in place rather than showing an
          // error on what's a secondary bit of chrome.
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const planName =
    tier === "PRO"
      ? t("subscription.tierNamePro")
      : tier === "BUILDER"
        ? t("subscription.tierNameBuilder")
        : tier === "EXPLORE"
          ? t("me.planFree")
          : user?.isPremium
            ? t("me.planPremium")
            : t("me.planFree");
  const planIsPaid = tier ? tier !== "EXPLORE" : !!user?.isPremium;

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  // Prototype's #scr-profile-settings .pf-card actually lists Edit
  // profile/Verification/Notifications/Privacy & Safety, not Saved/
  // Resources/Settings - a real information-architecture difference, not
  // just icon color, and Notifications doesn't have its own screen yet
  // (those toggles live inside SettingsScreen alongside several other
  // sections that aren't just notifications). Rather than silently
  // inventing new navigation or dropping working entry points to force a
  // 1:1 match, added Verification as its own row (it already has a real
  // screen, and is the state Alena's reference screenshot foregrounds
  // most - a status badge makes verified/unverified visible right here)
  // and switched every row to the same Feather line-icon set as Explore/
  // the tab bar, replacing the mismatched emoji. Full menu reconciliation
  // (a real Notifications screen, Privacy & Safety promoted to the top)
  // flagged for Alena rather than guessed at.
  const rows: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void; badge?: boolean }[] = [
    { icon: "user", label: t("me.editProfile"), onPress: () => rootNav.navigate("EditProfile") },
    // Alena: "как можно сделать чтобы просмотреть как выглядит моя анкета
    // после изменений" - opens the same ProfileDetail screen other
    // members see when they open a profile, using her own profileId.
    // member_catalog_detail() on the backend already special-cases
    // viewer_profile_id === target_profile_id (no block/visibility check,
    // no "profile viewed" notification), so this works with no backend
    // change; ProfileDetailScreen itself hides Message/Like/Report/Block
    // when viewing your own profile (see its isSelf check).
    ...(user?.profileId
      ? [{ icon: "eye" as const, label: t("me.previewProfile"), onPress: () => rootNav.navigate("ProfileDetail", { profileId: user.profileId as number }) }]
      : []),
    { icon: "check-circle", label: t("nav.verificationTitle"), onPress: () => rootNav.navigate("Verification"), badge: !!user?.profileVerified },
    // Alena: "нигде не вижу в меню family room" - it previously only
    // existed as Explore's "Family Plan" tile, easy to miss as *the* place
    // Family Room lives. Same real routing here (see utils/familyPlan.ts).
    { icon: "home", label: t("me.familyRoom"), onPress: () => openFamilyPlan(rootNav, t) },
    { icon: "heart", label: t("me.saved"), onPress: () => rootNav.navigate("Favourites") },
    { icon: "tool", label: t("me.resources"), onPress: () => rootNav.navigate("Resources") },
    { icon: "settings", label: t("me.settings"), onPress: () => rootNav.navigate("Settings") },
  ];

  return (
    <GradientBackground variant="soft">
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + tabBarClearance + insets.bottom }]}>
      {/* Was the only tab still relying on the native headerShown:true
          title bar (a plain white "Profile" bar, no brand mark) while
          Explore/Catalog/Messages all build this same in-content header -
          Alena: "почему сверху нету логотипа как на остальных страницах".
          See MainTabs.tsx's headerShown:false for "Me". */}
      <AppHeader />
      <View style={styles.hero}>
        {/* Was hardcoded to always show the initial-letter placeholder,
            never checking for a real avatar at all - so uploading and
            setting a photo on the Photos screen had no visible effect
            here (Alena: "я поставила фото а на иконке в кабинете ничего
            не изменилось"). user.avatarUrl is already a ready-to-use
            absolute URL (same field LikesScreen/CatalogScreen/
            ProfileDetailScreen all render directly), and photoFailed
            covers a failed/expired image the same way every other photo
            spot in the app does. */}
        <Pressable style={styles.avatarWrap} onPress={() => rootNav.navigate("Photos")}>
          {avatarUrl && !avatarPhotoFailed ? (
            <Image
              source={{ uri: avatarUrl }}
              style={styles.avatar}
              onError={() => setAvatarPhotoFailed(true)}
            />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user?.displayName?.[0] ?? "?"}</Text>
            </View>
          )}
          <View style={styles.avatarEditBtn}>
            <Feather name="edit-2" size={12} color={colors.white} />
          </View>
        </Pressable>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{user?.displayName}</Text>
          {user?.profileVerified ? <Text style={styles.verifiedBadge}>✓</Text> : null}
        </View>
        <Text style={styles.email}>{user?.email}</Text>
        {/* Unreachable under the blocking VerifyCode gate (RootNavigator never
            lets an unverified user reach this screen at all) - kept as a
            passive fallback in case that ever changes. */}
        {user?.emailVerified === false ? <Text style={styles.notice}>{t("me.emailNotVerified")}</Text> : null}
      </View>

      {/* Prototype's .pf-progress - "Profile strength" bar, previously left
          out entirely (no backend field for it). Now real: GET /api/auth/me
          returns profileCompleteness, the same 7-factor completeness score
          (profileType/avatarUrl/dateOfBirth/country/city/lookingFor,
          about-or-bio) catalog_profile_completeness_sql() already computes
          for catalog ranking - not invented for this bar, an existing
          honest signal just wasn't exposed to the client before. */}
      {typeof user?.profileCompleteness === "number" ? (
        <View style={styles.progressCard}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>{t("me.profileStrength")}</Text>
            <Text style={styles.progressPct}>{user.profileCompleteness}%</Text>
          </View>
          <View style={styles.progressBar}>
            <LinearGradient
              colors={[colors.blue, "#f070a9"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, user.profileCompleteness))}%` }]}
            />
          </View>
        </View>
      ) : null}

      <Pressable onPress={() => rootNav.navigate("Subscription")}>
        {/* Paid tiers get the dark navy/purple gradient treatment Alena
            asked for (so an active plan reads as something worth having,
            not the same flat chip the free tier gets) - free stays the
            plain light card. */}
        {planIsPaid ? (
          <LinearGradient
            colors={["#1e1b4b", "#4c1d95", "#831843"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.planCard}
          >
            <View>
              <Text style={styles.planLabelPaid}>{t("me.currentPlan").toUpperCase()}</Text>
              <Text style={styles.planNamePaid}>{planName}</Text>
            </View>
            <View style={styles.planCtaPill}>
              <Text style={styles.planCtaPillText}>{t("me.managePlan")}</Text>
            </View>
          </LinearGradient>
        ) : (
          <View style={[styles.planCard, styles.planCardFree]}>
            <View>
              <Text style={styles.planLabel}>{t("me.currentPlan")}</Text>
              <Text style={styles.planName}>{planName}</Text>
            </View>
            <Text style={styles.planCta}>{t("me.managePlan")}</Text>
          </View>
        )}
      </Pressable>

      <View style={styles.card}>
        {rows.map((row, i) => (
          <Pressable
            key={row.label}
            style={[styles.row, i === rows.length - 1 && styles.rowLast]}
            onPress={row.onPress}
          >
            <View style={styles.rowIconWrap}>
              <Feather name={row.icon} size={17} color={colors.pink} />
            </View>
            <Text style={styles.rowLabel}>{row.label}</Text>
            {row.badge ? <Text style={styles.rowBadge}>{"✓"}</Text> : null}
            <Text style={styles.rowChevron}>{"›"}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.logout} onPress={handleLogout} disabled={loggingOut}>
        {loggingOut ? <ActivityIndicator color={colors.pink} /> : <Text style={styles.logoutText}>{t("me.logout")}</Text>}
      </Pressable>
    </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  content: { padding: spacing.lg, paddingTop: spacing.xl },
  hero: { alignItems: "center", marginBottom: spacing.lg },
  avatarWrap: { marginBottom: spacing.sm, position: "relative" },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.tint,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.white,
  },
  avatarText: { fontSize: 34, fontWeight: "800", color: colors.blue },
  // Prototype's .pf-edit-btn: a small circular pink button pinned to the
  // avatar's bottom-right corner.
  avatarEditBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.pink,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.white,
  },
  avatarEditIcon: { fontSize: 13, color: colors.white },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontSize: 19, fontWeight: "600", color: colors.ink },
  verifiedBadge: {
    fontSize: 11,
    color: colors.white,
    backgroundColor: colors.blue,
    width: 18,
    height: 18,
    borderRadius: 9,
    textAlign: "center",
    lineHeight: 18,
    overflow: "hidden",
  },
  email: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  notice: { fontSize: 13, fontWeight: "700", color: colors.premiumDark, marginTop: spacing.sm },
  // Prototype's .pf-plan-card: a flat tint card showing the current plan
  // name with a "Manage" link, between the profile hero and the account
  // menu card.
  progressCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: spacing.md,
  },
  progressRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
  progressLabel: { fontSize: 13, fontWeight: "600", color: colors.ink },
  progressPct: { fontSize: 12.5, fontWeight: "700", color: colors.pink },
  progressBar: { height: 6, borderRadius: radius.pill, backgroundColor: colors.line, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: radius.pill },
  planCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    marginBottom: spacing.md,
  },
  planCardFree: { backgroundColor: colors.tint },
  planLabel: { fontSize: 11.5, color: colors.muted, fontWeight: "600" },
  planName: { fontSize: 15, color: colors.ink, fontWeight: "700", marginTop: 2 },
  planCta: { fontSize: 13, color: colors.blueDark, fontWeight: "700" },
  planLabelPaid: { fontSize: 11, color: "rgba(255,255,255,0.75)", fontWeight: "700", letterSpacing: 0.5 },
  planNamePaid: { fontSize: 17, color: "#fff", fontWeight: "800", marginTop: 3 },
  planCtaPill: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  planCtaPillText: { fontSize: 12.5, color: "#fff", fontWeight: "700" },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowLast: { borderBottomWidth: 0 },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.tintPink,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { flex: 1, fontSize: 14.5, fontWeight: "500", color: colors.ink },
  rowBadge: {
    fontSize: 11,
    color: colors.white,
    backgroundColor: colors.blue,
    width: 18,
    height: 18,
    borderRadius: 9,
    textAlign: "center",
    lineHeight: 18,
    overflow: "hidden",
    marginRight: spacing.xs,
  },
  rowChevron: { fontSize: 18, color: "#a3a3a3" },
  logout: { alignItems: "center", paddingVertical: spacing.lg },
  logoutText: { color: colors.pink, fontSize: 13.5, fontWeight: "600" },
});
