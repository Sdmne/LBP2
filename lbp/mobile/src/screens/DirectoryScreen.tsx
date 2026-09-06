import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { fetchClinics, fetchLawyers } from "../api/directory";
import { favouriteClinic, favouriteLawyer, fetchFavourites, unfavouriteClinic, unfavouriteLawyer } from "../api/favourites";
import { ApiError } from "../api/client";
import type { DirectoryItem } from "../api/types";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Kind = "clinics" | "lawyers";
type Nav = NativeStackNavigationProp<RootStackParamList>;
const PAGE_SIZE = 20;

// Mirrors the site's public /clinics and /lawyers directories
// (/api/public/clinics, /api/public/lawyers - no auth needed to browse
// them, same as the web) plus the heart-to-save action that does need a
// session (/api/member/favourites/...). Since this screen only exists
// inside the authenticated part of the app (see RootNavigator), there's no
// logged-out browsing state to handle here the way the site has.
//
// Restyled (Sep 2026) to match the prototype's #scr-clinics/#scr-lawyers
// list rows (.doc-row: bordered card, 48px thumbnail, title + meta line,
// small "Partner" pill). The prototype also shows category filter chips
// (IVF, Egg freezing, ...) above the list, but /api/public/clinics and
// /lawyers have no category query param to back that with real filtering
// (see api/directory.ts) - rather than ship chips that silently do
// nothing, they're left out here.
export default function DirectoryScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useI18n();
  const [kind, setKind] = useState<Kind>("clinics");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<DirectoryItem[]>([]);
  const [favouritedIds, setFavouritedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Guards against the tab switch and the search submit racing each other -
  // e.g. tapping "Lawyers" right after submitting a clinics search could
  // otherwise let the slower (now-stale) response overwrite the newer one.
  // Also invalidates any in-flight loadMore() page once a fresh load() (new
  // tab/search) supersedes it.
  const requestIdRef = useRef(0);

  const load = useCallback(async (activeKind: Kind, q: string) => {
    const requestId = ++requestIdRef.current;
    setError(null);
    try {
      const fetchList = activeKind === "clinics" ? fetchClinics : fetchLawyers;
      const [listRes, favRes] = await Promise.all([
        fetchList({ q: q || undefined, limit: PAGE_SIZE, offset: 0 }),
        fetchFavourites(),
      ]);
      if (requestIdRef.current !== requestId) return; // superseded by a newer load()
      setItems(listRes.items);
      setTotal(listRes.total);
      const favs = activeKind === "clinics" ? favRes.clinics : favRes.lawyers;
      setFavouritedIds(new Set(favs.map((item) => item.id)));
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      setError(err instanceof ApiError ? err.message : t("directory.loadError"));
    }
  }, [t]);

  // GET /api/public/clinics and /api/public/lawyers are paginated (limit/
  // offset, "total"/"hasMore" in the response - see public_clinics() in
  // main.py) but this screen used to always fetch just the first page, so
  // anything past the first PAGE_SIZE results was unreachable. onEndReached
  // below calls this to fetch the next page.
  async function loadMore() {
    if (loadingMore || loading) return;
    if (total !== null && items.length >= total) return;
    const requestId = ++requestIdRef.current;
    setLoadingMore(true);
    try {
      const fetchList = kind === "clinics" ? fetchClinics : fetchLawyers;
      const res = await fetchList({ q: query || undefined, limit: PAGE_SIZE, offset: items.length });
      if (requestIdRef.current !== requestId) return;
      setItems((prev) => [...prev, ...res.items]);
      setTotal(res.total);
    } catch {
      // Silent - scrolling again or pulling to refresh (via the tab/search
      // handlers) retries; matches CatalogScreen's loadMore.
    } finally {
      if (requestIdRef.current === requestId) setLoadingMore(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    load(kind, query).finally(() => setLoading(false));
    // Re-run when switching tabs; search re-runs on submit, not per keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  async function toggleFavourite(item: DirectoryItem) {
    const isFav = favouritedIds.has(item.id);
    setFavouritedIds((prev) => {
      const next = new Set(prev);
      if (isFav) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
    try {
      if (kind === "clinics") {
        await (isFav ? unfavouriteClinic(item.id) : favouriteClinic(item.id));
      } else {
        await (isFav ? unfavouriteLawyer(item.id) : favouriteLawyer(item.id));
      }
    } catch {
      // Revert on failure.
      setFavouritedIds((prev) => {
        const next = new Set(prev);
        if (isFav) next.add(item.id);
        else next.delete(item.id);
        return next;
      });
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <Pressable style={[styles.tab, kind === "clinics" && styles.tabActive]} onPress={() => setKind("clinics")}>
          <Text style={[styles.tabText, kind === "clinics" && styles.tabTextActive]}>{t("directory.clinics")}</Text>
        </Pressable>
        <Pressable style={[styles.tab, kind === "lawyers" && styles.tabActive]} onPress={() => setKind("lawyers")}>
          <Text style={[styles.tabText, kind === "lawyers" && styles.tabTextActive]}>{t("directory.lawyers")}</Text>
        </Pressable>
      </View>

      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={kind === "clinics" ? t("directory.searchClinics") : t("directory.searchLawyers")}
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          onSubmitEditing={() => {
            setLoading(true);
            load(kind, query).finally(() => setLoading(false));
          }}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.pink} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => `${kind}-${item.id}`}
          contentContainerStyle={styles.list}
          onEndReachedThreshold={0.5}
          onEndReached={() => void loadMore()}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>{t("directory.empty")}</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator color={colors.pink} />
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const image = item.logoUrl || item.photoUrl;
            const isFav = favouritedIds.has(item.id);
            const specialties = firstStringList(kind === "clinics" ? item.services : item.practiceAreas);
            const metaParts = [[item.city, item.country].filter(Boolean).join(", "), specialties].filter(Boolean);
            return (
              <Pressable
                style={styles.row}
                onPress={() =>
                  navigation.navigate("DirectoryDetail", { kind, slugOrId: item.slug || item.id, name: item.name, isFavourite: isFav })
                }
              >
                {image ? (
                  <Image source={{ uri: image }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}>
                    <Text style={{ fontSize: 18 }}>{kind === "clinics" ? "🏥" : "⚖️"}</Text>
                  </View>
                )}
                <View style={styles.rowBody}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.meta} numberOfLines={1}>
                      {metaParts.join(" · ") || t("common.locationNotSet")}
                    </Text>
                  </View>
                  <View style={styles.partnerTag}>
                    <Text style={styles.partnerTagText}>{t("directory.partnerTag")}</Text>
                  </View>
                </View>
                <Pressable hitSlop={8} onPress={() => void toggleFavourite(item)}>
                  <Text style={styles.heart}>{isFav ? "❤️" : "🤍"}</Text>
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

// Best-effort extraction of a short "IVF, Egg freezing" style summary from
// the item's services/practiceAreas field, which the backend types as
// `unknown` (see api/types.ts) since its exact shape isn't pinned down -
// handles both a real string array and a comma-joined string defensively,
// and gives up (returns "") rather than rendering "[object Object]".
function firstStringList(value: unknown, max = 2): string {
  if (Array.isArray(value)) {
    const strs = value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
    return strs.slice(0, max).join(", ");
  }
  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, max).join(", ");
  }
  return "";
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.card },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  errorText: { color: colors.danger },
  emptyText: { color: colors.muted },
  tabs: { flexDirection: "row", padding: spacing.md, gap: spacing.sm },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSoft,
  },
  tabActive: { backgroundColor: colors.ink },
  tabText: { fontWeight: "700", color: colors.muted },
  tabTextActive: { color: colors.white },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    height: 42,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    gap: 8,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 13, color: colors.ink, padding: 0 },
  list: { padding: spacing.md, gap: spacing.sm },
  row: {
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
  thumb: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.line },
  thumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  rowBody: { flex: 1, gap: 2 },
  name: { fontSize: 14, fontWeight: "600", color: colors.ink },
  metaRow: { flexDirection: "row" },
  meta: { fontSize: 12, color: colors.muted, flexShrink: 1 },
  partnerTag: { alignSelf: "flex-start", backgroundColor: colors.tint, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2 },
  partnerTagText: { fontSize: 9.5, fontWeight: "700", color: colors.blueDark },
  heart: { fontSize: 20 },
  footer: { paddingVertical: spacing.lg },
});
