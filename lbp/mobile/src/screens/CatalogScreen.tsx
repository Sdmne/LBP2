import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import {
  Gesture,
  GestureDetector,
  type GestureStateChangeEvent,
  type GestureUpdateEvent,
  type PanGestureHandlerEventPayload,
} from "react-native-gesture-handler";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { fetchCatalog, fetchCatalogProfileDetail, likeProfile } from "../api/catalog";
import type { ProfileDetailData } from "../utils/profileFields";
import ProfileDetailSections from "../components/ProfileDetailSections";
import { emptyCatalogFilters, type CatalogFilters } from "../api/catalogFilters";
import { createConversation } from "../api/messages";
import { fetchPhotos } from "../api/photos";
import { ApiError } from "../api/client";
import type { CatalogProfile } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing, tabBarClearance } from "../theme";
import { catalogOptionLabel } from "../data/catalogLabels";
import type { MainTabsParamList } from "../navigation/MainTabs";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GradientBackground from "../components/GradientBackground";

const PAGE_SIZE = 24;
// Start pulling the next page once this many cards are left in the deck,
// so the person (hopefully) never actually hits the end mid-swipe.
const REFILL_THRESHOLD = 5;
const SWIPE_OUT_DISTANCE = 500;
const SWIPE_THRESHOLD = 120;

type Props = BottomTabScreenProps<MainTabsParamList, "Catalog">;

// Rebuilt as a swipeable card stack (Tinder-style) to match the real,
// current design prototype (Claude outputs/app-prototype-inline.html,
// #scr-browse) instead of the plain scrolling list this used to be - see
// the "Browse" tab screenshot feedback that kicked this off. Needs
// react-native-gesture-handler + react-native-reanimated, installed via
// `npx expo install react-native-gesture-handler react-native-reanimated
// expo-linear-gradient` (see README) - NOT pinned in package.json myself
// since I can't verify exact SDK-57-compatible versions from here; expo
// install resolves those correctly on your machine.
//
// There's no backend concept of "pass"/"skip" (only POST/DELETE
// /api/member/likes/{id} - see src/api/catalog.ts) so swiping left just
// advances the local deck without calling the API; nothing stops the same
// profile reappearing on the next full reload right now. Swiping right (or
// tapping the like button) calls the real like endpoint. Profiles already
// liked by the viewer are filtered out of the deck up front - no point
// re-swiping someone you've already liked.
export default function CatalogScreen({ navigation, route }: Props) {
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const initial = (user?.displayName?.[0] ?? "?").toUpperCase();
  const [profiles, setProfiles] = useState<CatalogProfile[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // "It's a Match!" overlay (#scr-matched) - POST /api/member/likes/{id}
  // already returns matched/conversationId (see api/catalog.ts's LikeResult),
  // it just wasn't being read anywhere. myPhotoUrl is prefetched once so
  // it's ready the moment a match happens, same GET /api/member/photos +
  // position-0 pattern VerificationScreen.tsx already uses for "your main
  // photo".
  const [matchModal, setMatchModal] = useState<{ profile: CatalogProfile; conversationId: number | null } | null>(null);
  const [myPhotoUrl, setMyPhotoUrl] = useState<string | null>(null);
  const requestSeqRef = useRef(0);
  // Catalog filters (#scr-filters) - FiltersScreen navigates back into this
  // tab with fresh params (see MainTabsParamList.Catalog) rather than a
  // callback, since functions aren't serializable route params.
  const [filters, setFilters] = useState<CatalogFilters>(emptyCatalogFilters());

  useEffect(() => {
    fetchPhotos()
      .then((res) => setMyPhotoUrl(res.items.find((p) => p.position === 0)?.publicUrl || null))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (route.params?.appliedAt && route.params.appliedFilters) {
      setFilters(route.params.appliedFilters);
      navigation.setParams({ appliedFilters: undefined, appliedAt: undefined });
    }
  }, [route.params?.appliedAt]);

  const load = useCallback(async () => {
    setError(null);
    const seq = ++requestSeqRef.current;
    try {
      const res = await fetchCatalog(0, PAGE_SIZE, filters);
      if (seq !== requestSeqRef.current) return;
      setProfiles(res.items.filter((p) => !p.likedByViewer));
      setIndex(0);
      setTotal(res.total);
    } catch (err) {
      if (seq !== requestSeqRef.current) return;
      setError(err instanceof ApiError ? err.message : t("catalog.loadError"));
    }
  }, [t, filters]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    if (total !== null && profiles.length >= total) return;
    setLoadingMore(true);
    const seq = ++requestSeqRef.current;
    try {
      const res = await fetchCatalog(profiles.length, PAGE_SIZE, filters);
      if (seq !== requestSeqRef.current) return;
      setProfiles((prev) => [...prev, ...res.items.filter((p) => !p.likedByViewer)]);
      setTotal(res.total);
    } catch {
      // Silent - the deck just runs dry and shows the empty state; pull to
      // reload (via the retry button there) tries again.
    } finally {
      if (seq === requestSeqRef.current) setLoadingMore(false);
    }
  }, [loadingMore, total, profiles.length, filters]);

  useEffect(() => {
    if (profiles.length - index <= REFILL_THRESHOLD) {
      void loadMore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, profiles.length]);

  const current = profiles[index];
  const next = profiles[index + 1];

  // Inline "scroll to see the full profile without leaving Browse"
  // expansion (Alena's screen recording of the prototype: tapping the "^^"
  // affordance on the card scrolls it in place to reveal Looking for/
  // Contact with the child/About me/Languages/Occupation/... underneath,
  // while this row and the tab bar stay put - not a navigation to a
  // separate screen). Only ever one card expanded at a time, and it
  // collapses automatically once the deck moves past it.
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<ProfileDetailData | null>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);
  const [expandedError, setExpandedError] = useState<string | null>(null);

  useEffect(() => {
    setExpandedId(null);
    setExpandedDetail(null);
    setExpandedError(null);
  }, [index]);

  useEffect(() => {
    if (expandedId == null) return;
    let cancelled = false;
    setExpandedDetail(null);
    setExpandedError(null);
    setExpandedLoading(true);
    fetchCatalogProfileDetail(expandedId)
      .then((detail) => {
        if (!cancelled) setExpandedDetail(detail);
      })
      .catch((err) => {
        if (!cancelled) setExpandedError(err instanceof ApiError ? err.message : t("catalog.loadError"));
      })
      .finally(() => {
        if (!cancelled) setExpandedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [expandedId, t]);

  async function advance(direction: "like" | "pass", profile: CatalogProfile) {
    setActionError(null);
    setIndex((i) => i + 1);
    if (direction === "like") {
      try {
        const res = await likeProfile(profile.id);
        if (res.matched) setMatchModal({ profile, conversationId: res.conversationId });
      } catch (err) {
        // The card has already moved on visually (no "undo" gesture in this
        // design), but the like itself may not have been recorded - most
        // commonly because the viewer isn't verified yet (403) or hit the
        // daily like limit (429). Surface that instead of failing silently,
        // otherwise liking looks broken with zero feedback.
        if (err instanceof ApiError && err.status === 403) {
          setActionError(t("catalog.messageNeedsVerification"));
        } else if (err instanceof ApiError && err.status === 429) {
          setActionError(err.message || t("common.somethingWrong"));
        } else if (err instanceof ApiError) {
          setActionError(err.message || t("common.somethingWrong"));
        }
      }
    }
  }

  async function handleMessage(profile: CatalogProfile) {
    setActionError(null);
    try {
      const res = await createConversation(profile.id);
      rootNav.navigate("Chat", { conversationId: res.conversationId, title: profile.displayName });
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        setActionError(t("catalog.messageNeedsPremium"));
      } else if (err instanceof ApiError && err.status === 429) {
        setActionError(t("catalog.messageRateLimited"));
      } else if (err instanceof ApiError && err.status === 403) {
        setActionError(t("catalog.messageNeedsVerification"));
      } else {
        setActionError(t("common.somethingWrong"));
      }
    }
  }

  if (loading) {
    return (
      <GradientBackground variant="vivid">
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.white} />
        </View>
      </GradientBackground>
    );
  }

  if (error) {
    return (
      <GradientBackground variant="vivid">
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => load()}>
            <Text style={styles.retryButtonText}>{t("common.tryAgain")}</Text>
          </Pressable>
        </View>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground variant="vivid">
    <View style={styles.screen}>
      {/* CatalogScreen builds its own header rather than reusing
          AppHeader (it needs the extra filter button), so it needed the
          same top safe-area fix separately - AppHeader.tsx's own fix
          doesn't reach this one. */}
      <View style={[styles.header, { paddingTop: spacing.sm + insets.top }]}>
        <View style={styles.headerBrand}>
          <Image source={require("../../assets/logo-mark.png")} style={styles.headerLogo} />
          <Text style={styles.headerTitle}>{t("catalog.browseTitle")}</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            hitSlop={8}
            style={styles.avatarButton}
            onPress={() => rootNav.navigate("Filters", { initial: filters })}
          >
            <Feather name="sliders" size={16} color={colors.ink} />
          </Pressable>
          <Pressable hitSlop={8} onPress={() => navigation.navigate("Me")}>
            <LinearGradient
              colors={["#4e9bff", "#f070a9"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.profileAvatar}
            >
              <Text style={styles.profileAvatarText}>{initial}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>

      {actionError ? (
        <Pressable style={styles.actionErrorBanner} onPress={() => setActionError(null)}>
          <Text style={styles.actionErrorText}>{actionError}</Text>
        </Pressable>
      ) : null}

      <View style={[styles.deck, { paddingBottom: spacing.md + tabBarClearance + insets.bottom }]}>
        {!current ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>{t("catalog.empty")}</Text>
            <Pressable style={styles.retryButton} onPress={() => load()}>
              <Text style={styles.retryButtonText}>{t("common.tryAgain")}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.cardArea}>
              {next ? <SwipeCard key={`under-${next.id}`} profile={next} isTop={false} /> : null}
              {expandedId === current.id ? (
                <ExpandedProfileCard
                  profile={current}
                  detail={expandedDetail}
                  loading={expandedLoading}
                  error={expandedError}
                  onCollapse={() => setExpandedId(null)}
                />
              ) : (
                <SwipeCard
                  key={`top-${current.id}`}
                  profile={current}
                  isTop
                  onSwiped={(direction) => advance(direction, current)}
                  onOpenProfile={() => setExpandedId(current.id)}
                />
              )}
            </View>
            {/* Reference mockup (her side-by-side comparison, Sept 2026):
                ALL FOUR buttons sit in one row below the card, not split
                between the photo's top corner and the info panel like the
                previous pass had it - card+row were laid out as siblings
                that were BOTH still absolutely positioned relative to the
                whole deck though (the card via `card`'s own inset styles,
                this row via its own bottom offset), so they still had no
                real relationship to each other and could still overlap
                once the info panel grew. Now cardArea is a normal flex:1
                box and this row is a normal flex sibling below it, in
                actual layout flow - structurally can't overlap. */}
            <View style={styles.actionsRow}>
              <Pressable style={styles.actionBtn} onPress={() => advance("pass", current)}>
                <Feather name="x" size={22} color={colors.ink} />
              </Pressable>
              <Pressable style={styles.actionBtn} onPress={() => rootNav.navigate("ProfileDetail", { profileId: current.id })}>
                <Feather name="user" size={20} color={colors.ink} />
              </Pressable>
              <Pressable style={styles.actionBtn} onPress={() => handleMessage(current)}>
                <Feather name="message-circle" size={20} color={colors.ink} />
              </Pressable>
              <Pressable style={[styles.actionBtn, styles.actionBtnFilled]} onPress={() => advance("like", current)}>
                <Feather name="thumbs-up" size={20} color={colors.pink} />
              </Pressable>
            </View>
          </>
        )}
      </View>

      <Modal visible={!!matchModal} animationType="fade" onRequestClose={() => setMatchModal(null)}>
        <LinearGradient
          colors={["#d199c4", "#a385ec", "#97b6ec"]}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.65, y: 1 }}
          style={styles.matchOverlay}
        >
          <Pressable style={styles.matchClose} onPress={() => setMatchModal(null)} hitSlop={8}>
            <Text style={styles.matchCloseText}>{"✕"}</Text>
          </Pressable>
          <View style={styles.matchMid}>
            <View style={styles.matchPhotos}>
              {myPhotoUrl ? (
                <Image source={{ uri: myPhotoUrl }} style={styles.matchPhoto} />
              ) : (
                <View style={[styles.matchPhoto, styles.matchPhotoPlaceholder]} />
              )}
              {matchModal?.profile.avatarUrl ? (
                <Image source={{ uri: matchModal.profile.avatarUrl }} style={[styles.matchPhoto, styles.matchPhotoOverlap]} />
              ) : (
                <View style={[styles.matchPhoto, styles.matchPhotoOverlap, styles.matchPhotoPlaceholder]} />
              )}
            </View>
            <Text style={styles.matchTitle}>{t("catalog.matched.title")}</Text>
            <Text style={styles.matchHeadline}>{t("catalog.matched.headline")}</Text>
            <View style={styles.matchActions}>
              <Pressable
                style={[styles.matchBtn, styles.matchBtnPrimary]}
                onPress={() => {
                  const modal = matchModal;
                  setMatchModal(null);
                  if (modal?.conversationId) {
                    rootNav.navigate("Chat", { conversationId: modal.conversationId, title: modal.profile.displayName });
                  }
                }}
              >
                <Text style={styles.matchBtnPrimaryText}>{t("catalog.matched.sendMessage")}</Text>
              </Pressable>
              <Pressable style={[styles.matchBtn, styles.matchBtnSecondary]} onPress={() => setMatchModal(null)}>
                <Text style={styles.matchBtnSecondaryText}>{t("catalog.matched.backToBrowsing")}</Text>
              </Pressable>
            </View>
          </View>
        </LinearGradient>
      </Modal>
    </View>
    </GradientBackground>
  );
}

function SwipeCard({
  profile,
  isTop,
  onSwiped,
  onOpenProfile,
}: {
  profile: CatalogProfile;
  isTop: boolean;
  onSwiped?: (direction: "like" | "pass") => void;
  onOpenProfile?: () => void;
}) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  // A failed image load (broken/expired photo URL, or a network hiccup)
  // otherwise left the whole card blank - Image renders nothing and the
  // photoUrl-is-truthy check never falls back to the placeholder. Reset
  // per profile.id since this component gets re-keyed per card.
  const [photoFailed, setPhotoFailed] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  const photos = profile.photos?.length ? profile.photos : profile.avatarUrl ? [profile.avatarUrl] : [];
  const photoUrl = photos[photoIndex] || photos[0] || null;

  function showPrevPhoto() {
    setPhotoIndex((i) => (i - 1 + photos.length) % photos.length);
  }
  function showNextPhoto() {
    setPhotoIndex((i) => (i + 1) % photos.length);
  }
  // UPDATE (Sept 2026): profile.profileType/donorType are raw backend enum
  // values (e.g. "SINGLE_MAN") - rendering them directly showed the raw
  // token on the swipe card badge, a bug Alena reported. Ported the
  // website's label lookup (data/catalogLabels.ts) so this shows "Single
  // Man" / "Sperm Donor" like the prototype, instead of the raw enum.
  // Alena's reference (a real app screenshot she sent, not the earlier
  // single-file prototype): profileType AND donorType each get their own
  // pink pill, stacked top-right ("Single Man" / "\ud83e\uddec Sperm Donor"),
  // not one badge picking whichever is present.
  const profileTypeBadge = useMemo(
    () => (profile.profileType ? catalogOptionLabel("profileTypes", profile.profileType) : null),
    [profile.profileType],
  );
  const donorTypeBadge = useMemo(
    () => (profile.donorType?.[0] ? "\ud83e\uddec " + catalogOptionLabel("donorTypes", profile.donorType[0]) : null),
    [profile.donorType],
  );
  const location = [profile.city, profile.country].filter(Boolean).join(", ");

  function finishSwipe(direction: "like" | "pass") {
    onSwiped?.(direction);
  }

  const panGesture = Gesture.Pan()
    .enabled(isTop)
    .onUpdate((e: GestureUpdateEvent<PanGestureHandlerEventPayload>) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e: GestureStateChangeEvent<PanGestureHandlerEventPayload>) => {
      if (e.translationX > SWIPE_THRESHOLD) {
        translateX.value = withTiming(SWIPE_OUT_DISTANCE, { duration: 220 });
        runOnJS(finishSwipe)("like");
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-SWIPE_OUT_DISTANCE, { duration: 220 });
        runOnJS(finishSwipe)("pass");
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${translateX.value / 20}deg` },
    ],
  }));

  const likeStampStyle = useAnimatedStyle(() => ({
    opacity: translateX.value > 20 ? Math.min(translateX.value / SWIPE_THRESHOLD, 1) : 0,
  }));
  const passStampStyle = useAnimatedStyle(() => ({
    opacity: translateX.value < -20 ? Math.min(-translateX.value / SWIPE_THRESHOLD, 1) : 0,
  }));

  // Redesigned (Sept 2026) against Alena's side-by-side reference (her own
  // approved prototype vs. the app): the photo used to fill the ENTIRE
  // card, with name/location/looking-for text overlaid on a bottom scrim
  // AND a separate, independently-positioned 4-button row floating a fixed
  // distance up from the *screen* bottom (styles.actionsRow, position:
  // absolute/bottom: spacing.lg + tabBarClearance). Those two floating
  // layers had no relationship to each other, so whenever the scrim's
  // content grew tall enough (e.g. a profile with a "Looking for" chip),
  // the actions row landed right on top of the name/looking-for text -
  // exactly what her screenshot showed ("Ro..Red," half-hidden behind the
  // X button, "Looking for" text behind the button row). The reference
  // design instead gives the photo a fixed portion of the card (flex:1
  // inside photoWrap) and puts name/location/looking-for/buttons in a real
  // panel BELOW it (infoPanel) that sizes to its own content - nothing can
  // overlap because everything is normal flex flow now, not independently
  // floating absolute layers. Message/like also moved from generic emoji
  // (💬/👍) to real Feather icons, matching LikesScreen's row buttons.
  const cardInner = (
    <Animated.View style={[styles.card, isTop ? cardStyle : styles.cardUnder]}>
      <View style={styles.photoWrap}>
        {photoUrl && !photoFailed ? (
          <Image source={{ uri: photoUrl }} style={styles.cardPhoto} onError={() => setPhotoFailed(true)} />
        ) : (
          // Was a bare tinted box with just a big initial letter - on a
          // profile with a missing/failed photo this read as a blank,
          // broken-looking card (Alena: "вот как у тебя", showing a swipe
          // card that looked entirely empty). Made the no-photo state look
          // deliberate: a real icon plus explicit copy, so it's obviously
          // "this profile has no photo yet" rather than something failing to
          // render.
          <View style={[styles.cardPhoto, styles.cardPhotoPlaceholder]}>
            <Feather name="user" size={64} color={colors.blue} />
            <Text style={styles.cardPhotoPlaceholderName}>{profile.displayName || t("catalog.noPhotoFallbackName")}</Text>
            <Text style={styles.cardPhotoPlaceholderText}>{t("catalog.noPhoto")}</Text>
          </View>
        )}

        {isTop ? (
          <>
            <Animated.View style={[styles.stamp, styles.stampLike, likeStampStyle]}>
              <Text style={styles.stampLikeText}>{t("catalog.stampLike")}</Text>
            </Animated.View>
            <Animated.View style={[styles.stamp, styles.stampPass, passStampStyle]}>
              <Text style={styles.stampPassText}>{t("catalog.stampPass")}</Text>
            </Animated.View>
          </>
        ) : null}

        {profileTypeBadge || donorTypeBadge ? (
          <View style={styles.badgeRow}>
            {profileTypeBadge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{profileTypeBadge}</Text>
              </View>
            ) : null}
            {donorTypeBadge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{donorTypeBadge}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Alena's reference: name/location/looking-for sit directly on
            the photo, over a dark gradient scrim fading up from the
            bottom edge - not in a separate solid-color panel underneath
            (her "почему чёрная заливка" report on the earlier version).
            Buttons stay out of this area entirely (CatalogScreen's own
            actionsRow, below the whole card - see the comment there), so
            nothing here can collide with them the way the very first pass
            did. */}
        <LinearGradient
          colors={["transparent", "rgba(10,4,10,0.55)", "rgba(10,4,10,0.92)"]}
          locations={[0, 0.55, 1]}
          style={styles.photoScrim}
          pointerEvents="none"
        />

        <Pressable style={styles.overlayInfo} onPress={onOpenProfile} disabled={!isTop}>
          <View style={styles.nameRow}>
            <Text style={styles.cardName} numberOfLines={1}>
              {profile.displayName}
              {profile.age ? `, ${profile.age}` : ""}
            </Text>
            {profile.isVerified ? (
              <View style={styles.verifiedBadge}>
                <Feather name="check" size={11} color="#fff" />
              </View>
            ) : null}
          </View>
          {location ? (
            <Text style={styles.cardLoc} numberOfLines={1}>
              {"📍 " + location}
            </Text>
          ) : null}

          {profile.lookingFor?.length ? (
            <View style={styles.lookingForBlock}>
              <Text style={styles.cardLookingForLabel}>{t("catalog.lookingForLabel")}</Text>
              <View style={styles.lookingForChip}>
                <Text style={styles.lookingForChipText} numberOfLines={1}>
                  {profile.lookingFor.map((value) => catalogOptionLabel("lookingFor", value)).join(", ")}
                </Text>
              </View>
            </View>
          ) : null}

          {photos.length > 1 ? (
            <View style={styles.carouselRow}>
              <Pressable hitSlop={10} onPress={showPrevPhoto} disabled={!isTop}>
                <Feather name="chevron-left" size={18} color="#fff" />
              </Pressable>
              <View style={styles.dotsRow}>
                {photos.map((_, i) => (
                  <View key={i} style={[styles.dot, i === photoIndex && styles.dotActive]} />
                ))}
              </View>
              <Pressable hitSlop={10} onPress={showNextPhoto} disabled={!isTop}>
                <Feather name="chevron-right" size={18} color="#fff" />
              </Pressable>
            </View>
          ) : null}
        </Pressable>

        {/* Reference mockup's double-chevron expand affordance, centered
            over the card's bottom edge. */}
        {isTop && onOpenProfile ? (
          <Pressable style={styles.expandBtn} onPress={onOpenProfile} hitSlop={8}>
            <Feather name="chevrons-down" size={16} color="#fff" />
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );

  if (!isTop) return cardInner;

  return <GestureDetector gesture={panGesture}>{cardInner}</GestureDetector>;
}

// The expanded, in-place version of the top card - same photo/name/
// location/looking-for header as SwipeCard, but not swipeable, and with
// the full profile detail (ProfileDetailSections - the same component
// ProfileDetailScreen uses) scrolling in underneath instead of the card
// linking out to a separate screen. Fetches its own detail blob on demand
// (CatalogProfile from the deck list is only a summary - no
// occupation/religion/education/etc - see api/catalog.ts's
// fetchCatalogProfileDetail) since expansion is rare enough that
// prefetching it for every card in the deck would be wasteful.
function ExpandedProfileCard({
  profile,
  detail,
  loading,
  error,
  onCollapse,
}: {
  profile: CatalogProfile;
  detail: ProfileDetailData | null;
  loading: boolean;
  error: string | null;
  onCollapse: () => void;
}) {
  const { t } = useI18n();
  const photos = profile.photos?.length ? profile.photos : profile.avatarUrl ? [profile.avatarUrl] : [];
  const photoUrl = photos[0] || null;
  const location = [profile.city, profile.country].filter(Boolean).join(", ");
  const badgeLabel = profile.profileType
    ? catalogOptionLabel("profileTypes", profile.profileType)
    : profile.donorType?.[0]
    ? catalogOptionLabel("donorTypes", profile.donorType[0])
    : null;

  return (
    <View style={styles.card}>
      <ScrollView style={styles.expandedScroll} contentContainerStyle={styles.expandedScrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.expandedPhotoWrap}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.cardPhoto} />
          ) : (
            <View style={[styles.cardPhoto, styles.cardPhotoPlaceholder]}>
              <Feather name="user" size={64} color={colors.blue} />
            </View>
          )}
          {badgeLabel ? (
            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badgeLabel}</Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.infoPanel}>
          <View style={styles.nameRow}>
            <Text style={styles.cardName} numberOfLines={1}>{profile.displayName}</Text>
            {profile.isVerified ? (
              <View style={styles.verifiedBadge}>
                <Feather name="check" size={11} color="#fff" />
              </View>
            ) : null}
          </View>
          {location ? <Text style={styles.cardLoc} numberOfLines={1}>{"\ud83d\udccd " + location}</Text> : null}

          {profile.lookingFor?.length ? (
            <View style={styles.lookingForBlock}>
              <Text style={styles.cardLookingForLabel}>{t("catalog.lookingForLabel")}</Text>
              <View style={styles.lookingForChip}>
                <Text style={styles.lookingForChipText} numberOfLines={1}>
                  {profile.lookingFor.map((value) => catalogOptionLabel("lookingFor", value)).join(", ")}
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        <Pressable style={styles.collapseBtn} onPress={onCollapse} hitSlop={8}>
          <Feather name="chevron-down" size={16} color="#fff" />
        </Pressable>

        {loading ? (
          <View style={styles.expandedLoading}>
            <ActivityIndicator size="small" color={colors.blue} />
          </View>
        ) : error ? (
          <View style={styles.expandedLoading}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : detail ? (
          <ProfileDetailSections profile={detail} />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  headerBrand: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerLogo: { width: 24, height: 24 },
  headerTitle: { fontSize: 15, fontWeight: "600", color: colors.ink },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatarButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#020817",
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  avatarButtonText: { fontSize: 16 },
  // Same gradient-initial avatar AppHeader uses elsewhere - Alena's
  // "Browse profiles" reference has the same right-side avatar shape here.
  profileAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  profileAvatarText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  actionErrorBanner: { marginHorizontal: spacing.md, marginBottom: spacing.xs, backgroundColor: colors.tintPink, borderRadius: radius.md, padding: spacing.sm },
  actionErrorText: { color: colors.pink, fontSize: 12.5, fontWeight: "600", textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.md },
  errorText: { color: colors.danger, textAlign: "center" },
  emptyText: { color: colors.textMuted, textAlign: "center" },
  retryButton: {
    backgroundColor: colors.pink,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  retryButtonText: { color: colors.white, fontWeight: "700" },
  deck: { flex: 1, padding: spacing.md, paddingBottom: spacing.md },
  // Real flex sibling of `actionsRow` below (see the big comment on that
  // JSX block) - just a normal flex:1 box so `card`'s absolute-fill covers
  // exactly this area and nothing else, with the button row sized to its
  // own content right underneath in normal layout flow.
  cardArea: { flex: 1, position: "relative", marginBottom: spacing.sm },
  card: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: colors.border,
    flexDirection: "column",
  },
  cardUnder: { transform: [{ scale: 0.96 }], top: 10 },
  // Reference mockup: the photo is a fixed portion of the card (roughly
  // 60-65%), not the whole thing - photoWrap's flex:1 against infoPanel's
  // natural content height below it gives that split automatically,
  // whatever the info panel ends up containing (looking-for chip present
  // or not, one photo or several).
  photoWrap: { flex: 1, position: "relative" },
  cardPhoto: StyleSheet.absoluteFill,
  cardPhotoPlaceholder: { alignItems: "center", justifyContent: "center", backgroundColor: colors.tint, gap: 6 },
  cardPhotoPlaceholderName: { fontSize: 18, fontWeight: "700", color: colors.ink, marginTop: 10 },
  cardPhotoPlaceholderText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  // Stacked top-right, per Alena's reference ("Cal, 29" etc) - two
  // pills (profile type + donor type) right-aligned and stacked, not
  // side by side top-left like the first redesign pass.
  badgeRow: { position: "absolute", top: spacing.md, right: spacing.md, alignItems: "flex-end", gap: 6 },
  badge: { backgroundColor: colors.pink, paddingHorizontal: 13, paddingVertical: 6, borderRadius: radius.pill },
  badgeText: { color: "#fff", fontSize: 11.5, fontWeight: "700" },
  // Was borderWidth-only with no fill - a hollow box with a colored
  // border/text and nothing behind it reads fine over a dark photo, but
  // over a light photo (or the white/light area of most photos - sky,
  // skin, a light shirt) the white-bordered/white-text "PASS" stamp in
  // particular all but disappears, which is very likely what Alena's
  // "не появилось ... иконки лайка и крестика" was actually seeing during
  // a swipe rather than the opacity animation itself being broken. A
  // translucent dark backing box guarantees contrast for both stamps
  // regardless of what's behind them.
  stamp: {
    position: "absolute",
    top: 28,
    borderWidth: 3,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: "rgba(15,15,20,0.45)",
    zIndex: 5,
  },
  stampLike: { right: 20, borderColor: colors.blue, transform: [{ rotate: "12deg" }] },
  stampLikeText: { color: colors.blue, fontSize: 22, fontWeight: "800" },
  stampPass: { left: 20, borderColor: "#fff", transform: [{ rotate: "-12deg" }] },
  stampPassText: { color: "#fff", fontSize: 22, fontWeight: "800" },
  // Dark gradient fading up from the photo's bottom edge, so the
  // overlaid name/location/looking-for text stays readable without a
  // separate solid-color panel underneath (Alena's "почему чёрная
  // заливка" complaint about the earlier design).
  photoScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "62%" },
  // All of the card's text content, floating directly over the photo/
  // scrim instead of a panel below it. Bottom offset clears expandBtn.
  overlayInfo: { position: "absolute", left: spacing.md, right: spacing.md, bottom: 34 },
  // Carousel dots moved onto the photo itself (bottom edge, over a subtle
  // scrim-free area) since the name/location panel below no longer shares
  // space with the photo.
  carouselRow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  dotsRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.5)" },
  dotActive: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: "#fff" },
  // The 4-button pass/info/message/like row, below cardArea - white circles
  // with dark icons (pink for the "like" thumbs-up) floating directly on
  // the screen's own gradient background, per Alena's reference screenshot
  // - not on a white sheet, and not small circles pinned to the photo.
  actionsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-evenly" },
  actionBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#020817",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  // Same white circle as the others (the reference screenshot's "like"
  // button is a white circle with a pink icon, not a filled pink circle) -
  // kept as its own key in case that changes again rather than hardcoding
  // one style for all four.
  actionBtnFilled: {},
  // Small grey "^^" pill - the reference mockup's expand/collapse
  // affordance, straddling the card's bottom edge (collapsed, over the
  // photo) or sitting just under the header info (expanded, over the white
  // detail panel) - one visual so it reads as the same control in both
  // states.
  expandBtn: {
    position: "absolute",
    bottom: 8,
    alignSelf: "center",
    width: 36,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#9ca3af",
    alignItems: "center",
    justifyContent: "center",
  },
  collapseBtn: {
    alignSelf: "center",
    marginTop: -14,
    marginBottom: 8,
    width: 36,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#9ca3af",
    alignItems: "center",
    justifyContent: "center",
  },
  // The info panel that replaced the old photo-overlay scrim - real flex
  // flow below photoWrap, sized to its own content instead of floating.
  infoPanel: {
    backgroundColor: colors.ink,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  infoTopRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  infoNameCol: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  verifiedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  cardName: { fontSize: 20, fontWeight: "700", color: "#fff" },
  cardLoc: { fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 2 },
  lookingForBlock: { marginTop: 12 },
  cardLookingForLabel: { fontSize: 12.5, fontWeight: "600", color: "rgba(255,255,255,0.9)", marginBottom: 6 },
  lookingForChip: {
    alignSelf: "flex-start",
    borderWidth: 1.3,
    borderColor: "rgba(255,255,255,0.6)",
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  lookingForChipText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  expandedScroll: { flex: 1 },
  expandedScrollContent: { flexGrow: 1 },
  expandedPhotoWrap: { height: 300, position: "relative" },
  expandedLoading: { paddingVertical: spacing.xl, alignItems: "center", justifyContent: "center" },
  // "It's a Match!" overlay (#scr-matched) - exact prototype values: vivid
  // gradient background, two 110px overlapping circular photos, "Wow!
  // Congrats!" / "You're a Match!" copy, pill primary/secondary buttons.
  matchOverlay: { flex: 1 },
  matchClose: {
    position: "absolute",
    top: 56,
    right: spacing.lg,
    zIndex: 2,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  matchCloseText: { color: "#fff", fontSize: 20 },
  matchMid: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  matchPhotos: { flexDirection: "row", marginBottom: 28 },
  matchPhoto: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 4,
    borderColor: "#fff",
    backgroundColor: colors.border,
    shadowColor: "#020817",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  matchPhotoOverlap: { marginLeft: -26 },
  matchPhotoPlaceholder: { backgroundColor: "rgba(255,255,255,0.35)" },
  matchTitle: { fontSize: 15, fontWeight: "400", color: "#fff", opacity: 0.9, textAlign: "center" },
  matchHeadline: { fontSize: 26, fontWeight: "700", color: "#fff", textAlign: "center", marginTop: 4 },
  matchActions: { width: "100%", marginTop: spacing.xl, gap: 10 },
  matchBtn: { height: 52, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  matchBtnPrimary: { backgroundColor: colors.pink },
  matchBtnPrimaryText: { color: "#fff", fontSize: 14.5, fontWeight: "700" },
  matchBtnSecondary: { backgroundColor: "rgba(255,255,255,0.9)" },
  matchBtnSecondaryText: { color: colors.ink, fontSize: 14.5, fontWeight: "700" },
});
