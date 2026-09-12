import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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

  useEffect(() => {
    api
      .get<{ profile: ProfileDetail } | ProfileDetail>(`/api/member/catalog/${profileId}`)
      .then((res) => setProfile("profile" in res ? res.profile : res))
      .catch((err) => setError(err instanceof ApiError ? err.message : t("profileDetail.loadError")));
  }, [profileId, t]);

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
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: spacing.xl + 92 + insets.bottom }]}
      >
        {photos.length > 0 ? (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
            {photos.map((url, i) => (
              <Image key={i} source={{ uri: url }} style={styles.photo} />
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]}>
            <Feather name="user" size={56} color={colors.blue} />
          </View>
        )}

        {isSelf ? (
          <View style={styles.previewBanner}>
            <Feather name="eye" size={14} color={colors.ink} />
            <Text style={styles.previewBannerText}>{t("profileDetail.previewBanner")}</Text>
          </View>
        ) : null}

        <View style={styles.header}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{profile.displayName}</Text>
            {profile.isVerified ? (
              <View style={styles.verifiedBadge}>
                <Feather name="check" size={11} color="#fff" />
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
            {/* Deliberately its own top-level entry point, not only the
                card inside FamilyRoomScreen - Pregnancy Room is free for
                everyone (Alena: "убрать ограничение навсегда"), unlike the
                rest of Family Room which requires Premium, so it can't
                live only behind that screen's premium-gated entry. Still
                needs an active match (PregnancyRoomScreen enforces that
                itself), same as the two links above. */}
            <Pressable
              style={styles.familyLink}
              onPress={() => navigation.navigate("PregnancyRoom", { profileId: profile.id, displayName: profile.displayName })}
            >
              <Feather name="activity" size={15} color={colors.ink} />
              <Text style={styles.familyLinkText}>{t("profileDetail.pregnancyRoom")}</Text>
            </Pressable>
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
                    <ActivityIndicator color={colors.danger} />
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
  photo: { width: 390, height: 390, backgroundColor: colors.border },
  photoPlaceholder: { alignItems: "center", justifyContent: "center", width: "100%" },
  headerMenuBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  previewBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  previewBannerText: { fontSize: 12.5, fontWeight: "600", color: colors.ink },
  // Prototype's #scr-profile-detail keeps the vivid gradient only behind the
  // header text + photo (.pd-header/.pd-photo-card have no background of
  // their own - the gradient shows straight through); the actual detail
  // rows sit inside .pd-info-card, a white rounded card that overlaps the
  // photo (margin-top:-18).
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm, gap: spacing.xs },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  verifiedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 22, fontWeight: "800", color: colors.white },
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
