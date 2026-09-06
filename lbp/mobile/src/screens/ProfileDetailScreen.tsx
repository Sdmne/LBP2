import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { api, ApiError } from "../api/client";
import { blockProfile } from "../api/blocks";
import { likeProfile, unlikeProfile } from "../api/catalog";
import { createConversation } from "../api/messages";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "ProfileDetail">;

// GET /api/member/catalog/{id} - member_catalog_detail() in main.py, wraps
// public_profile_summary() (see the comment there): a stable set of top
// level fields (id, displayName, city, country, avatarUrl, isVerified,
// isPremium, likedByViewer...) plus a `data` object holding whatever else is
// in that profile's own JSON blob (bio/about text, questionnaire answers,
// etc.) - its exact keys aren't enumerated anywhere in the backend, so this
// screen reads a few common ones defensively instead of assuming a fixed
// shape.
type ProfileDetail = {
  id: number;
  displayName: string | null;
  city: string | null;
  country: string | null;
  avatarUrl: string | null;
  photos?: string[];
  isVerified?: boolean;
  isPremium?: boolean;
  likedByViewer?: boolean;
  data?: Record<string, unknown>;
};

export default function ProfileDetailScreen({ route, navigation }: Props) {
  const { profileId } = route.params;
  const { t } = useI18n();
  const [profile, setProfile] = useState<ProfileDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blocking, setBlocking] = useState(false);
  const [messaging, setMessaging] = useState(false);

  useEffect(() => {
    api
      .get<{ profile: ProfileDetail } | ProfileDetail>(`/api/member/catalog/${profileId}`)
      .then((res) => setProfile("profile" in res ? res.profile : res))
      .catch((err) => setError(err instanceof ApiError ? err.message : t("profileDetail.loadError")));
  }, [profileId, t]);

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
      Alert.alert(t("profileDetail.messageError"), err instanceof ApiError ? err.message : t("common.pleaseTryAgain"));
    } finally {
      setMessaging(false);
    }
  }

  // Optimistic like/unlike, mirroring CatalogScreen's toggleLike against the
  // same POST/DELETE /api/member/likes/{id} pair.
  async function toggleLike() {
    if (!profile) return;
    const wasLiked = !!profile.likedByViewer;
    setProfile((p) => (p ? { ...p, likedByViewer: !wasLiked } : p));
    try {
      if (wasLiked) await unlikeProfile(profile.id);
      else await likeProfile(profile.id);
    } catch {
      setProfile((p) => (p ? { ...p, likedByViewer: wasLiked } : p));
    }
  }

  function handleReport() {
    if (!profile) return;
    navigation.navigate("ReportProfile", { profileId: profile.id, displayName: profile.displayName });
  }

  function handleBlock() {
    if (!profile) return;
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

  const bio = firstString(profile.data, ["bio", "about", "aboutMe", "description"]);
  const photos = profile.photos?.length ? profile.photos : profile.avatarUrl ? [profile.avatarUrl] : [];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {photos.length > 0 ? (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
          {photos.map((url, i) => (
            <Image key={i} source={{ uri: url }} style={styles.photo} />
          ))}
        </ScrollView>
      ) : (
        <View style={[styles.photo, styles.photoPlaceholder]}>
          <Text style={{ fontSize: 40 }}>👤</Text>
        </View>
      )}

      <View style={styles.body}>
        <Text style={styles.name}>
          {profile.displayName}
          {profile.isVerified ? " ✓" : ""}
        </Text>
        <Text style={styles.subtitle}>
          {[profile.city, profile.country].filter(Boolean).join(", ") || t("common.locationNotSet")}
        </Text>
        {profile.isPremium ? <Text style={styles.badge}>{t("profileDetail.premium")}</Text> : null}
        {bio ? <Text style={styles.bio}>{bio}</Text> : null}

        <View style={styles.actionsRow}>
          <Pressable style={styles.actionButton} onPress={toggleLike} disabled={messaging}>
            <Text style={styles.actionText}>
              {profile.likedByViewer ? t("profileDetail.liked") : t("profileDetail.like")}
            </Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => void handleMessage()} disabled={messaging}>
            {messaging ? (
              <ActivityIndicator color={colors.textMuted} />
            ) : (
              <Text style={styles.actionText}>{t("profileDetail.message")}</Text>
            )}
          </Pressable>
        </View>
        <View style={styles.actionsRow}>
          <Pressable style={styles.actionButton} onPress={handleReport} disabled={blocking}>
            <Text style={styles.actionText}>{t("profileDetail.report")}</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={handleBlock} disabled={blocking}>
            {blocking ? (
              <ActivityIndicator color={colors.danger} />
            ) : (
              <Text style={[styles.actionText, styles.blockText]}>{t("profileDetail.block")}</Text>
            )}
          </Pressable>
        </View>

        {/* Family Builder Pro's shared "Family Room" (plan/checklist/docs).
            Always shown regardless of match/premium status - FamilyRoomScreen
            itself renders the right message for a 402 (no Premium) or 404
            (no active match with this profile) response. */}
        <View style={styles.actionsRow}>
          <Pressable
            style={styles.actionButton}
            onPress={() => navigation.navigate("FamilyRoom", { profileId: profile.id, displayName: profile.displayName })}
          >
            <Text style={styles.actionText}>{t("profileDetail.familyRoom")}</Text>
          </Pressable>
        </View>

        {/* Persisted two-sided Compatibility Report (see
            src/api/compatibility.ts) - same "always shown, let the screen
            render the 402/404 state" pattern as Family Room above. */}
        <View style={styles.actionsRow}>
          <Pressable
            style={styles.actionButton}
            onPress={() => navigation.navigate("CompatibilityReport", { profileId: profile.id, displayName: profile.displayName })}
          >
            <Text style={styles.actionText}>{t("profileDetail.compatibilityReport")}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function firstString(data: Record<string, unknown> | undefined, keys: string[]): string | null {
  if (!data) return null;
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  errorText: { color: colors.danger },
  container: { paddingBottom: spacing.xl },
  photo: { width: 390, height: 390, backgroundColor: colors.border },
  photoPlaceholder: { alignItems: "center", justifyContent: "center", width: "100%" },
  body: { padding: spacing.lg, gap: spacing.xs },
  name: { fontSize: 22, fontWeight: "800", color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted },
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
  bio: { fontSize: 15, color: colors.text, marginTop: spacing.sm, lineHeight: 21 },
  actionsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  actionButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 12,
  },
  actionText: { fontSize: 14, fontWeight: "700", color: colors.textMuted },
  blockText: { color: colors.danger },
});
