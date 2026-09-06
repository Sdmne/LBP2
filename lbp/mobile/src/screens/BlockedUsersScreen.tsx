import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { fetchBlockedProfiles, unblockProfile } from "../api/blocks";
import { ApiError } from "../api/client";
import type { BlockedProfile } from "../api/types";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";

export default function BlockedUsersScreen() {
  const { t } = useI18n();
  const [blocked, setBlocked] = useState<BlockedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetchBlockedProfiles();
      setBlocked(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("blockedUsers.loadError"));
    }
  }, [t]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  function handleUnblock(profile: BlockedProfile) {
    Alert.alert(t("blockedUsers.unblockConfirmTitle"), profile.displayName || undefined, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("blockedUsers.unblock"),
        onPress: async () => {
          setBlocked((prev) => prev.filter((p) => p.id !== profile.id));
          try {
            await unblockProfile(profile.id);
          } catch {
            load();
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

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={blocked}
      keyExtractor={(item) => String(item.blockId)}
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.emptyText}>{t("blockedUsers.empty")}</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          {item.avatarUrl ? (
            <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarPlaceholderText}>{item.displayName?.[0] ?? "?"}</Text>
            </View>
          )}
          <Text style={styles.name} numberOfLines={1}>
            {item.displayName}
          </Text>
          <Pressable style={styles.unblockButton} onPress={() => handleUnblock(item)}>
            <Text style={styles.unblockText}>{t("blockedUsers.unblock")}</Text>
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: colors.danger },
  emptyText: { color: colors.muted },
  list: { padding: spacing.md, backgroundColor: colors.card, flexGrow: 1 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  avatar: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.line },
  avatarPlaceholder: { alignItems: "center", justifyContent: "center" },
  avatarPlaceholderText: { fontSize: 16, fontWeight: "700", color: colors.muted },
  name: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.ink },
  unblockButton: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  unblockText: { fontSize: 13, fontWeight: "600", color: colors.ink },
});
