import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { api, ApiError } from "../api/client";
import { blockProfile } from "../api/blocks";
import { likeProfile, unlikeProfile } from "../api/catalog";
import { createConversation } from "../api/messages";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GradientBackground from "../components/GradientBackground";
import ProfileDetailSections from "../components/ProfileDetailSections";
import { catalogOptionLabel } from "../data/catalogLabels";
import type { ProfileDetailData } from "../utils/profileFields";
import { Feather } from "@expo/vector-icons";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "ProfileDetail">;

// Fixed bottom pill bar's own real rendered height (see bottomBar/pillBtn
// styles below): pillBtn height (52) + bottomBar's paddingTop (spacing.sm)
// + bottomBar's own paddingBottom (spacing.sm, BEFORE insets.bottom - that
// part is added separately wherever this constant is used, since
// bottomBar adds insets.bottom to its paddingBottom too). Kept as one
// named constant instead of a bare number so the ScrollView's own bottom
// padding can never drift out of sync with the bar again - see that
// paddingBottom's own comment for the bug this caused when it did.
const BOTTOM_BAR_RESERVED_HEIGHT = 52 + spacing.sm + spacing.sm;

// GET /api/member/catalog/{id} - member_catalog_detail() in main.py, wraps
// public_profile_summary() (see the comment there): a stable set of top
// level fields (id, displayName, city, country, avatarUrl, isVerified,
// isPremium, likedByViewer...) plus a `data` object holding whatever else is
// in that profile's own JSON blob (bio/about text, questionnaire answers,
// etc.) - its exact keys aren't enumerated anywhere in the backend. The
// field-reading helpers and the actual detail-sections rendering both now
// live in utils/profileFields.ts + components/ProfileDetailSections.tsx,
// shared with CatalogScreen's inline profile expansion.
type ProfileDetail = ProfileDetailData;

// UPDATE (Sept 2026): redesigned against Alena's reference screenshot of
// the prototype's #scr-profile-detail bottom bar - two big pill buttons
// (blue "Send message" / pink "Like" or "Already liked"), fixed to the
// bottom of the screen, not the four small text-link buttons this used to
// have inline in the scroll flow. Report/Block/Family Room/Compatibility
// Report moved into a "..." header menu (same bottom-sheet pattern
// ChatScreen already uses for its own Report/Block/Delete menu) so they're
// still reachable without cluttering the bottom bar.
export default function ProfileDetailScreen({ route, navigation }: Props) {
  const { profileId } = route.params;
  const { t } = useI18n();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  // MeProfileScreen's new "Preview my profile" row opens this same screen
  // with the viewer's own profileId - member_catalog_detail() on the
  // backend already special-cases viewer_profile_id === target_profile_id
  // (Alena: "как можно сделать чтобы просмотреть как выглядит моя анкета
  // после изменений"). Messaging/liking/report/block only make sense
  // against someone else, so those are hidden in this mode rather than
  // left active against your own profile.
  const isSelf = !!user?.profileId && user.profileId === profileId;
  const [profile, setProfile] = useState<ProfileDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blocking, setBlocking] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [liking, setLiking] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  // Alena: "если нет фото может какую-то заставки сделаем?" - noticed on
  // a profile whose avatarUrl pointed at a broken/missing image: the
  // photos.length > 0 branch below was already taken (avatarUrl is a
  // non-empty string), so the "no photo at all" placeholder further down
  // never rendered - <Image> just silently failed to load, leaving only
  // its own backgroundColor (colors.border) visible: a plain grey box,
  // no icon, exactly what she flagged. Tracked per-index so a multi-photo
  // profile with one bad URL still shows its other real photos normally,
  // only swapping the placeholder in for the specific one that failed.
  const [failedPhotoIndices, setFailedPhotoIndices] = useState<Record<number, boolean>>({});

  useEffect(() => {
    api
      .get<{ profile: ProfileDetail } | ProfileDetail>(`/api/member/catalog/${profileId}`)
      .then((res) => setProfile("profile" in res ? res.profile : res))
      .catch((err) => setError(err instanceof ApiError ? err.message : t("profileDetail.loadError")));
  }, [profileId, t]);

  // UPDATE (Sept 2026): Alena's video - "Не видно что написано внизу про
  // заблокировать и тд" (the "..." menu's Block row showed only a bare
  // spinner, no icon/text). Root cause: React Navigation can reuse this
  // SAME screen instance when navigating from one profile straight to
  // another (rather than always mounting a fresh one) - `profileId`
  // changes and the effect above refetches, but per-visit interaction
  // state (blocking/messaging/liking/menuVisible/failedPhotoIndices) was
  // never reset, so a Block request still in flight (or a menu left open)
  // against the PREVIOUS profile leaked into this one. `blocking` stuck
  // `true` on a fresh profile view is exactly "Block row renders only its
  // ActivityIndicator, no text" - see the JSX below, which only shows the
  // icon+label pair when `!blocking`.
  useEffect(() => {
    setBlocking(false);
    setMessaging(false);
    setLiking(false);
    setMenuVisible(false);
    setFailedPhotoIndices({});
  }, [profileId]);

  useEffect(() => {
    if (isSelf) return;
    navigation.setOptions({
      headerRight: () => (
        <Pressable hitSlop={10} style={styles.headerMenuBtn} onPress={() => setMenuVisible(true)}>
          <Feather name="more-vertical" size={22} color={colors.ink} />
        </Pressable>
      ),
    });
  }, [navigation, isSelf]);

  // Same endpoint the website's catalog profile page uses for its "Message"
  // action (POST /api/member/conversations) - see member_create_conversation
  // in main.py. It can 402/429 for an unmatched "cold" chat, or 403 if the
  // viewer isn't verified yet; ApiError.message (the response body text)
  // already carries the backend's specific reason, same as handleBlock below.
  async function handleMessage() {
    if (!profile || messaging) return;
    setMessaging(true);
    try {
      const res = await createConversation(profile.id);
      navigation.navigate("Chat", {
        conversationId: res.conversationId,
        title: profile.displayName || t("messages.chatTitleFallback"),
      });
    } catch (err) {
      const detail =
        err instanceof ApiError && err.status === 403
          ? t("profileDetail.needsVerification")
          : err instanceof ApiError
          ? err.message
          : t("common.pleaseTryAgain");
      Alert.alert(t("profileDetail.messageError"), detail);
    } finally {
      setMessaging(false);
    }
  }

  // Optimistic like/unlike, mirroring CatalogScreen's toggleLike against the
  // same POST/DELETE /api/member/likes/{id} pair.
  async function toggleLike() {
    if (!profile || liking) return;
    const wasLiked = !!profile.likedByViewer;
    setLiking(true);
    setProfile((p) => (p ? { ...p, likedByViewer: !wasLiked } : p));
    try {
      if (wasLiked) await unlikeProfile(profile.id);
      else await likeProfile(profile.id);
    } catch (err) {
      setProfile((p) => (p ? { ...p, likedByViewer: wasLiked } : p));
      // Was failing completely silently - the heart just snapped back with
      // no explanation, which reads as "the like button doesn't work" when
      // really it's usually a 403 (not verified yet) or 429 (daily limit).
      const detail =
        err instanceof ApiError && err.status === 403
          ? t("profileDetail.needsVerification")
          : err instanceof ApiError
          ? err.message
          : t("common.pleaseTryAgain");
      Alert.alert(t("profileDetail.likeError"), detail);
    } finally {
      setLiking(false);
    }
  }

  function handleReport() {
    if (!profile) return;
    setMenuVisible(false);
    navigation.navigate("ReportProfile", { profileId: profile.id, displayName: profile.displayName });
  }

  function handleBlock() {
    if (!profile) return;
    setMenuVisible(false);
    Alert.alert(t("profileDetail.blockConfirmTitle"), t("profileDetail.blockConfirmBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("profileDetail.blockConfirm"),
        style: "destructive",
        onPress: async () => {
          setBlocking(true);
          try {
            await blockProfile(profile.id);
            navigation.goBack();
          } catch (err) {
            Alert.alert(t("profileDetail.blockError"), err instanceof ApiError ? err.message : t("common.pleaseTryAgain"));
          } finally {
            setBlocking(false);
          }
        },
      },
    ]);
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.gradientStart} />
      </View>
    );
  }

  const photos = profile.photos?.length ? profile.photos : profile.avatarUrl ? [profile.avatarUrl] : [];

  return (
    <GradientBackground variant="vivid">
      {/* BOTTOM_BAR_RESERVED_HEIGHT below must track bottomBar's own real
          rendered height (pillBtn's 52 + its own paddingTop/paddingBottom,
          both spacing.sm) - insets.bottom is added separately below since
          bottomBar already adds it to its own paddingBottom too. This was
          previously a bare "92" that had drifted out of sync with
          bottomBar's actual height, leaving a gap of empty transparent
          ScrollView content below the last card row and above the fixed
          bar - which, sitting directly on GradientBackground's vivid
          gradient, read as a solid lilac/purple stripe (Alena: "внизу
          живота фиолетовая полоса"). Same underlying bug shape as the
          "без сиреневого" fix above this component (any unfilled gap over
          the vivid gradient reads as a stray purple block), just at the
          opposite end of the screen. */}
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: spacing.md + BOTTOM_BAR_RESERVED_HEIGHT + insets.bottom }]}
      >
        {/* Redesigned (2026-09-13) against Alena's Figma reference: name/
            location/badges now sit directly on the photo, over a dark
            gradient scrim fading up from its bottom edge, with the white
            detail card (ProfileDetailSections' rounded-top infoCard)
            following immediately after - no separate flat-color panel in
            between. Same scrim/overlay pattern CatalogScreen's card
            already uses (its own "почему чёрная заливка" fix). Previously
            this screen put name/location in a transparent `header` View
            that sat directly on GradientBackground's vivid gradient,
            which read as a solid lilac block between the photo and the
            white card - that's what Alena's "без сиреневого" flagged. */}
        <View style={styles.photoWrap}>
          {photos.length > 0 ? (
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
              {photos.map((url, i) =>
                failedPhotoIndices[i] ? (
                  <View key={i} style={[styles.photo, styles.photoPlaceholder]}>
                    <Feather name="user" size={56} color={colors.blue} />
                  </View>
                ) : (
                  <Image
                    key={i}
                    source={{ uri: url }}
                    style={styles.photo}
                    onError={() => setFailedPhotoIndices((prev) => ({ ...prev, [i]: true }))}
                  />
                ),
              )}
            </ScrollView>
          ) : (
            <View style={[styles.photo, styles.photoPlaceholder]}>
              <Feather name="user" size={56} color={colors.blue} />
            </View>
          )}

          <LinearGradient
            colors={["transparent", "rgba(10,4,10,0.55)", "rgba(10,4,10,0.92)"]}
            locations={[0, 0.55, 1]}
            style={styles.photoScrim}
            pointerEvents="none"
          />

          {isSelf ? (
            <View style={styles.previewBanner}>
              <Feather name="eye" size={14} color={colors.ink} />
              <Text style={styles.previewBannerText}>{t("profileDetail.previewBanner")}</Text>
            </View>
          ) : null}

          <View style={styles.overlayInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>{profile.displayName}</Text>
              {profile.isVerified ? (
                <View style={styles.verifiedBadge}>
                  <Feather name="check" size={11} color="#fff" />
                </View>
              ) : null}
              {profile.isVideoVerified ? (
                <View style={styles.videoVerifiedBadge}>
                  <Feather name="video" size={10} color="#fff" />
                </View>
              ) : null}
            </View>
            <Text style={styles.subtitle}>
              {[profile.city, profile.country].filter(Boolean).join(", ") || t("common.locationNotSet")}
            </Text>
            {profile.isPremium ? <Text style={styles.badge}>{t("profileDetail.premium")}</Text> : null}
            {profile.profileType ? (
              <View style={styles.typeBadgeRow}>
                <Text style={styles.typeBadge}>{catalogOptionLabel("profileTypes", profile.profileType)}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <ProfileDetailSections profile={profile} />

        {!isSelf ? (
          <View style={styles.familyLinksRow}>
            <Pressable
              style={styles.familyLink}
              onPress={() => navigation.navigate("FamilyRoom", { profileId: profile.id, displayName: profile.displayName })}
            >
              <Feather name="home" size={15} color={colors.ink} />
              <Text style={styles.familyLinkText}>{t("profileDetail.familyRoom")}</Text>
            </Pressable>
            <Pressable
              style={styles.familyLink}
              onPress={() => navigation.navigate("CompatibilityReport", { profileId: profile.id, displayName: profile.displayName })}
            >
              <Feather name="heart" size={15} color={colors.ink} />
              <Text style={styles.familyLinkText}>{t("profileDetail.compatibilityReport")}</Text>
            </Pressable>
            {/* Item 10 - Alena: "Pregnancy здесь не надо" - the standalone
                Pregnancy pill shouldn't show when viewing SOMEONE ELSE's
                profile (this whole row only ever renders for !isSelf - see
                above). Pregnancy Room itself is untouched and still free
                for everyone via its own entry point on FamilyRoomScreen
                (the "pregnancyCard" there) - only this second, redundant
                top-level pill is removed. */}
          </View>
        ) : null}
      </ScrollView>

      {!isSelf ? (
        <>
          {/* Fixed bottom pill bar (Alena's reference: blue "Send message" +
              pink "Like"/"Already liked", floating over the gradient, not
              scrolling with the content). */}
          <View style={[styles.bottomBar, { paddingBottom: spacing.sm + insets.bottom }]}>
            <Pressable style={[styles.pillBtn, styles.pillBtnBlue]} onPress={() => void handleMessage()} disabled={messaging}>
              {messaging ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="message-circle" size={18} color="#fff" />
                  <Text style={styles.pillBtnText}>{t("profileDetail.sendMessageBtn")}</Text>
                </>
              )}
            </Pressable>
            <Pressable style={[styles.pillBtn, styles.pillBtnPink]} onPress={() => void toggleLike()} disabled={liking}>
              {liking ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="thumbs-up" size={18} color="#fff" />
                  <Text style={styles.pillBtnText}>
                    {profile.likedByViewer ? t("profileDetail.likedBtn") : t("profileDetail.likeBtn")}
                  </Text>
                </>
              )}
            </Pressable>
          </View>

          <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
            <Pressable style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
              <View style={styles.menuSheet}>
                <View style={styles.menuHandle} />
                <Pressable style={styles.menuRow} onPress={handleReport}>
                  <Feather name="flag" size={18} color={colors.ink} />
                  <Text style={styles.menuRowText}>{t("profileDetail.report")}</Text>
                </Pressable>
                <Pressable style={styles.menuRow} onPress={handleBlock} disabled={blocking}>
                  {blocking ? (
                    <>
                      <ActivityIndicator color={colors.danger} />
                      <Text style={[styles.menuRowText, styles.menuRowTextDanger]}>{t("profileDetail.blocking")}</Text>
                    </>
                  ) : (
                    <>
                      <Feather name="slash" size={18} color={colors.danger} />
                      <Text style={[styles.menuRowText, styles.menuRowTextDanger]}>{t("profileDetail.block")}</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </Pressable>
          </Modal>
        </>
      ) : null}
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  errorText: { color: colors.danger },
  container: { paddingBottom: spacing.xl, backgroundColor: "transparent" },
  // photoWrap is the positioning root for the scrim + overlaid text below -
  // photo itself is unchanged (full-width, fixed height).
  photoWrap: { position: "relative" },
  photo: { width: 390, height: 390, backgroundColor: colors.border },
  photoPlaceholder: { alignItems: "center", justifyContent: "center", width: "100%" },
  headerMenuBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  // Dark gradient fading up from the photo's bottom edge, so the overlaid
  // name/location/badges stay readable without a separate solid-color
  // panel underneath - same fix CatalogScreen's card already got for the
  // same complaint ("почему чёрная заливка"/"без сиреневого").
  photoScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "55%" },
  previewBanner: {
    position: "absolute",
    top: spacing.md,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignSelf: "flex-start",
  },
  previewBannerText: { fontSize: 12.5, fontWeight: "600", color: colors.ink },
  // Name/location/badges float directly over the photo + scrim now
  // (Alena's Figma reference), instead of a transparent `header` box that
  // sat on GradientBackground's vivid gradient below the photo - that read
  // as a solid lilac panel between the photo and the white detail card.
  // ProfileDetailSections' own infoCard (rounded top corners) follows
  // immediately after photoWrap with no gap, so it visually overlaps the
  // photo's bottom edge exactly like the reference.
  overlayInfo: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.lg, gap: spacing.xs },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  verifiedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  videoVerifiedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.pink,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 22, fontWeight: "800", color: colors.white, flexShrink: 1 },
  subtitle: { fontSize: 14, color: colors.white },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.premium,
    color: colors.white,
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    marginTop: spacing.xs,
  },
  // Prototype's .pd-badges/.pd-badge (profile type over the photo).
  typeBadgeRow: { flexDirection: "row", marginTop: spacing.xs },
  typeBadge: {
    backgroundColor: colors.pink,
    color: colors.white,
    fontSize: 11.5,
    fontWeight: "700",
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  // flexWrap - now 3 links (Family Room / Compatibility Report / Pregnancy
  // Room), not 2 - wrapping to a second line beats squeezing 3 equal
  // thirds into one row and clipping/wrapping "Compatibility Report".
  familyLinksRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingHorizontal: spacing.lg, backgroundColor: colors.card, paddingBottom: spacing.lg },
  familyLink: {
    flexGrow: 1,
    flexBasis: "30%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.bgSoft,
    borderRadius: radius.pill,
    paddingVertical: 11,
  },
  familyLinkText: { fontSize: 12.5, fontWeight: "700", color: colors.ink },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    shadowColor: "#020817",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  pillBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: radius.pill,
  },
  pillBtnBlue: { backgroundColor: colors.blue },
  pillBtnPink: { backgroundColor: colors.pink },
  pillBtnText: { color: "#fff", fontSize: 14.5, fontWeight: "700" },
  menuOverlay: { flex: 1, backgroundColor: "rgba(2,8,23,0.4)", justifyContent: "flex-end" },
  menuSheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 10, paddingBottom: 28, paddingHorizontal: spacing.lg },
  menuHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 12 },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  menuRowText: { fontSize: 15, fontWeight: "600", color: colors.ink },
  menuRowTextDanger: { color: colors.danger },
});
