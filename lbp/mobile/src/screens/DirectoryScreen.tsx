import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import {
  fetchClinicOptions,
  fetchClinics,
  fetchLawyerOptions,
  fetchLawyers,
  type DirectoryCategoryOption,
  type DirectoryCountryOption,
} from "../api/directory";
import { favouriteClinic, favouriteLawyer, fetchFavourites, unfavouriteClinic, unfavouriteLawyer } from "../api/favourites";
import { ApiError } from "../api/client";
import type { DirectoryItem } from "../api/types";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GradientBackground from "../components/GradientBackground";
import { OptionListPicker } from "../components/OptionListPicker";
import { countryName } from "../utils/countryNames";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Kind = "clinics" | "lawyers";
type Props = NativeStackScreenProps<RootStackParamList, "Directory">;
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
// small "Partner" pill). The prototype's own category filter chips (IVF,
// Egg freezing, ...) have no backing query param on /api/public/clinics or
// /lawyers, so those specifically are still left out rather than shipped
// fake - but /api/public/clinics/options and /lawyers/options DO already
// return a real per-country breakdown with counts (public_clinic_options()/
// public_lawyer_options() in main.py), which nothing on this screen used -
// that's now a real country filter chip row instead.
export default function DirectoryScreen({ route, navigation }: Props) {
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<Kind>(route.params?.initialKind || "clinics");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<DirectoryItem[]>([]);
  const [favouritedIds, setFavouritedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countries, setCountries] = useState<DirectoryCountryOption[]>([]);
  // Alena: "должны выбираться несколько сразу" - country needed to be a
  // multi-select (several countries filtered together), not one at a
  // time. Kept as an array everywhere below instead of a single value.
  const [country, setCountry] = useState<string[]>([]);
  // Real, backend-backed specialty filter (clinics: serviceCategory /
  // CLINIC_SERVICE_GROUPS, lawyers: practiceArea) - Alena's reference had
  // its own chip labels ("Egg freezing", "Donor programs", "Surrogacy")
  // that don't match the real taxonomy the backend actually groups by, so
  // the chips below use the API's own labels/options rather than those.
  const [categories, setCategories] = useState<DirectoryCategoryOption[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  // Both filter rows used to be horizontal chip scrollers - fine for a
  // handful of countries, unusable once a category list has 227 entries
  // (Alena: "не помещаются фильтры" - the row doesn't fit, and endlessly
  // scrolling sideways through 227 chips to find one isn't a real way to
  // pick from a list that size). Replaced with two dropdown-style fields
  // that open the same full-screen OptionListPicker FiltersScreen already
  // uses for its own country/profileType/etc pickers, so long option lists
  // get a normal scrollable list instead of a horizontal chip row.
  const [picker, setPicker] = useState<"category" | "country" | null>(null);
  // Guards against the tab switch and the search submit racing each other -
  // e.g. tapping "Lawyers" right after submitting a clinics search could
  // otherwise let the slower (now-stale) response overwrite the newer one.
  // Also invalidates any in-flight loadMore() page once a fresh load() (new
  // tab/search) supersedes it.
  const requestIdRef = useRef(0);

  const load = useCallback(
    async (activeKind: Kind, q: string, activeCountry: string[], activeCategory: string | null) => {
      const requestId = ++requestIdRef.current;
      setError(null);
      try {
        const listParams =
          activeKind === "clinics"
            ? { q: q || undefined, country: activeCountry.length ? activeCountry : undefined, serviceCategory: activeCategory || undefined, limit: PAGE_SIZE, offset: 0 }
            : { q: q || undefined, country: activeCountry.length ? activeCountry : undefined, practiceArea: activeCategory || undefined, limit: PAGE_SIZE, offset: 0 };
        const [listRes, favRes, optionsRes] = await Promise.all([
          activeKind === "clinics" ? fetchClinics(listParams) : fetchLawyers(listParams),
          fetchFavourites(),
          activeKind === "clinics"
            ? fetchClinicOptions(locale).catch(() => ({ countries: [] as DirectoryCountryOption[], serviceCategories: [] as DirectoryCategoryOption[] }))
            : fetchLawyerOptions().catch(() => ({ countries: [] as DirectoryCountryOption[], practiceAreas: [] as DirectoryCategoryOption[] })),
        ]);
        if (requestIdRef.current !== requestId) return; // superseded by a newer load()
        setItems(listRes.items);
        setTotal(listRes.total);
        const favs = activeKind === "clinics" ? favRes.clinics : favRes.lawyers;
        setFavouritedIds(new Set(favs.map((item) => item.id)));
        setCountries(optionsRes.countries);
        setCategories("serviceCategories" in optionsRes ? optionsRes.serviceCategories : optionsRes.practiceAreas);
      } catch (err) {
        if (requestIdRef.current !== requestId) return;
        setError(err instanceof ApiError ? err.message : t("directory.loadError"));
      }
    },
    [t, locale],
  );

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
      const moreParams =
        kind === "clinics"
          ? { q: query || undefined, country: country.length ? country : undefined, serviceCategory: category || undefined, limit: PAGE_SIZE, offset: items.length }
          : { q: query || undefined, country: country.length ? country : undefined, practiceArea: category || undefined, limit: PAGE_SIZE, offset: items.length };
      const res = kind === "clinics" ? await fetchClinics(moreParams) : await fetchLawyers(moreParams);
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
    setCountry([]); // clinics/lawyers have different country breakdowns
    setCategory(null); // ...and different specialty taxonomies
    load(kind, query, [], null).finally(() => setLoading(false));
    // Re-run when switching tabs; search re-runs on submit, not per keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  function toggleCountry(value: string) {
    // "" is the picker's own "All countries" row - always clears the whole
    // selection instead of toggling one code in/out of it.
    const next = value === "" ? [] : country.includes(value) ? country.filter((c) => c !== value) : [...country, value];
    setCountry(next);
    setLoading(true);
    load(kind, query, next, category).finally(() => setLoading(false));
  }

  function selectCategory(next: string | null) {
    setCategory(next);
    setLoading(true);
    load(kind, query, country, next).finally(() => setLoading(false));
  }

  // Search's only clear affordance used to be backspacing the whole query
  // by hand - Alena flagged there was no way to reset back to the full
  // list after searching.
  function clearSearch() {
    setQuery("");
    setLoading(true);
    load(kind, "", country, category).finally(() => setLoading(false));
  }

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
    <GradientBackground variant="soft">
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
        <Feather name="search" size={17} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={kind === "clinics" ? t("directory.searchClinics") : t("directory.searchLawyers")}
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          onSubmitEditing={() => {
            setLoading(true);
            load(kind, query, country, category).finally(() => setLoading(false));
          }}
        />
        {query.length > 0 ? (
          <Pressable onPress={clearSearch} hitSlop={8}>
            <Feather name="x" size={17} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      {/* Real specialty + country filters - see the comment by the
          `picker` state. Each field opens a full-screen list instead of
          cramming every option into a horizontal chip row. */}
      {categories.length > 0 || countries.length > 0 ? (
        <View style={styles.filterRow}>
          {categories.length > 0 ? (
            <Pressable style={[styles.filterField, category && styles.filterFieldActive]} onPress={() => setPicker("category")}>
              <Text style={[styles.filterFieldText, category && styles.filterFieldTextActive]} numberOfLines={1}>
                {category ? categories.find((c) => c.value === category)?.label || category : t("directory.allCategories")}
              </Text>
              <Feather name="chevron-down" size={16} color={category ? colors.white : colors.ink} />
            </Pressable>
          ) : null}
          {countries.length > 0 ? (
            <Pressable style={[styles.filterField, country.length > 0 && styles.filterFieldActive]} onPress={() => setPicker("country")}>
              <Text style={[styles.filterFieldText, country.length > 0 && styles.filterFieldTextActive]} numberOfLines={1}>
                {country.length === 0
                  ? t("directory.allCountries")
                  : country.length === 1
                    ? countryName(country[0], locale)
                    : t("directory.countriesSelected", { count: country.length })}
              </Text>
              <Feather name="chevron-down" size={16} color={country.length > 0 ? colors.white : colors.ink} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <Modal visible={picker === "category"} animationType="slide" onRequestClose={() => setPicker(null)}>
        <OptionListPicker
          title={t("directory.allCategories")}
          options={[{ value: "", label: t("directory.allCategories") }, ...categories.map((c) => ({ value: c.value, label: c.label, count: c.count ?? undefined }))]}
          selected={category ? [category] : []}
          multi={false}
          onToggle={(value) => {
            selectCategory(value || null);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      </Modal>

      <Modal visible={picker === "country"} animationType="slide" onRequestClose={() => setPicker(null)}>
        <OptionListPicker
          title={t("directory.allCountries")}
          options={[
            { value: "", label: t("directory.allCountries") },
            ...countries
              .map((c) => ({ value: c.value, label: countryName(c.value, locale), count: c.count }))
              .sort((a, b) => a.label.localeCompare(b.label)),
          ]}
          selected={country}
          multi
          onToggle={toggleCountry}
          onClose={() => setPicker(null)}
        />
      </Modal>

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
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom }]}
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
            const metaParts = [[item.city, item.country ? countryName(item.country, locale) : null].filter(Boolean).join(", "), specialties].filter(Boolean);
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
                  {/* Meta text + the partner badge sit on the same line -
                      Alena's reference had it inline, not stacked below. */}
                  <View style={styles.metaRow}>
                    <Text style={styles.meta} numberOfLines={1}>
                      {metaParts.join(" · ") || t("common.locationNotSet")}
                    </Text>
                    <View style={styles.partnerTag}>
                      <Text style={styles.partnerTagText}>{t("directory.partnerTag")}</Text>
                    </View>
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
    </GradientBackground>
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
  container: { flex: 1, backgroundColor: "transparent" },
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
  // Explicit height (Sept 2026): a horizontal ScrollView with no
  // height of its own can fail to reserve its content's height in the
  // surrounding flex column - Alena's screenshot showed the category-chip
  // row and the country-chip row rendering on top of each other instead
  // of stacked, exactly this failure mode (both rows collapsing toward
  // zero height, so their real chip content overlapped the next row down
  // instead of pushing it lower). A fixed height matching the chip's own
  // rendered size (paddingVertical 7 * 2 + ~16px text ≈ 30px, +6px slack)
  // makes the row's box-model height unambiguous regardless of that.
  countryScroll: { height: 36, marginBottom: spacing.sm },
  countryRow: { paddingHorizontal: spacing.md, gap: spacing.xs, alignItems: "center" },
  filterRow: { flexDirection: "row", gap: spacing.xs, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  filterField: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSoft,
  },
  filterFieldActive: { backgroundColor: colors.ink },
  filterFieldText: { fontSize: 13, fontWeight: "700", color: colors.muted, flexShrink: 1, marginRight: 6 },
  filterFieldTextActive: { color: colors.white },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.bgSoft },
  chipActive: { backgroundColor: colors.ink },
  chipText: { fontSize: 12.5, fontWeight: "700", color: colors.muted },
  chipTextActive: { color: colors.white },
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
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  meta: { fontSize: 12, color: colors.muted, flexShrink: 1 },
  partnerTag: { alignSelf: "flex-start", backgroundColor: colors.tint, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  partnerTagText: { fontSize: 9.5, fontWeight: "700", color: colors.blueDark },
  heart: { fontSize: 20 },
  footer: { paddingVertical: spacing.lg },
});
