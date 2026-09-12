import React, { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BlurView } from "expo-blur";
import { ApiError } from "../api/client";
import { likeProfile, unlikeProfile } from "../api/catalog";
import { createConversation } from "../api/messages";
import { fetchLikes, fetchProfileViews, markLikesRead } from "../api/likes";
import type { LikesResponse, ProfileSummary, ProfileVisitor } from "../api/types";
import { Feather } from "@expo/vector-icons";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing, tabBarClearance } from "../theme";
import type { MainTabsParamList } from "../navigation/MainTabs";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GradientBackground from "../components/GradientBackground";

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

// Alena's explicit spec (Sept 2026, after the first pass used the
// reference mockup's "not just the first two" copy): show 5 rows clearly,
// blur everything after that, with the upgrade card below - not 2. The
// first FREE_PREVIEW_COUNT rows of a premium account's real
// likesYou/Visitors list stay fully visible even with the "preview as
// free" toggle on; only rows after that are blurred.
const FREE_PREVIEW_COUNT = 5;

export default function LikesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("likesYou");
  const [data, setData] = useState<LikesResponse | null>(null);
  const [visitors, setVisitors] = useState<ProfileVisitor[] | null>(null);
  const [visitorsLocked, setVisitorsLocked] = useState(false);
  const [visitorsTotal, setVisitorsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Was a single shared `error` state used for BOTH loadLikes() and
  // loadVisitors() - since switching tabs doesn't re-run either load for a
  // tab whose data is already cached, a failed Visitors fetch left `error`
  // set, and every OTHER tab (Likes you/Matches/My likes, which had loaded
  // fine) then rendered that same leftover error screen too - exactly what
  // Alena reported: "как только перешла в визиторс сразу ошибка и потом и
  // в лайках и везде такая ошибка". Split into one error per data source so
  // a Visitors failure can't blank out tabs that loaded fine.
  const [likesError, setLikesError] = useState<string | null>(null);
  const [visitorsError, setVisitorsError] = useState<string | null>(null);
  // Alena's reference mockup for #scr-likes shows a message + like-back
  // button on each "Likes you"/"Visitors" row (people you haven't acted on
  // yet), not just a static heart - reusing the same createConversation/
  // likeProfile calls ProfileDetailScreen's own message/like buttons use,
  // so this is real functionality, not decoration. messagingId/likingId
  // track which single row is mid-request so only that row's button spins.
  const [messagingId, setMessagingId] = useState<number | null>(null);
  const [likingId, setLikingId] = useState<number | null>(null);
  // Was a Set that only ever grew (add on like-back, never removed) - once
  // tapped once, a row's "like back" button stayed permanently disabled/
  // greyed out for the rest of this screen's lifetime, with no way to
  // undo. That's Alena's "сняла лайк и он не ставится обратно": she
  // unliked the profile from ProfileDetailScreen (a real toggle there -
  // see handleLike's wasLiked/unlikeProfile), came back here, and the
  // button here had no idea the like was gone. Replaced with a map of
  // per-row overrides layered on top of the server's own item.likedByViewer,
  // so this screen starts from real state and reflects whichever direction
  // was tapped most recently, in either place.
  const [likeOverrides, setLikeOverrides] = useState<Record<number, boolean>>({});
  // Alena hit this directly: liked someone back, it became a mutual match
  // ("It's a match!"), then tapping the same button again to undo it threw
  // a raw server error - {"detail":"Likes are irreversible. Block the
  // profile to remove mutual interaction."} (now shown cleanly since
  // client.ts's extractErrorMessage fix, but still a dead-end round trip).
  // The backend genuinely refuses to undo a like once it's part of a
  // match - only blocking removes it - so once a like-back matches, track
  // it here and short-circuit the button locally with an explanation
  // instead of letting her hit that same wall on every tap.
  const [matchedIds, setMatchedIds] = useState<Record<number, boolean>>({});

  // Alena: "и где тумблер на переключение премиум? чтобы я увидела как
  // выглядит у обычного пользователя с замыленным экраном" - a QA-only
  // toggle so a premium test account can preview the free-tier locked
  // view without actually downgrading. Local state only, never sent
  // anywhere - flips how THIS screen renders the data it already has.
  const [previewAsFree, setPreviewAsFree] = useState(false);

  async function handleMessage(item: ProfileSummary) {
    if (messagingId) return;
    setMessagingId(item.id);
    try {
      const res = await createConversation(item.id);
      rootNav.navigate("Chat", { conversationId: res.conversationId, title: item.displayName || t("messages.chatTitleFallback") });
    } catch (err) {
      Alert.alert(t("profileDetail.messageError"), err instanceof ApiError ? err.message : t("common.pleaseTryAgain"));
    } finally {
      setMessagingId(null);
    }
  }

  async function handleToggleLike(item: ProfileSummary, currentlyLiked: boolean, isMatched: boolean) {
    if (likingId) return;
    if (currentlyLiked && isMatched) {
      // Don't even try - the server will refuse this every time. Explain
      // why instead of round-tripping to a "Couldn't send this like" alert.
      Alert.alert(t("likes.matchLockedTitle"), t("likes.matchLockedBody"));
      return;
    }
    setLikingId(item.id);
    try {
      if (currentlyLiked) {
        // Real undo now, matching ProfileDetailScreen's own like/unlike
        // toggle - previously there was no way back from here at all.
        await unlikeProfile(item.id);
        setLikeOverrides((prev) => ({ ...prev, [item.id]: false }));
      } else {
        const res = await likeProfile(item.id);
        setLikeOverrides((prev) => ({ ...prev, [item.id]: true }));
        // Was navigating straight into the Chat screen the instant a like-back
        // created a mutual match, with zero feedback first - from Alena's own
        // recording, that reads as the like button randomly teleporting her
        // into a message screen ("при снятии лайка переходит в сообщение",
        // "поставить опять здесь почему-то нельзя" - she didn't realize she'd
        // just matched, only that tapping like did something unexpected and
        // then the button looked stuck/disabled). CatalogScreen already shows
        // a real "It's a match!" celebration for the same event when it
        // happens via a swipe; this doesn't reuse that overlay (it's local to
        // CatalogScreen), but at minimum names what just happened and makes
        // the jump to Chat something the person chooses, not something that
        // just happens to them.
        if (res.matched) {
          setMatchedIds((prev) => ({ ...prev, [item.id]: true }));
        }
        if (res.matched && res.conversationId) {
          const conversationId = res.conversationId;
          const title = item.displayName || t("messages.chatTitleFallback");
          Alert.alert(t("likes.matchTitle"), t("likes.matchBody", { name: item.displayName || "" }), [
            { text: t("likes.matchLater"), style: "cancel" },
            { text: t("likes.matchViewChat"), onPress: () => rootNav.navigate("Chat", { conversationId, title }) },
          ]);
        }
      }
    } catch (err) {
      Alert.alert(t("likes.likeBackError"), err instanceof ApiError ? err.message : t("common.pleaseTryAgain"));
    } finally {
      setLikingId(null);
    }
  }

  const loadLikes = useCallback(async () => {
    setLikesError(null);
    try {
      const res = await fetchLikes();
      setData(res);
    } catch (err) {
      setLikesError(err instanceof ApiError ? err.message : t("likes.loadError"));
    }
  }, [t]);

  const loadVisitors = useCallback(async () => {
    setVisitorsError(null);
    try {
      const res = await fetchProfileViews();
      setVisitors(res.items);
      setVisitorsLocked(res.locked);
      setVisitorsTotal(res.total);
    } catch (err) {
      setVisitorsError(err instanceof ApiError ? err.message : t("likes.visitorsLoadError"));
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

  // likesYouLocked reflects the account's REAL tier (member_likes() in
  // main.py sets it from is_premium) - true premium accounts can flip
  // previewAsFree on to see the free view without losing their own data.
  const accountIsPremium = data ? !data.likesYouLocked : false;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        accountIsPremium ? (
          <View style={styles.headerToggle}>
            <Text style={styles.headerToggleLabel}>{t("likes.previewAsFree")}</Text>
            {/* Alena's reference mockup (and her bug report - "when Premium
                is switched OFF, the likes should be blurred with an
                upgrade offer") both read the switch as a "Premium" status
                toggle: ON means "acting as my real premium self" (full
                unlocked list), OFF means "acting as a free user" (blurred
                preview + upsell). That's the OPPOSITE of previewAsFree's
                own true/false (previewAsFree=true means "simulate free"),
                so the Switch's displayed value/handler are inverted here
                on purpose - previewAsFree itself is unchanged everywhere
                else in this file. */}
            <Switch
              value={!previewAsFree}
              onValueChange={(isPremiumOn) => setPreviewAsFree(!isPremiumOn)}
              trackColor={{ false: colors.line, true: colors.pink }}
              thumbColor="#fff"
            />
          </View>
        ) : null,
    });
  }, [navigation, accountIsPremium, previewAsFree, t]);

  // Only likesYou/Visitors are ever gated for a real free account - Matches
  // and My likes are unlocked at every tier - so the preview only applies
  // to those same two tabs.
  const isPreviewingFree = previewAsFree && accountIsPremium && (tab === "likesYou" || tab === "visitors");
  const realLocked = (tab === "likesYou" && Boolean(data?.likesYouLocked)) || (tab === "visitors" && visitorsLocked);
  // FIX (Sept 2026): a genuinely free account used to get a completely
  // different, separate treatment here - generic gray placeholder bars,
  // because member_likes()/member_profile_views() withheld ALL row data
  // for a non-Premium viewer, leaving nothing real to show or blur. Alena
  // kept sending the same reference mockup ("покажи 5шт", "замылить")
  // because that placeholder view never matched it. member_likes() now
  // sends real data for a free account's first FREE_PREVIEW_COUNT likers
  // (see LIKES_FREE_PREVIEW_COUNT in main.py) - so a real free account and
  // the Premium "previewAsFree" self-test toggle can now share the exact
  // same rendering below: real clear rows up to FREE_PREVIEW_COUNT, blurred
  // beyond that (only reachable in the self-test case, which already has
  // more real rows loaded), upgrade banner under the list either way.
  const previewMode = isPreviewingFree || realLocked;
  // Fallback only for a tab with a nonzero total but ZERO real preview rows
  // (visitors - member_profile_views() wasn't touched by this fix, still
  // withholds everything for a free account) - generic locked placeholder
  // rows up to the count, capped at 6 so it doesn't produce a huge
  // empty-looking list of identical rows.
  const lockedCount = Math.min(tab === "visitors" ? visitorsTotal : data?.likesYouCount || 0, 6);
  const allProfileItems: ProfileSummary[] = tab === "visitors" ? visitors || [] : tab === "likesYou" ? data?.likesYou || [] : tab === "matches" ? data?.matches || [] : data?.myLikes || [];
  // Alena's spec, repeated many times: 5 clear rows, then the upgrade card
  // - visible WITHOUT scrolling, since "никто листать вниз не будет".
  // An earlier version of this screen rendered every remaining liker as an
  // extra blurred row before the upgrade card, which pushed the card back
  // below the fold whenever there were more than a couple of them. Capping
  // the list itself to FREE_PREVIEW_COUNT means the upgrade banner
  // (ListFooterComponent below) always lands directly under row 5.
  const profileItems: ProfileSummary[] = previewMode ? allProfileItems.slice(0, FREE_PREVIEW_COUNT) : allProfileItems;
  // The existing *long* copy (e.g. "likes.empty") reads well as the
  // description line under a short title, so it's reused there rather than
  // adding a parallel set of near-duplicate description keys.
  const emptyTitleKey = tab === "matches" ? "likes.emptyMatchesTitle" : tab === "myLikes" ? "likes.emptyMyLikesTitle" : tab === "visitors" ? "likes.emptyVisitorsTitle" : "likes.emptyTitle";
  const emptyDescKey = tab === "matches" ? "likes.emptyMatches" : tab === "myLikes" ? "likes.emptyMyLikes" : tab === "visitors" ? "likes.emptyVisitors" : "likes.empty";

  return (
    <GradientBackground variant="vivid">
    <View style={styles.container}>
      {/* React Native's ScrollView defaults its OWN outer style to
          flexGrow:1 (see ScrollView.js's baseHorizontal) whenever no
          `style` prop overrides it - not just contentContainerStyle. Inside
          this screen's flex:1 container, with nothing else competing for
          space below, that made this row grow to fill nearly the whole
          screen height, and with no `alignItems` set the tab chips then
          stretched to match - the "giant vertical pills" Alena kept
          reporting. flexGrow:0/flexShrink:0 here makes the row size to its
          own content height instead. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabsRow}
      >
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
      ) : (tab === "visitors" ? visitorsError : likesError) ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{tab === "visitors" ? visitorsError : likesError}</Text>
        </View>
      ) : previewMode && profileItems.length === 0 ? (
        <ScrollView contentContainerStyle={[styles.list, { paddingBottom: spacing.xl + tabBarClearance + insets.bottom }]}>
          <View style={styles.premiumBanner}>
            <Text style={styles.premiumTitle}>{t("likes.premiumTitle")}</Text>
            <Text style={styles.premiumBody}>{t("likes.premiumBody")}</Text>
            <Pressable style={styles.premiumButton} onPress={() => rootNav.navigate("Subscription")}>
              <Text style={styles.premiumButtonText}>{t("likes.premiumButton")}</Text>
            </Pressable>
          </View>
          {lockedCount > 0
            ? Array.from({ length: lockedCount }, (_, i) => (
                <Pressable key={i} style={styles.card} onPress={() => rootNav.navigate("Subscription")}>
                  <View style={[styles.avatar, styles.avatarLocked]}>
                    <Feather name="lock" size={18} color={colors.muted} />
                  </View>
                  <View style={styles.rowBody}>
                    <View style={styles.lockedBarWide} />
                    <View style={styles.lockedBarNarrow} />
                  </View>
                </Pressable>
              ))
            : null}
        </ScrollView>
      ) : (
        <FlatList
          data={profileItems}
          keyExtractor={(item, index) => String(item.id ?? index)}
          contentContainerStyle={[styles.list, { paddingBottom: spacing.xl + tabBarClearance + insets.bottom }]}
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
          ListFooterComponent={
            // Real people, real photos - this account IS premium, so
            // previewAsFree just shows what a free viewer of the SAME data
            // would see (first FREE_PREVIEW_COUNT rows above stay real,
            // the rest blurred), with a dedicated upgrade banner at the
            // bottom - matching the reference mockup's layout (banner
            // below the row list, not above it).
            previewMode && profileItems.length > 0 ? (
              <View style={styles.premiumBanner}>
                <Text style={styles.premiumTitle}>{t("likes.previewLockedTitle")}</Text>
                <Text style={styles.premiumBody}>{t("likes.previewLockedBody")}</Text>
                <Pressable style={styles.premiumButton} onPress={() => rootNav.navigate("Subscription")}>
                  <Text style={styles.premiumButtonText}>{t("likes.previewUpgradeButton")}</Text>
                </Pressable>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const visitor = tab === "visitors" ? (item as ProfileVisitor) : null;
            // Alena, precisely: "надо замылить чтобы не было видно вообще
            // кто лайк поставил" - a free viewer must not be able to tell
            // WHO liked them, not even for the handful of rows shown as a
            // teaser. So every row is blurred while previewMode is on
            // (profileItems is already capped to FREE_PREVIEW_COUNT rows
            // in that case - see where it's built above), not just rows
            // past some "free" cutoff the way an earlier version of this
            // screen did it.
            const previewLocked = previewMode;
            // Reference mockup (#scr-likes): a "message" + "like back" round
            // button pair on rows for people you haven't acted on yet.
            // Doesn't apply to Matches (already mutual) or My likes (you
            // already liked them) - those keep the simpler static heart,
            // since a working "like" button there would just be relabelling
            // an already-done action as something to tap again.
            const showActionButtons = !previewLocked && (tab === "likesYou" || tab === "visitors");
            // Server truth (item.likedByViewer) first, then whichever
            // direction was most recently tapped on this screen.
            const alreadyLiked = likeOverrides[item.id] ?? !!item.likedByViewer;
            const isMatched = matchedIds[item.id] ?? !!item.matchedAt;
            return (
              <Pressable
                style={styles.card}
                onPress={() => (previewLocked ? rootNav.navigate("Subscription") : rootNav.navigate("ProfileDetail", { profileId: item.id }))}
              >
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
                {showActionButtons ? (
                  <View style={styles.rowActions}>
                    <Pressable
                      style={styles.actionButtonBlue}
                      hitSlop={6}
                      onPress={() => void handleMessage(item)}
                      disabled={messagingId === item.id}
                    >
                      {messagingId === item.id ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <Feather name="message-circle" size={17} color={colors.white} />
                      )}
                    </Pressable>
                    <Pressable
                      style={[styles.actionButtonPink, alreadyLiked && styles.actionButtonPinkDone]}
                      hitSlop={6}
                      onPress={() => void handleToggleLike(item, alreadyLiked, isMatched)}
                      disabled={likingId === item.id}
                    >
                      {likingId === item.id ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <Feather name="thumbs-up" size={17} color={colors.white} />
                      )}
                    </Pressable>
                  </View>
                ) : previewLocked ? (
                  <Feather name="lock" size={16} color={colors.muted} />
                ) : (
                  <Text style={styles.heart}>♥</Text>
                )}
                {/* Frosted-glass overlay over the WHOLE row (photo AND
                    name/location text) - not just the photo - since the
                    point is that no part of who this is should be
                    readable. */}
                {previewLocked ? (
                  <BlurView
                    intensity={50}
                    tint="light"
                    // Android's default BlurView needs API 31+ (RenderEffect)
                    // to actually blur - on anything older it silently
                    // renders nothing at all. This library-based method
                    // works on Android API 21+ too; iOS ignores the prop
                    // and uses its own native blur regardless.
                    experimentalBlurMethod="dimezisBlurView"
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                ) : null}
              </Pressable>
            );
          }}
        />
      )}
    </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  tabsScroll: { flexGrow: 0, flexShrink: 0 },
  tabsRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 6, alignItems: "center" },
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
  premiumBanner: { backgroundColor: colors.bgSoft, borderRadius: radius.lg, padding: spacing.lg, alignItems: "center", marginBottom: spacing.md },
  premiumTitle: { fontSize: 16, fontWeight: "800", color: colors.ink },
  premiumBody: { fontSize: 13, color: colors.muted, marginTop: spacing.xs, textAlign: "center", lineHeight: 18 },
  premiumButton: { marginTop: spacing.md, backgroundColor: colors.pink, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  premiumButtonText: { color: colors.white, fontWeight: "700" },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl + tabBarClearance, gap: 10 },
  // Reference mockup (#scr-likes): each row is its own white rounded card
  // floating on the gradient background, not a flat row sharing one long
  // divided list the way it was before - Alena: "белая заливка внутри 2
  // кнопки совершенно др вид".
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
    overflow: "hidden",
  },
  headerToggle: { flexDirection: "row", alignItems: "center", gap: 6, marginRight: spacing.sm },
  headerToggleLabel: { fontSize: 12.5, fontWeight: "700", color: colors.ink },
  avatar: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.line },
  avatarPlaceholder: { alignItems: "center", justifyContent: "center" },
  // Generic locked-row placeholder for a non-Premium likesYou/visitors tab
  // (see the lockedCount comment above) - a lock icon standing in for an
  // avatar nobody sent, and two grey bars standing in for a name/subtitle
  // line, rather than blurring real data the backend never sent down.
  avatarLocked: { alignItems: "center", justifyContent: "center", backgroundColor: colors.bgSoft },
  lockedBarWide: { height: 13, width: "55%", borderRadius: 6, backgroundColor: colors.line },
  lockedBarNarrow: { height: 11, width: "35%", borderRadius: 6, backgroundColor: colors.line, marginTop: 8 },
  avatarPlaceholderText: { fontSize: 20, fontWeight: "700", color: colors.muted },
  rowBody: { flex: 1 },
  name: { fontSize: 16, fontWeight: "700", color: colors.ink },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  visitorNote: { fontSize: 12, color: colors.pink, marginTop: 2, fontWeight: "600" },
  heart: { fontSize: 16, color: colors.pink },
  rowActions: { flexDirection: "row", gap: 8 },
  actionButtonBlue: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonPink: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.pink,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonPinkDone: { backgroundColor: colors.line },
});
