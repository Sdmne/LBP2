import React, { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { createCommunityPost, deleteCommunityPost, fetchCommunityPosts, type CommunityPost } from "../api/community";
import { favouriteGroup, unfavouriteGroup } from "../api/favourites";
import { ApiError } from "../api/client";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import GradientBackground from "../components/GradientBackground";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "CommunityGroup">;

// Premium roadmap step 11. Posts inside one community group - a member
// reads, posts, and can delete their own posts; tapping a post opens
// CommunityPostScreen (the post object is passed through navigation
// params rather than fetched again, since the list response already has
// everything that screen needs).
export default function CommunityGroupScreen({ route, navigation }: Props) {
  const { groupId, isFavourited: initialFavourited } = route.params;
  const { t } = useI18n();
  // Alena: "как подписаться на группу?" - a follow/unsubscribe toggle in
  // the header, mirroring the same bookmark button on the groups list
  // (CommunityScreen.tsx) and feeding the same Favourites screen "Groups"
  // tab. `initialFavourited` comes through navigation params so this
  // screen doesn't need its own extra fetch just to know the starting
  // state; it defaults to false when the screen is reached some other way.
  const [favourited, setFavourited] = useState(Boolean(initialFavourited));
  const [followBusy, setFollowBusy] = useState(false);
  const insets = useSafeAreaInsets();
  // BUG FIX (Sep 2026): Alena reported the composer's input row
  // (text field + send button) going fully invisible while typing on
  // Android - the keyboard's predictive-text bar reacted, so the
  // TextInput WAS receiving keystrokes, it just wasn't rendered
  // on-screen. This screen sits under a native stack header (unlike
  // Chat, which hides its header and uses keyboardVerticalOffset=0),
  // and KeyboardAvoidingView needs that header's height counted in its
  // offset or its resize math can push the input row out of view.
  const headerHeight = useHeaderHeight();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetchCommunityPosts(groupId);
      setPosts(res.posts);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("community.loadError"));
    } finally {
      setLoading(false);
    }
  }, [groupId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleFollow() {
    if (followBusy) return;
    const next = !favourited;
    setFollowBusy(true);
    setFavourited(next);
    try {
      await (next ? favouriteGroup(groupId) : unfavouriteGroup(groupId));
    } catch {
      setFavourited(!next);
    } finally {
      setFollowBusy(false);
    }
  }

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable hitSlop={8} onPress={() => void toggleFollow()} style={{ paddingHorizontal: spacing.xs }}>
          <Feather name="bookmark" size={20} color={favourited ? colors.pink : colors.muted} />
        </Pressable>
      ),
    });
  }, [navigation, favourited]);

  async function handlePost() {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      const res = await createCommunityPost(groupId, body);
      setPosts((prev) => [res.post, ...prev]);
      setDraft("");
    } catch (err) {
      Alert.alert(t("community.postError"), err instanceof ApiError ? err.message : t("common.pleaseTryAgain"));
    } finally {
      setPosting(false);
    }
  }

  function handleDelete(post: CommunityPost) {
    Alert.alert(t("community.deleteConfirmTitle"), t("community.deleteConfirmBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("community.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await deleteCommunityPost(post.id);
            setPosts((prev) => prev.filter((item) => item.id !== post.id));
          } catch (err) {
            Alert.alert(t("community.deleteError"), err instanceof ApiError ? err.message : t("common.pleaseTryAgain"));
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.pink} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={headerHeight}
    >
      <GradientBackground variant="soft" style={styles.flex}>
        {error ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{error}</Text>
          </View>
        ) : null}
        <FlatList
          data={posts}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Feather name="message-circle" size={36} color={colors.muted} />
              <Text style={styles.emptyText}>{t("community.noPosts")}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable style={styles.postCard} onPress={() => navigation.navigate("CommunityPost", { post: item, groupId })}>
              <View style={styles.postHeaderRow}>
                <Text style={styles.postAuthor} numberOfLines={1}>
                  {item.authorName}
                </Text>
                {item.isExpert ? (
                  <View style={styles.expertPill}>
                    <Text style={styles.expertPillText}>{t("community.expertBadge")}</Text>
                  </View>
                ) : null}
                {item.isMine ? (
                  <Pressable onPress={() => handleDelete(item)} hitSlop={8} style={styles.deleteButton}>
                    <Feather name="trash-2" size={14} color={colors.muted} />
                  </Pressable>
                ) : null}
              </View>
              <Text style={styles.postBody} numberOfLines={3}>
                {item.body}
              </Text>
              <Text style={styles.postMeta}>{t("community.replyCount", { count: item.replyCount })}</Text>
            </Pressable>
          )}
        />
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={t("community.postPlaceholder")}
            placeholderTextColor={colors.muted}
            multiline
          />
          <Pressable onPress={() => void handlePost()} disabled={!draft.trim() || posting} hitSlop={8}>
            {posting ? (
              <ActivityIndicator size="small" color={colors.pink} />
            ) : (
              <Feather name="send" size={20} color={draft.trim() ? colors.pink : colors.muted} />
            )}
          </Pressable>
        </View>
      </GradientBackground>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.sm },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20, maxWidth: 280 },
  notice: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  noticeText: { fontSize: 12.5, color: colors.danger, textAlign: "center" },
  list: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
  postCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md },
  postHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  postAuthor: { flex: 1, fontSize: 13.5, fontWeight: "700", color: colors.ink },
  expertPill: { backgroundColor: colors.tintPink, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  expertPillText: { fontSize: 10.5, fontWeight: "700", color: colors.pink },
  deleteButton: { padding: 2 },
  postBody: { fontSize: 14, color: colors.ink, lineHeight: 19, marginTop: 6 },
  postMeta: { fontSize: 11.5, color: colors.muted, marginTop: 6 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.bgSoft,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    color: colors.ink,
    fontSize: 15,
  },
});
