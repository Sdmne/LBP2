import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { fetchFavourites, unfavouriteClinic, unfavouriteLawyer } from "../api/favourites";
import { ApiError } from "../api/client";
import type { FavouriteItem } from "../api/types";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Row = FavouriteItem & { kind: "clinics" | "lawyers" };

// GET /api/member/favourites - same endpoint that backs the site's "Saved"
// page (MemberLinks -> /favourites); combines clinics and lawyers into one
// list here the same way the backend response groups them.
export default function FavouritesScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useI18n();
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetchFavourites();
      const combined: Row[] = [
        ...res.clinics.map((item) => ({ ...item, kind: "clinics" as const })),
        ...res.lawyers.map((item) => ({ ...item, kind: "lawyers" as const })),
      ];
      combined.sort((a, b) => (a.favouritedAt < b.favouritedAt ? 1 : -1));
      setItems(combined);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("favourites.loadError"));
    }
  }, [t]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function remove(item: Row) {
    setItems((prev) => prev.filter((i) => i.favouriteId !== item.favouriteId));
    try {
      await (item.kind === "clinics" ? unfavouriteClinic(item.id) : unfavouriteLawyer(item.id));
    } catch {
      load();
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
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => `${item.kind}-${item.favouriteId}`}
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.emptyText}>{t("favourites.empty")}</Text>
        </View>
      }
      renderItem={({ item }) => {
        // member_favourites() in main.py (unlike public_clinics/public_lawyers)
        // returns each row via a plain normalize_row(), not
        // directory_public_record() - so slug/logoUrl/photoUrl are never
        // hoisted to the top level here, only nested under item.data (which
        // does still carry them, since public_safe_data only strips a
        // sensitive-field denylist). Falling back to the nested copies keeps
        // the thumbnail working and - more importantly - keeps slugOrId a
        // real slug: the clinic/lawyer detail endpoint looks up by slug only,
        // so without this a favourited item with no top-level slug would
        // navigate with its bare numeric id and 404.
        const data = (item.data || {}) as Record<string, unknown>;
        const image = item.logoUrl || item.photoUrl || (data.logoUrl as string | undefined) || (data.photoUrl as string | undefined);
        const slugOrId = item.slug || (data.slug as string | undefined) || item.id;
        return (
          <Pressable
            style={styles.card}
            onPress={() =>
              navigation.navigate("DirectoryDetail", { kind: item.kind, slugOrId, name: item.name, isFavourite: true })
            }
          >
            {image ? (
              <Image source={{ uri: image }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={{ fontSize: 18 }}>{item.kind === "clinics" ? "🏥" : "⚖️"}</Text>
              </View>
            )}
            <View style={styles.cardBody}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {[item.city, item.country].filter(Boolean).join(", ") || t("common.locationNotSet")}
              </Text>
            </View>
            <Pressable hitSlop={8} onPress={() => void remove(item)}>
              <Text style={styles.remove}>{t("favourites.remove")}</Text>
            </Pressable>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  errorText: { color: colors.danger },
  emptyText: { color: colors.muted, textAlign: "center" },
  list: { padding: spacing.md, gap: spacing.sm, backgroundColor: colors.card, flexGrow: 1 },
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
  avatar: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.line },
  avatarPlaceholder: { alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1 },
  name: { fontSize: 15, fontWeight: "700", color: colors.ink },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  remove: { fontSize: 13, fontWeight: "600", color: colors.danger },
});
