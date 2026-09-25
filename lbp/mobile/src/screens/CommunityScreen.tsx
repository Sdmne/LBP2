import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { fetchCommunityGroups, type CommunityGroup } from "../api/community";
import { favouriteGroup, unfavouriteGroup } from "../api/favourites";
import { ApiError } from "../api/client";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import GradientBackground from "../components/GradientBackground";
import type { RootStackParamList } from "../navigation/RootNavigator";

// Premium roadmap step 11 - Pro-only community/expert Q&A groups. Lists
// the admin-curated groups (see api/community.ts); a Family Builder Pro
// member taps in to read and post, everyone else sees the same styled
// "Pro required" state AiAdvisorScreen/FamilyRoomScreen already use.
export default function CommunityScreen() {
  const { t } = useI18n();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsPro, setNeedsPro] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Alena: "надо сделать подписаться на группу" - a follow/subscribe
  // toggle right on each group row (not just inside the group itself), so
  // it's one tap from this list. Reuses the same favourite_group entity
  // the Favourites screen's new "Groups" tab reads, so subscribing here
  // and unsubscribing there stay in sync. Seeded from each group's own
  // isFavourited (member_community_groups() in main.py), then tracked
  // locally per id so a tap updates instantly without waiting on a reload.
  const [favouritedIds, setFavouritedIds] = useState<Record<number, boolean>>({});
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setNeedsPro(false);
    try {
      const res = await fetchCommunityGroups();
      setGroups(res.groups);
      setFavouritedIds(Object.fromEntries(res.groups.map((group) => [group.id, group.isFavourited])));
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        setNeedsPro(true);
      } else {
        setError(err instanceof ApiError ? err.message : t("community.loadError"));
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleFollow(group: CommunityGroup) {
    if (togglingId) return;
    const next = !favouritedIds[group.id];
    setTogglingId(group.id);
    setFavouritedIds((prev) => ({ ...prev, [group.id]: next }));
    try {
      await (next ? favouriteGroup(group.id) : unfavouriteGroup(group.id));
    } catch {
      setFavouritedIds((prev) => ({ ...prev, [group.id]: !next }));
    } finally {
      setTogglingId(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.pink} />
      </View>
    );
  }

  if (needsPro) {
    return (
      <GradientBackground variant="soft">
        <View style={styles.center}>
          <Feather name="users" size={40} color={colors.muted} />
          <Text style={styles.premiumTitle}>{t("community.premiumTitle")}</Text>
          <Text style={styles.premiumBody}>{t("community.premiumBody")}</Text>
          <Pressable style={styles.upgradeButton} onPress={() => navigation.navigate("Subscription")}>
            <Text style={styles.upgradeButtonText}>{t("community.seePro")}</Text>
          </Pressable>
        </View>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground variant="soft">
      {error ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{error}</Text>
        </View>
      ) : null}
      <FlatList
        data={groups}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.center}>
            <Feather name="users" size={36} color={colors.muted} />
            <Text style={styles.emptyText}>{t("community.noGroups")}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.groupCard}
            onPress={() => navigation.navigate("CommunityGroup", { groupId: item.id, groupName: item.name || t("community.title"), isFavourited: favouritedIds[item.id] })}
          >
            <View style={styles.groupIconWrap}>
              <Feather name={(item.icon as keyof typeof Feather.glyphMap) || "message-circle"} size={20} color={colors.pink} />
            </View>
            <View style={styles.groupTextWrap}>
              <Text style={styles.groupName}>{item.name}</Text>
              {item.description ? (
                <Text style={styles.groupDescription} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}
              <Text style={styles.groupMeta}>{t("community.postCount", { count: item.postCount })}</Text>
            </View>
            <Pressable hitSlop={8} style={styles.followButton} onPress={() => void toggleFollow(item)}>
              <Feather name="bookmark" size={18} color={favouritedIds[item.id] ? colors.pink : colors.muted} />
            </Pressable>
            <Feather name="chevron-right" size={18} color={colors.muted} />
          </Pressable>
        )}
      />
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.sm },
  premiumTitle: { fontSize: 18, fontWeight: "800", color: colors.ink, textAlign: "center", marginTop: spacing.sm },
  premiumBody: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20 },
  upgradeButton: {
    backgroundColor: colors.pink,
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  upgradeButtonText: { color: colors.white, fontWeight: "700" },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20, maxWidth: 280 },
  notice: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  noticeText: { fontSize: 12.5, color: colors.danger, textAlign: "center" },
  list: { padding: spacing.md, gap: spacing.sm },
  groupCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  groupIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.tintPink,
    alignItems: "center",
    justifyContent: "center",
  },
  groupTextWrap: { flex: 1 },
  groupName: { fontSize: 15, fontWeight: "700", color: colors.ink },
  groupDescription: { fontSize: 13, color: colors.mutedOnGradient, lineHeight: 18, marginTop: 2 },
  groupMeta: { fontSize: 11.5, color: colors.muted, marginTop: 4 },
  followButton: { padding: spacing.xs },
});
