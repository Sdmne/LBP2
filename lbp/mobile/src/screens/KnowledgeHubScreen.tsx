import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { fetchArticles, type ArticleSummary } from "../api/articles";
import { REFERENCE_ARTICLE_COVERS } from "../data/referenceArticleCovers";
import { SITE_BASE_URL } from "../config";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GradientBackground from "../components/GradientBackground";
import AppHeader from "../components/AppHeader";

type Nav = NativeStackNavigationProp<RootStackParamList>;
const SECTION_LIMIT = 10;

// Real Knowledge Hub, backed by the same GET /api/public/articles the
// website's article reader page (Article() in ui.tsx) uses for a single
// article - see api/articles.ts for why this hits the live endpoint
// directly rather than porting the site's static reference-article file.
// Categories are the same fixed list the backend itself returns/filters on
// (public_articles() in main.py hardcodes them - there's no "list
// categories" endpoint).
const CATEGORIES = ["ivf", "co-parenting", "sperm-donor", "fertility", "lgbtq"];

export function categoryLabel(t: (key: string) => string, slug: string): string {
  if (!CATEGORIES.includes(slug)) return slug;
  return t(`knowledgeHub.category.${slug}`);
}

// See the comment at its call sites: the live API often has no cover_url,
// the site's own same-slug photo is the fallback.
function resolveCover(item: ArticleSummary): string | null {
  return item.cover_url || REFERENCE_ARTICLE_COVERS[item.slug] || null;
}

// UPDATE (Sept 2026): rebuilt as category-sectioned horizontal-scroll rows
// per Alena's explicit reference (a Flo-app screen recording: "по темами и
// вправо листает как у фло") - replaces the earlier filter-chip + 2-column
// grid layout entirely. One GET /api/public/articles per category (the
// backend has no "grouped by category" endpoint) rather than one big fetch
// filtered client-side, so each section can show its own loading state and
// a category with zero published articles just doesn't render a section at
// all instead of leaving an empty one.
//
// NOTE: separately confirmed the website's OWN Knowledge Hub grid doesn't
// even read this live endpoint - ui.tsx renders from a hardcoded
// `referenceKnowledgeArticles` array (reference-article-meta.ts), fetching
// the real API result but never using it. So this screen may be showing
// real DB content nothing else in the product actually exercises - if
// article covers still don't load after this, the likely cause is the DB
// rows themselves (empty/placeholder cover_url), not this client code.
type Section = { category: string; items: ArticleSummary[] };

export default function KnowledgeHubScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { t, locale } = useI18n();
  const [sections, setSections] = useState<Section[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [allItems, setAllItems] = useState<ArticleSummary[]>([]);

  useEffect(() => {
    let alive = true;
    setSections(null);
    setError(null);
    Promise.all(
      CATEGORIES.map((category) =>
        fetchArticles({ locale, category, limit: SECTION_LIMIT, offset: 0 })
          .then((page) => ({ category, items: page.items }))
          .catch(() => ({ category, items: [] as ArticleSummary[] })),
      ),
    )
      .then((results) => {
        if (!alive) return;
        const withContent = results.filter((s) => s.items.length > 0);
        if (withContent.length === 0 && results.every((s) => s.items.length === 0)) {
          setError(t("knowledgeHub.empty"));
        }
        setSections(withContent);
      })
      .catch(() => {
        if (alive) setError(t("knowledgeHub.loadError"));
      });
    // Search needs one flat list across every category, not just the first
    // SECTION_LIMIT of each - omitting `category` returns all published
    // articles (public_articles() in main.py only filters when a category
    // is passed), so this is a single extra call rather than 5 bigger ones.
    fetchArticles({ locale, limit: 100 })
      .then((page) => {
        if (alive) setAllItems(page.items);
      })
      .catch(() => {
        if (alive) setAllItems([]);
      });
    return () => {
      alive = false;
    };
  }, [locale, t]);

  const trimmedQuery = query.trim().toLowerCase();
  const searchResults =
    trimmedQuery.length > 0
      ? allItems.filter(
          (item) =>
            item.title.toLowerCase().includes(trimmedQuery) ||
            item.excerpt.toLowerCase().includes(trimmedQuery),
        )
      : [];

  return (
    <GradientBackground variant="soft">
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
      >
        <AppHeader title={t("nav.knowledgeHubTitle")} onBackPress={() => navigation.goBack()} />

        {/* Alena's reference recording had a search bar above the category
            chips - the chips themselves were deliberately dropped for the
            current per-category sectioned layout (see the UPDATE comment
            above), but search itself is real and worth keeping. Searches
            allItems (a separate, category-less fetch - see the effect above)
            rather than just what's currently rendered in the sections, so it
            actually covers every published article, not only the first
            SECTION_LIMIT of each category. */}
        <View style={styles.searchBar}>
          <Feather name="search" size={18} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={t("knowledgeHub.searchPlaceholder")}
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Feather name="x" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        {trimmedQuery.length > 0 ? (
          searchResults.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.errorText}>{t("knowledgeHub.noResults")}</Text>
            </View>
          ) : (
            <View style={styles.searchList}>
              {searchResults.map((item) => (
                <SearchResultRow
                  key={item.id}
                  item={item}
                  categoryText={categoryLabel(t, item.category)}
                  onPress={() => navigation.navigate("KnowledgeArticle", { slug: item.slug, title: item.title })}
                />
              ))}
            </View>
          )
        ) : sections === null && !error ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.pink} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          sections!.map((section) => (
            <View key={section.category} style={styles.section}>
              <Text style={styles.sectionTitle}>{categoryLabel(t, section.category)}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionRow}>
                {section.items.map((item) => (
                  <ArticleCoverCard
                    key={item.id}
                    item={item}
                    onPress={() => navigation.navigate("KnowledgeArticle", { slug: item.slug, title: item.title })}
                  />
                ))}
              </ScrollView>
            </View>
          ))
        )}
      </ScrollView>
    </GradientBackground>
  );
}

// Alena flagged the cards as too small next to the site's Knowledge Hub
// grid (screen recording she sent) - sized relative to the screen instead
// of a small fixed box so each card reads as a real article tile, not a
// thumbnail.
const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.72);
const CARD_HEIGHT = Math.round(CARD_WIDTH * 0.72);

// Split out of the section-row map (Sept 2026): Alena's side-by-side
// comparison showed real cover photos with the title sitting right on the
// photo (a soft gradient fade, not a flat dark block), vs. what the app
// was actually rendering - a plain gray box with the title in a
// hard-edged solid rgba rectangle UNDERNEATH it, because the old inline
// JSX always rendered that rectangle regardless of whether the <Image>
// above it had actually loaded anything. A failed/never-resolving image
// (this app's REFERENCE_ARTICLE_COVERS entries mirror the website's own
// hardcoded list 1:1, but if a given file was ever moved/renamed on the
// server since - see the comment on REFERENCE_ARTICLE_COVERS - the app has
// no way to know until the request actually fails) left the Image blank,
// so all that was visible was the card's own gray backgroundColor plus
// that dark rectangle sitting on top of nothing. This component (a) tracks
// its own photoFailed state so a failed load falls back to an intentional
// placeholder instead of a blank Image, and (b) only draws the photo
// scrim when a photo is actually showing, as a real LinearGradient
// (transparent -> dark) instead of a flat-opacity block, so the title
// reads as sitting on the photo rather than in a box glued below it.
function ArticleCoverCard({
  item,
  onPress,
}: {
  item: ArticleSummary;
  onPress: () => void;
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const coverPath = resolveCover(item);
  const hasCover = Boolean(coverPath) && !photoFailed;
  return (
    <Pressable style={styles.card} onPress={onPress}>
      {hasCover ? (
        <Image
          source={{ uri: `${SITE_BASE_URL}${coverPath}` }}
          style={styles.cover}
          onError={() => setPhotoFailed(true)}
        />
      ) : (
        <View style={[styles.cover, styles.coverPlaceholder]}>
          <Feather name="book-open" size={28} color={colors.blue} />
        </View>
      )}
      {hasCover ? (
        <LinearGradient
          colors={["transparent", "rgba(2,8,23,0.85)"]}
          locations={[0, 1]}
          style={styles.scrim}
        />
      ) : null}
      <Text style={[styles.cardTitle, !hasCover && styles.cardTitleOnPlaceholder]} numberOfLines={3}>
        {item.title}
      </Text>
    </Pressable>
  );
}

// Same onError-fallback fix as ArticleCoverCard above, for the small
// search-result thumbnail - a failed load previously left a blank square
// instead of the same book-icon placeholder a missing cover already gets.
function SearchResultRow({
  item,
  categoryText,
  onPress,
}: {
  item: ArticleSummary;
  categoryText: string;
  onPress: () => void;
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const coverPath = resolveCover(item);
  const hasCover = Boolean(coverPath) && !photoFailed;
  return (
    <Pressable style={styles.searchRow} onPress={onPress}>
      {hasCover ? (
        <Image
          source={{ uri: `${SITE_BASE_URL}${coverPath}` }}
          style={styles.searchThumb}
          onError={() => setPhotoFailed(true)}
        />
      ) : (
        <View style={[styles.searchThumb, styles.coverPlaceholder]}>
          <Feather name="book-open" size={20} color={colors.blue} />
        </View>
      )}
      <View style={styles.searchRowBody}>
        <Text style={styles.searchRowTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.searchRowCategory}>{categoryText}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  content: { padding: spacing.lg },
  center: { paddingVertical: spacing.xl * 2, alignItems: "center", justifyContent: "center" },
  errorText: { color: colors.danger },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.ink },
  searchList: { gap: spacing.sm },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
  },
  searchThumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.line },
  searchRowBody: { flex: 1 },
  searchRowTitle: { fontSize: 14.5, fontWeight: "700", color: colors.ink, lineHeight: 19 },
  searchRowCategory: { fontSize: 12.5, color: colors.muted, marginTop: 3 },
  section: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: colors.ink, marginBottom: spacing.sm },
  sectionRow: { gap: spacing.sm, paddingRight: spacing.sm },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.line,
    justifyContent: "flex-end",
  },
  cover: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  // No photo (or it failed to load) - a deliberate tinted placeholder
  // instead of a blank Image sitting on the card's own gray background.
  coverPlaceholder: { alignItems: "center", justifyContent: "center", backgroundColor: colors.tint },
  // Gradient (not a flat-opacity block) so the title reads as sitting on
  // the photo itself, same idea as CatalogScreen's swipe-card overlay -
  // only rendered when a real photo is actually showing (see
  // ArticleCoverCard) since a flat placeholder needs no scrim at all.
  scrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "70%",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.white,
    padding: spacing.md,
    lineHeight: 19,
  },
  // Placeholder has no photo/scrim behind it, so white text would be
  // unreadable on its light tint - dark ink instead, same as the rest of
  // the app's no-photo states (e.g. CatalogScreen's cardPhotoPlaceholder).
  cardTitleOnPlaceholder: { color: colors.ink },
});
