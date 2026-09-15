import React, { useCallback, useEffect, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { createCommunityReply, deleteCommunityReply, fetchCommunityReplies, type CommunityReply } from "../api/community";
import { ApiError } from "../api/client";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import GradientBackground from "../components/GradientBackground";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "CommunityPost">;

// Premium roadmap step 11. One post plus its replies. The post itself
// (author/body/isExpert) came through navigation params from
// CommunityGroupScreen's list - only the replies are fetched here.
export default function CommunityPostScreen({ route }: Props) {
  const { post } = route.params;
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [replies, setReplies] = useState<CommunityReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetchCommunityReplies(post.id);
      setReplies(res.replies);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("community.loadError"));
    } finally {
      setLoading(false);
    }
  }, [post.id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleReply() {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      const res = await createCommunityReply(post.id, body);
      setReplies((prev) => [...prev, res.reply]);
      setDraft("");
    } catch (err) {
      Alert.alert(t("community.postError"), err instanceof ApiError ? err.message : t("common.pleaseTryAgain"));
    } finally {
      setPosting(false);
    }
  }

  function handleDeleteReply(reply: CommunityReply) {
    Alert.alert(t("community.deleteConfirmTitle"), t("community.deleteConfirmBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("community.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await deleteCommunityReply(reply.id);
            setReplies((prev) => prev.filter((item) => item.id !== reply.id));
          } catch (err) {
            Alert.alert(t("community.deleteError"), err instanceof ApiError ? err.message : t("common.pleaseTryAgain"));
          }
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <GradientBackground variant="soft" style={styles.flex}>
        {error ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{error}</Text>
          </View>
        ) : null}
        <FlatList
          data={replies}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.postCard}>
              <View style={styles.postHeaderRow}>
                <Text style={styles.postAuthor}>{post.authorName}</Text>
                {post.isExpert ? (
                  <View style={styles.expertPill}>
                    <Text style={styles.expertPillText}>{t("community.expertBadge")}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.postBody}>{post.body}</Text>
            </View>
          }
          ListEmptyComponent={
            loading ? (
              <View style={styles.center}>
                <ActivityIndicator size="small" color={colors.pink} />
              </View>
            ) : (
              <Text style={styles.emptyText}>{t("community.noReplies")}</Text>
            )
          }
          renderItem={({ item }) => (
            <View style={styles.replyCard}>
              <View style={styles.postHeaderRow}>
                <Text style={styles.replyAuthor} numberOfLines={1}>
                  {item.authorName}
                </Text>
                {item.isExpert ? (
                  <View style={styles.expertPill}>
                    <Text style={styles.expertPillText}>{t("community.expertBadge")}</Text>
                  </View>
                ) : null}
                {item.isMine ? (
                  <Pressable onPress={() => handleDeleteReply(item)} hitSlop={8} style={styles.deleteButton}>
                    <Feather name="trash-2" size={13} color={colors.muted} />
                  </Pressable>
                ) : null}
              </View>
              <Text style={styles.replyBody}>{item.body}</Text>
            </View>
          )}
        />
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={t("community.replyPlaceholder")}
            placeholderTextColor={colors.muted}
            multiline
          />
          <Pressable onPress={() => void handleReply()} disabled={!draft.trim() || posting} hitSlop={8}>
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
  center: { alignItems: "center", justifyContent: "center", padding: spacing.lg },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20, padding: spacing.lg },
  notice: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  noticeText: { fontSize: 12.5, color: colors.danger, textAlign: "center" },
  list: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
  postCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
  postHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  postAuthor: { flex: 1, fontSize: 14.5, fontWeight: "700", color: colors.ink },
  postBody: { fontSize: 15, color: colors.ink, lineHeight: 21, marginTop: 6 },
  expertPill: { backgroundColor: colors.tintPink, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  expertPillText: { fontSize: 10.5, fontWeight: "700", color: colors.pink },
  deleteButton: { padding: 2 },
  replyCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.sm },
  replyAuthor: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.ink },
  replyBody: { fontSize: 13.5, color: colors.ink, lineHeight: 18, marginTop: 4 },
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
