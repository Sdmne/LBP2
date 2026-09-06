import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ApiError } from "../api/client";
import { fetchLikes, fetchProfileViews, markLikesRead } from "../api/likes";
import type { LikesResponse, ProfileSummary, ProfileVisitor } from "../api/types";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import type { MainTabsParamList } from "../navigation/MainTabs";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = BottomTabScreenProps<MainTabsParamList, "Likes">;

// Mirrors the website's Likes page (GET /api/member/likes -> the 4 tabs
// below; GET /api/member/profile-views for Visitors). The site also has
// Clinics/Lawyers tabs on this same page - this app already covers that
// ground with its own dedicated Directory/Favourites screens, so those two
// tabs aren't duplicated here.
//
// Restyled (Sep 2026) to match the prototype's #scr-likes screen: pill tabs
// with a dark "active" fill (.likes-tab.active uses --ink, not the pink
// brand color - the pink is reserved for the heart/CTA accents), and an
// empty state with a soft pink icon circle, title, description and a
// "Browse profiles" CTA that jumps to the Catalog tab (.likes-empty).
type Tab = "likesYou" | "matches" | "myLikes" | "visitors";

export default function LikesScreen({ navigation }: Props) {
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("likesYou");
  const [data, setData] = useState<LikesResponse | null>(null);
  const [visitors, setVisitors] = useState<ProfileVisitor[] | null>(null);
  const [visitorsLocked, setVisitorsLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLikes = useCallback(async () => {
    setError(null);
    try {
      const res = await fetchLikes();
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("likes.loadError"));
    }
  }, [t]);

  const loadVisitors = useCallback(async () => {
    setError(null);
    try {
      const res = await fetchProfileViews();
      setVisitors(res.items);
      setVisitorsLocked(res.locked);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("likes.visitorsLoadError"));
    }
  }, [t]);

  useEffect(() => {
    setLoading(true);
    loadLikes().finally(() => setLoading(false));
  }, [loadLikes]);

  // Load visitors lazily, the first time that tab is opened - mirrors the
  // website's Likes component, which only fetches /profile-views once `tab
  // === "visitors"`.
  useEffect(() => {
    if (tab === "visitors" && visitors === null) {
      void loadVisitors();
    }
  }, [tab, visitors, loadVisitors]);

  // Tell the server which likes have been seen, same as the website does,
  // whenever the "Likes you" tab is the active one and there's something new
  // to report. Runs again on screen focus too, so returning to this tab
  // after seeing a new like still clears it.
  useFocusEffect(
    useCallback(() => {
      if (tab === "likesYou" && data?.readThroughId) {
        void markLikesRead(data.readThroughId).catch(() => undefined);
      }
    }, [tab, data?.readThroughId])
  );

  async function onRefresh() {
    setRefreshing(true);
    if (tab === "visitors") await loadVisitors();
    else await loadLikes();
    setRefreshing(false);
  }

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "likesYou", label: t("likes.tabLikesYou"), badge: data?.likesYouCount },
    { key: "matches", label: t("likes.tabMatches") },
    { key: "myLikes", label: t("likes.tabMyLikes") },
    { key: "visitors", label: t("likes.tabVisitors") },
  ];

  const isLocked = (tab === "likesYou" && Boolean(data?.likesYouLocked)) || (tab === "visitors" && visitorsLocked);
  const profileItems: ProfileSummary[] = tab === "visitors" ? visitors || [] : tab === "likesYou" ? data?.likesYou || [] : tab === "matches" ? data?.matches || [] : data?.myLikes || [];
  // The existing *long* copy (e.g. "likes.empty") reads well as the
  // description line under a short title, so it's reused there rather than
  // adding a parallel set of near-duplicate description keys.
  const emptyTitleKey = tab === "matches" ? "likes.emptyMatchesTitle" : tab === "myLikes" ? "likes.emptyMyLikesTitle" : tab === "visitors" ? "likes.emptyVisitorsTitle" : "likes.emptyTitle";
  const emptyDescKey = tab === "matches" ? "likes.emptyMatches" : tab === "myLikes" ? "likes.emptyMyLikes" : tab === "visitors" ? "likes.emptyVisitors" : "likes.empty";

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
        {tabs.map((item) => (
          <Pressable key={item.key} style={[styles.tabChip, tab === item.key && styles.tabChipActive]} onPress={() => setTab(item.key)}>
            <Text style={[styles.tabChipText, tab === item.key && styles.tabChipTextActive]}>
              {item.label}
              {item.badge ? <Text style={styles.tabChipBadge}> {item.badge}</Text> : null}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.pink} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : isLocked ? (
        <View style={styles.center}>
          <View style={styles.premiumCard}>
            <Text style={styles.premiumTitle}>{t("likes.premiumTitle")}</Text>
            <Text style={styles.premiumBody}>{t("likes.premiumBody")}</Text>
            <Pressable style={styles.premiumButton} onPress={() => rootNav.navigate("Subscription")}>
              <Text style={styles.premiumButtonText}>{t("likes.premiumButton")}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <FlatList
          data={profileItems}
          keyExtractor={(item, index) => String(item.id ?? index)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Text style={styles.emptyIcon}>{tab === "likesYou" ? "❤️" : tab === "matches" ? "✨" : tab === "myLikes" ? "👍" : "👀"}</Text>
              </View>
              <Text style={styles.emptyTitle}>{t(emptyTitleKey)}</Text>
              <Text style={styles.emptyDesc}>{t(emptyDescKey)}</Text>
              <Pressable style={styles.emptyCta} onPress={() => navigation.navigate("Catalog")}>
                <Text style={styles.emptyCtaText}>{t("likes.browseProfiles")}</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => {
            const visitor = tab === "visitors" ? (item as ProfileVisitor) : null;
            return (
              <Pressable style={styles.row} onPress={() => rootNav.navigate("ProfileDetail", { profileId: item.id })}>
                {item.avatarUrl ? (
                  <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarPlaceholderText}>{item.displayName?.[0] ?? "?"}</Text>
                  </View>
                )}
                <View style={styles.rowBody}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.displayName}
                  </Text>
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {[item.city, item.country].filter(Boolean).join(", ") || t("common.locationNotSet")}
                  </Text>
                  {visitor ? (
                    <Text style={styles.visitorNote} numberOfLines={1}>
                      {visitor.viewCount > 1 ? t("likes.viewedTimes", { count: visitor.viewCount }) : t("likes.viewedOnce")}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.heart}>♥</Text>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.card },
  tabsRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 6 },
  tabChip: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSoft,
    marginRight: 6,
  },
  tabChipActive: { backgroundColor: colors.ink },
  tabChipText: { fontSize: 12.5, fontWeight: "600", color: colors.muted },
  tabChipTextActive: { color: colors.white },
  tabChipBadge: { opacity: 0.7 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  errorText: { color: colors.danger, textAlign: "center" },
  emptyState: { alignItems: "center", paddingTop: 56, paddingHorizontal: spacing.lg },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.tintPink,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  emptyIcon: { fontSize: 30 },
  emptyTitle: { fontSize: 16.5, fontWeight: "700", color: colors.ink, textAlign: "center" },
  emptyDesc: { fontSize: 13, color: colors.muted, marginTop: 6, lineHeight: 19, textAlign: "center", maxWidth: 260 },
  emptyCta: {
    marginTop: 20,
    height: 44,
    paddingHorizontal: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.pink,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCtaText: { color: colors.white, fontSize: 13.5, fontWeight: "700" },
  premiumCard: { backgroundColor: colors.bgSoft, borderRadius: radius.lg, padding: spacing.lg, alignItems: "center", maxWidth: 320 },
  premiumTitle: { fontSize: 16, fontWeight: "800", color: colors.ink },
  premiumBody: { fontSize: 13, color: colors.muted, marginTop: spacing.xs, textAlign: "center", lineHeight: 18 },
  premiumButton: { marginTop: spacing.md, backgroundColor: colors.pink, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  premiumButtonText: { color: colors.white, fontWeight: "700" },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  avatar: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.line },
  avatarPlaceholder: { alignItems: "center", justifyContent: "center" },
  avatarPlaceholderText: { fontSize: 20, fontWeight: "700", color: colors.muted },
  rowBody: { flex: 1 },
  name: { fontSize: 16, fontWeight: "700", color: colors.ink },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  visitorNote: { fontSize: 12, color: colors.pink, marginTop: 2, fontWeight: "600" },
  heart: { fontSize: 16, color: colors.pink },
});
