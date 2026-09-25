import React, { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ApiError } from "../api/client";
import { likeProfile, unlikeProfile } from "../api/catalog";
import { createConversation } from "../api/messages";
import { fetchLikes, fetchProfileViews, markLikesRead } from "../api/likes";
import { fetchSubscriptionStatus } from "../api/subscription";
import type { LikesResponse, ProfileSummary, ProfileVisitor } from "../api/types";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing, tabBarClearance } from "../theme";
import type { MainTabsParamList } from "../navigation/MainTabs";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GradientBackground from "../components/GradientBackground";
import { countryName } from "../utils/countryNames";

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

// UPDATE (Sept 2026): Alena's original spec showed 5 real, clear rows as
// a free-tier teaser. She has since reversed that ("Опять замыливания
// нет! Я же вижу кто меня посмотрел! Я не должна на бесплатном тарифе")
// after seeing a competitor app that never reveals identity at all on the
// free tier (blurred photo, no name, age number only). The server
// (member_likes() in main.py) now sends real free-tier preview rows with
// identityHidden=true and no name/photo/location at all - see the
// identityHidden branch in renderItem below. Reduced from 5 to 4 rows per
// her explicit "оставь только 4 для примера" so the upgrade banner sits
// higher on screen. Must match LIKES_FREE_PREVIEW_COUNT in main.py.
const FREE_PREVIEW_COUNT = 4;

// UPDATE (Sept 23, Alena): "где я просила сделать видимым 1 лайк и 2
// просмотра в бесплатной версии с возможностью перехода" - reverses the
// "надо замылить чтобы не было видно вообще" instruction below (kept that
// comment in place for history/context, don't re-blur these on a future
// pass without re-confirming with her first - this exact toggle has
// flipped more than once on this screen).
//
// The backend (member_likes()/member_profile_views() in main.py) has
// already been sending real, unblurred, tappable rows for its own free
// quota since 2026-09-22 - LIKES_FREE_PREVIEW_COUNT = 1,
// PROFILE_VIEWS_FREE_PREVIEW_COUNT = 2 - this frontend just never stopped
// force-blurring every row in previewMode regardless, which is what left
// the free tier showing 4 fully-generic "Someone liked you" + lock rows
// instead of Alena's actual current spec: the first REAL_UNLOCKED_COUNT
// rows shown clear and tappable through to the profile, the rest (up to
// FREE_PREVIEW_COUNT above) as the locked teaser. Must match those two
// backend constants per tab.
const REAL_UNLOCKED_COUNT_FALLBACK: Partial<Record<Tab, number>> = { likesYou: 1, visitors: 2 };

export default function LikesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t, locale } = useI18n();
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
  const [realUnlockedCount, setRealUnlockedCount] = useState<Partial<Record<Tab, number>>>(REAL_UNLOCKED_COUNT_FALLBACK);
  useEffect(() => {
    fetchSubscriptionStatus()
      .then((status) =>
        setRealUnlockedCount({
          likesYou: status.limits?.freeLikesPreviewCount ?? REAL_UNLOCKED_COUNT_FALLBACK.likesYou,
          visitors: status.limits?.freeVisitorsPreviewCount ?? REAL_UNLOCKED_COUNT_FALLBACK.visitors,
        }),
      )
      .catch(() => undefined);
  }, []);

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
            <Text style={[styles.tabChipText, tab === item.key && styles.tabChipTextActive]}>{item.label}</Text>
            {/* Alena: "число новых лайков, мэтчев и тд - в баблы" - was
                plain dimmed text appended inline inside the label's own
                Text node; a real count bubble needs a View (a Text can't
                nest one), so the count moved out to its own sibling here. */}
            {item.badge ? (
              <View style={[styles.tabChipBadge, tab === item.key && styles.tabChipBadgeActive]}>
                <Text style={[styles.tabChipBadgeText, tab === item.key && styles.tabChipBadgeTextActive]}>{item.badge}</Text>
              </View>
            ) : null}
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
        <ScrollView contentContainerStyle={[styles.list, { paddingBottom: spacing.xs + tabBarClearance + insets.bottom }]}>
          <View style={styles.premiumBanner}>
            <Text style={styles.premiumTitle}>{t("likes.premiumTitle")}</Text>
            <Text style={styles.premiumBody}>{t("likes.premiumBody")}</Text>
            <Pressable style={styles.premiumButton} onPress={() => rootNav.navigate("LikesPaywall")}>
              <Text style={styles.premiumButtonText}>{t("likes.premiumButton")}</Text>
            </Pressable>
          </View>
          {lockedCount > 0
            ? Array.from({ length: lockedCount }, (_, i) => (
                <Pressable key={i} style={styles.card} onPress={() => rootNav.navigate("LikesPaywall")}>
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
          contentContainerStyle={[styles.list, { paddingBottom: spacing.xs + tabBarClearance + insets.bottom }]}
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
            //
            // UPDATE (Sept 2026): Alena, on the Visitors tab specifically -
            // "надо чтобы было показано что еще есть и другие просмотры"
            // (needs to show there are other visitors too) and "надо
            // написать чтобы просмотреть кто тебя смотрел, а не увидеть
            // только лайки" (say "see who viewed you", not reused "likes"
            // copy). This banner used to be one hardcoded pair of strings
            // for every tab it appears on (only likesYou/visitors ever hit
            // previewMode) - visitors got the "See everyone who likes
            // you"/"every admirer" copy verbatim, and neither tab's banner
            // ever said how many more there were even though the real
            // total (visitorsTotal / data.likesYouCount) was already being
            // fetched. Both fixed together: a tab-specific title/body key,
            // and the body interpolates {{count}} = total minus the real
            // rows already shown above it.
            previewMode && profileItems.length > 0 ? (
              <View style={styles.premiumBanner}>
                <Text style={styles.premiumTitle}>{t(tab === "visitors" ? "likes.previewLockedTitleVisitors" : "likes.previewLockedTitle")}</Text>
                <Text style={styles.premiumBody}>
                  {t(tab === "visitors" ? "likes.previewLockedBodyVisitors" : "likes.previewLockedBody", {
                    count: Math.max(0, (tab === "visitors" ? visitorsTotal : data?.likesYouCount || 0) - profileItems.length),
                  })}
                </Text>
                <Pressable style={styles.premiumButton} onPress={() => rootNav.navigate("LikesPaywall")}>
                  <Text style={styles.premiumButtonText}>{t("likes.previewUpgradeButton")}</Text>
                </Pressable>
              </View>
            ) : null
          }
          renderItem={({ item, index }) => {
            const visitor = tab === "visitors" ? (item as ProfileVisitor) : null;
            // Alena, precisely (kept for history - see the
            // REAL_UNLOCKED_COUNT comment up top, this was later
            // reversed): "надо замылить чтобы не было видно вообще кто
            // лайк поставил" - every row used to be blurred while
            // previewMode was on. Now only rows past the real backend
            // quota (REAL_UNLOCKED_COUNT per tab - the same rows
            // member_likes()/member_profile_views() actually send real,
            // unblurred identity for) are locked; the first
            // REAL_UNLOCKED_COUNT rows render as normal, tappable-through
            // cards below.
            const previewLocked = previewMode && index >= (realUnlockedCount[tab] ?? 0);
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
                onPress={() => (previewLocked ? rootNav.navigate("LikesPaywall") : rootNav.navigate("ProfileDetail", { profileId: item.id }))}
              >
                {/* Alena, again, verbatim: "Нет замыливания!!!" - this
                    time on the PREMIUM self-test "preview as free" toggle
                    specifically (item.identityHidden is already false
                    here, since her own account really is Premium and the
                    server has no "pretend I'm free" flag to send back
                    anonymized rows for - it only omits/masks identity for
                    an account that's ACTUALLY free). That left this one
                    remaining path still rendering the real avatar/name/
                    city and relying on a runtime BlurView on top to hide
                    it - the exact same "lock icon showed, blur did not,
                    real photo fully visible" Android failure the
                    identityHidden rework above already worked around for
                    real free accounts. Folding previewLocked into the
                    same "nothing real ever gets rendered" check removes
                    the last place still depending on BlurView actually
                    working: the preview-as-free toggle now shows the
                    exact same silhouette+age-only treatment a genuinely
                    free account already gets, instead of real data plus a
                    blur that may or may not show up. */}
                {(() => {
                  const effectivelyHidden = item.identityHidden || previewLocked;
                  return effectivelyHidden && item.avatarUrl ? (
                    <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
                  ) : effectivelyHidden ? (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Feather name="user" size={22} color={colors.muted} />
                    </View>
                  ) : item.avatarUrl ? (
                    <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Text style={styles.avatarPlaceholderText}>{item.displayName?.[0] ?? "?"}</Text>
                    </View>
                  );
                })()}
                <View style={styles.rowBody}>
                  {item.identityHidden || previewLocked ? (
                    <Text style={styles.name} numberOfLines={1}>
                      {item.age != null ? t("likes.anonymousAge", { age: item.age }) : t("likes.anonymousAgeUnknown")}
                    </Text>
                  ) : (
                    <>
                      <Text style={styles.name} numberOfLines={1}>
                        {item.age != null ? `${item.displayName ?? "?"}, ${item.age}` : item.displayName}
                      </Text>
                      <Text style={styles.subtitle} numberOfLines={1}>
                        {[item.city, item.country ? countryName(item.country, locale) : null].filter(Boolean).join(", ") || t("common.locationNotSet")}
                      </Text>
                    </>
                  )}
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
                  // Alena: "сделай как в меню снизу иконка только закрасить
                  // в красный" - the bottom tab bar's Likes icon is
                  // Feather's "heart" outline (see MainTabs.tsx's
                  // ICON_NAMES); Feather has no filled variant, so this
                  // uses Ionicons' "heart" (same simple rounded heart
                  // shape, solid) instead of the plain "♥" text glyph.
                  <Ionicons name="heart" size={18} color={colors.pink} />
                )}
                {/* No BlurView overlay left here at all, on purpose. It
                    used to be the ONLY thing hiding real data on this row
                    for the "previewAsFree" self-test toggle, and it's an
                    unreliable thing to depend on for that: confirmed
                    failing to render on at least one real Android device
                    (lock icon showed, blur did not, photo and name were
                    fully visible underneath) even with the more
                    compatible "dimezisBlurView" method above. Since
                    effectivelyHidden above already substitutes the same
                    generic silhouette+age placeholder a genuinely free
                    account gets - instead of rendering the real data and
                    trying to obscure it after the fact - there's nothing
                    real left under this row for a blur to protect, on any
                    device, blur-capable or not. */}
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
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSoft,
    marginRight: 6,
  },
  tabChipActive: { backgroundColor: colors.ink },
  tabChipText: { fontSize: 12.5, fontWeight: "600", color: colors.muted },
  tabChipTextActive: { color: colors.white },
  // Count bubble (Alena: "в баблы") - dimmed pink-on-white for an inactive
  // chip, inverted to white-on-translucent-white for the active (dark)
  // chip so it stays legible against colors.ink.
  tabChipBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: colors.tintPink,
    alignItems: "center",
    justifyContent: "center",
  },
  tabChipBadgeActive: { backgroundColor: "rgba(255,255,255,0.22)" },
  tabChipBadgeText: { fontSize: 11, fontWeight: "700", color: colors.pink },
  tabChipBadgeTextActive: { color: colors.white },
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
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xs + tabBarClearance, gap: 10 },
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
