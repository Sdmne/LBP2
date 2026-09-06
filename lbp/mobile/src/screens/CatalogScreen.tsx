import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
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
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { fetchCatalog, likeProfile } from "../api/catalog";
import { createConversation } from "../api/messages";
import { ApiError } from "../api/client";
import type { CatalogProfile } from "../api/types";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import type { MainTabsParamList } from "../navigation/MainTabs";
import type { RootStackParamList } from "../navigation/RootNavigator";

const PAGE_SIZE = 24;
// Start pulling the next page once this many cards are left in the deck,
// so the person (hopefully) never actually hits the end mid-swipe.
const REFILL_THRESHOLD = 5;
const SWIPE_OUT_DISTANCE = 500;
const SWIPE_THRESHOLD = 120;

type Props = BottomTabScreenProps<MainTabsParamList, "Catalog">;

// Rebuilt as a swipeable card stack (Tinder-style) to match the real,
// current supplied design prototype (app-prototype-inline.html,
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
export default function CatalogScreen({ navigation }: Props) {
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useI18n();
  const [profiles, setProfiles] = useState<CatalogProfile[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const requestSeqRef = useRef(0);

  const load = useCallback(async () => {
    setError(null);
    const seq = ++requestSeqRef.current;
    try {
      const res = await fetchCatalog(0, PAGE_SIZE);
      if (seq !== requestSeqRef.current) return;
      setProfiles(res.items.filter((p) => !p.likedByViewer));
      setIndex(0);
      setTotal(res.total);
    } catch (err) {
      if (seq !== requestSeqRef.current) return;
      setError(err instanceof ApiError ? err.message : t("catalog.loadError"));
    }
  }, [t]);

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
      const res = await fetchCatalog(profiles.length, PAGE_SIZE);
      if (seq !== requestSeqRef.current) return;
      setProfiles((prev) => [...prev, ...res.items.filter((p) => !p.likedByViewer)]);
      setTotal(res.total);
    } catch {
      // Silent - the deck just runs dry and shows the empty state; pull to
      // reload (via the retry button there) tries again.
    } finally {
      if (seq === requestSeqRef.current) setLoadingMore(false);
    }
  }, [loadingMore, total, profiles.length]);

  useEffect(() => {
    if (profiles.length - index <= REFILL_THRESHOLD) {
      void loadMore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, profiles.length]);

  const current = profiles[index];
  const next = profiles[index + 1];

  async function advance(direction: "like" | "pass", profile: CatalogProfile) {
    setIndex((i) => i + 1);
    if (direction === "like") {
      try {
        await likeProfile(profile.id);
      } catch {
        // Best-effort - the person has already moved on visually, and
        // there's no "undo" gesture in this design to revert to anyway.
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
      } else {
        setActionError(t("common.somethingWrong"));
      }
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.pink} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={() => load()}>
          <Text style={styles.retryButtonText}>{t("common.tryAgain")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("catalog.browseTitle")}</Text>
        <Pressable
          hitSlop={8}
          style={styles.avatarButton}
          onPress={() => navigation.navigate("Me")}
        >
          <Text style={styles.avatarButtonText}>{"👤"}</Text>
        </Pressable>
      </View>

      {actionError ? (
        <Pressable style={styles.actionErrorBanner} onPress={() => setActionError(null)}>
          <Text style={styles.actionErrorText}>{actionError}</Text>
        </Pressable>
      ) : null}

      <View style={styles.deck}>
        {!current ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>{t("catalog.empty")}</Text>
            <Pressable style={styles.retryButton} onPress={() => load()}>
              <Text style={styles.retryButtonText}>{t("common.tryAgain")}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {next ? <SwipeCard key={`under-${next.id}`} profile={next} isTop={false} /> : null}
            <SwipeCard
              key={`top-${current.id}`}
              profile={current}
              isTop
              onSwiped={(direction) => advance(direction, current)}
              onOpenProfile={() => rootNav.navigate("ProfileDetail", { profileId: current.id })}
              onMessage={() => handleMessage(current)}
            />
          </>
        )}
      </View>
    </View>
  );
}

function SwipeCard({
  profile,
  isTop,
  onSwiped,
  onOpenProfile,
  onMessage,
}: {
  profile: CatalogProfile;
  isTop: boolean;
  onSwiped?: (direction: "like" | "pass") => void;
  onOpenProfile?: () => void;
  onMessage?: () => void;
}) {
  const { t } = useI18n();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const photoUrl = profile.photos?.[0] || profile.avatarUrl || null;
  const badgeLabel = useMemo(() => profile.profileType || profile.donorType?.[0] || null, [profile]);
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

  const cardInner = (
    <Animated.View style={[styles.card, isTop ? cardStyle : styles.cardUnder]}>
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={styles.cardPhoto} />
      ) : (
        <View style={[styles.cardPhoto, styles.cardPhotoPlaceholder]}>
          <Text style={styles.cardPhotoPlaceholderText}>{profile.displayName?.[0] ?? "?"}</Text>
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

      {badgeLabel ? (
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeLabel}</Text>
          </View>
        </View>
      ) : null}

      <LinearGradient colors={["transparent", "rgba(8,6,20,0.55)", "rgba(8,6,20,0.85)"]} style={styles.scrim}>
        <Pressable onPress={onOpenProfile} disabled={!isTop}>
          <Text style={styles.cardName}>
            {profile.displayName}
            {profile.age ? `, ${profile.age}` : ""}
            {profile.isVerified ? " ✔" : ""}
          </Text>
          {location ? <Text style={styles.cardLoc}>{"📍 " + location}</Text> : null}
          {profile.lookingFor?.length ? (
            <Text style={styles.cardLookingFor} numberOfLines={1}>
              {t("catalog.lookingFor")} <Text style={styles.cardLookingForValue}>{profile.lookingFor.join(", ")}</Text>
            </Text>
          ) : null}
        </Pressable>
      </LinearGradient>
    </Animated.View>
  );

  if (!isTop) return cardInner;

  return (
    <GestureDetector gesture={panGesture}>
      <View style={StyleSheet.absoluteFill}>
        {cardInner}
        <View style={styles.actionsRow}>
          <Pressable style={styles.actionBtn} onPress={() => finishSwipe("pass")}>
            <Text style={styles.actionBtnIcon}>{"✕"}</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={onOpenProfile}>
            <Text style={styles.actionBtnIcon}>{"👤"}</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={onMessage}>
            <Text style={styles.actionBtnIcon}>{"💬"}</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.actionBtnFilled]} onPress={() => finishSwipe("like")}>
            <Text style={[styles.actionBtnIcon, styles.actionBtnIconFilled]}>{"👍"}</Text>
          </Pressable>
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  headerTitle: { fontSize: 15, fontWeight: "600", color: colors.ink },
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
  card: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: colors.border,
  },
  cardUnder: { transform: [{ scale: 0.96 }], top: 10 },
  cardPhoto: { width: "100%", height: "100%" },
  cardPhotoPlaceholder: { alignItems: "center", justifyContent: "center", backgroundColor: colors.tint },
  cardPhotoPlaceholderText: { fontSize: 56, fontWeight: "800", color: colors.blue },
  badgeRow: { position: "absolute", top: spacing.md, left: spacing.md },
  badge: { backgroundColor: colors.pink, paddingHorizontal: 13, paddingVertical: 6, borderRadius: radius.pill },
  badgeText: { color: "#fff", fontSize: 11.5, fontWeight: "700" },
  stamp: {
    position: "absolute",
    top: 28,
    borderWidth: 3,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    zIndex: 5,
  },
  stampLike: { right: 20, borderColor: colors.blue, transform: [{ rotate: "12deg" }] },
  stampLikeText: { color: colors.blue, fontSize: 22, fontWeight: "800" },
  stampPass: { left: 20, borderColor: "#fff", transform: [{ rotate: "-12deg" }] },
  stampPassText: { color: "#fff", fontSize: 22, fontWeight: "800" },
  scrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  cardName: { fontSize: 20, fontWeight: "400", color: "#fff" },
  cardLoc: { fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 2 },
  cardLookingFor: { fontSize: 12.5, fontWeight: "600", color: "rgba(255,255,255,0.9)", marginTop: 12 },
  cardLookingForValue: { color: "#fff", fontWeight: "700" },
  actionsRow: {
    position: "absolute",
    bottom: spacing.lg,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.md,
  },
  actionBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#020817",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  actionBtnFilled: { backgroundColor: colors.blue },
  actionBtnIcon: { fontSize: 20 },
  actionBtnIconFilled: {},
});
