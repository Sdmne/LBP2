import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { fetchConversations } from "../api/messages";
import { ApiError } from "../api/client";
import type { ConversationSummary } from "../api/types";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import type { MainTabsParamList } from "../navigation/MainTabs";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = BottomTabScreenProps<MainTabsParamList, "Messages">;

// Restyled to match the prototype's #scr-messages screen: a plain list of
// rows separated by a hairline (.mlist/.mrow), a 52px circular avatar, a
// name/time top line and a preview line below it, and a pink dot for
// unread previews - rather than the earlier floating-card row style. The
// prototype also shows a pinned "LetsBeParents Support" row at the top of
// the list, but that isn't backed by a real conversation from the API
// (member_conversations() in main.py returns only real matches), so it's
// left out here rather than faking one - a client-side search filter is
// added instead, since that's a real, deliverable behavior.
export default function MessagesScreen(_props: Props) {
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useI18n();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetchConversations();
      setConversations(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("messages.loadError"));
    }
  }, [t]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  // Refresh the list (order + previews) whenever this tab regains focus -
  // e.g. coming back from a Chat after sending/reading a message, whose
  // effect on this list would otherwise only show up after a manual
  // pull-to-refresh. Skip the very first focus, since it fires right
  // alongside the mount effect above and would just duplicate that load.
  const mountedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!mountedRef.current) {
        mountedRef.current = true;
        return;
      }
      void load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => (c.otherDisplayName || "").toLowerCase().includes(q));
  }, [conversations, query]);

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
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={t("messages.searchPlaceholder")}
          placeholderTextColor={colors.muted}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>{t("messages.empty")}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() =>
              rootNav.navigate("Chat", { conversationId: item.id, title: item.otherDisplayName || t("messages.chatTitleFallback") })
            }
          >
            {item.otherAvatarUrl ? (
              <Image source={{ uri: item.otherAvatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarPlaceholderText}>{item.otherDisplayName?.[0] ?? "?"}</Text>
              </View>
            )}
            <View style={styles.rowBody}>
              <View style={styles.rowTop}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.otherDisplayName || t("messages.unknown")}
                </Text>
                {item.updated_at ? <Text style={styles.time}>{formatTime(item.updated_at)}</Text> : null}
              </View>
              <Text style={styles.preview} numberOfLines={1}>
                {item.lastMessage || (item.lastMessageMediaUrl ? t("messages.photo") : t("messages.sayHi"))}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

// Best-effort relative/short time label for the row's top-right corner -
// mirrors the prototype's "2m" / "31 Jul" style without pulling in a date
// library. Falls back to nothing if the timestamp can't be parsed.
function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.card },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  errorText: { color: colors.danger, textAlign: "center" },
  emptyText: { color: colors.muted, textAlign: "center" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    height: 42,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    gap: 8,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 14, color: colors.ink, padding: 0 },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  separator: { height: 1, backgroundColor: colors.line },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  avatar: { width: 52, height: 52, borderRadius: radius.pill, backgroundColor: colors.line },
  avatarPlaceholder: { alignItems: "center", justifyContent: "center" },
  avatarPlaceholderText: { fontSize: 18, fontWeight: "700", color: colors.muted },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  name: { fontSize: 14.5, fontWeight: "600", color: colors.ink, flexShrink: 1 },
  time: { fontSize: 11, color: colors.muted, marginLeft: 8 },
  preview: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
});
