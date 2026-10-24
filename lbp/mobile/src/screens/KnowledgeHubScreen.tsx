import React, { createRef, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ScrollView } from "react-native-gesture-handler";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import type { ArticleSummary } from "../api/articles";
import { groupKnowledgeArticles, knowledgeCategory, KNOWLEDGE_CATEGORIES, loadKnowledgeArticles, type KnowledgeSection } from "../utils/knowledgeHub";
import { REFERENCE_ARTICLE_COVERS } from "../data/referenceArticleCovers";
import { SITE_BASE_URL } from "../config";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GradientBackground from "../components/GradientBackground";
import AppHeader from "../components/AppHeader";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function categoryLabel(t: (key: string) => string, slug: string): string {
  const category = knowledgeCategory(slug);
  return KNOWLEDGE_CATEGORIES.includes(category) ? t(`knowledgeHub.category.${category}`) : slug;
}

// See the comment at its call sites: the live API often has no cover_url,
// the site's own same-slug photo is the fallback.
function resolveCover(item: ArticleSummary): string | null {
  return item.cover_url?.trim() || REFERENCE_ARTICLE_COVERS[item.slug] || null;
}

// Alena, 2026-09-24: "на сайте почти все есть" (the website shows almost
// every cover photo) confirmed the DB rows/files are fine - this app was
// the only place they were broken. Root cause: the website's own cover
// logic (normalizeArticle() in frontend/src/articles.ts) uses cover_url
// completely as-is as an <img src>, no prefixing at all - which only
// works because a browser resolves a root-relative path ("/uploads/...")
// against the page's own origin automatically. This screen was blindly
// prepending SITE_BASE_URL to every coverPath regardless of whether it
// was already a full "https://..." URL - harmless for a relative path,
// but for any cover_url that's already absolute (a plausible production
// setup: media served from its own host/CDN, or the older
// REFERENCE_ARTICLE_COVERS entries, which are already full paths) it
// produced a malformed, doubled-up URL that silently fails to load in
// RN's <Image>, with no visible error beyond the onError placeholder.
// A website <img> never had this problem because it never prefixes
// anything - so this only ever showed up on mobile.
function coverUri(coverPath: string | null): string {
  if (!coverPath) return "";
  return new URL(coverPath, `${SITE_BASE_URL}/`).toString();
}


export default function KnowledgeHubScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { t, locale } = useI18n();
  const [sections, setSections] = useState<KnowledgeSection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [allItems, setAllItems] = useState<ArticleSummary[]>([]);
  const pageScrollRef = useRef<ScrollView>(null);
  const rowScrollRefs = useMemo(
    () => Object.fromEntries((sections ?? []).map(({ category }) => [category, createRef<ScrollView>()])),
    [sections],
  );

  useEffect(() => {
    let alive = true;
    setSections(null);
    setAllItems([]);
    setError(null);
    loadKnowledgeArticles(locale)
      .then((items) => {
        if (!alive) return;
        setSections(groupKnowledgeArticles(items));
        setAllItems(items);
        if (items.length === 0) setError(t("knowledgeHub.empty"));
      })
      .catch(() => {
        if (alive) setError(t("knowledgeHub.loadError"));
      });
    return () => { alive = false; };
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
        ref={pageScrollRef}
        simultaneousHandlers={Object.values(rowScrollRefs)}
        disallowInterruption={false}
        nestedScrollEnabled
        directionalLockEnabled
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
      >
        <AppHeader
          contentInset={spacing.lg}
          title={t("nav.knowledgeHubTitle")}
          onBackPress={() => navigation.goBack()}
          onAvatarPress={() => navigation.popTo("MainTabs", { screen: "Me" })}
        />

        {/* Search uses the same complete article list as the category rows. */}
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
              {/* Keep each row and the vertical page free to scroll independently. */}
              <ScrollView
                ref={rowScrollRefs[section.category]}
                simultaneousHandlers={[pageScrollRef, ...Object.entries(rowScrollRefs).filter(([category]) => category !== section.category).map(([, ref]) => ref)]}
                disallowInterruption={false}
                directionalLockEnabled
                contentInsetAdjustmentBehavior="never"
                automaticallyAdjustContentInsets={false}
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.sectionRow}
              >
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
  const [failedCoverUri, setFailedCoverUri] = useState<string | null>(null);
  const uri = coverUri(resolveCover(item));
  const hasCover = Boolean(uri) && uri !== failedCoverUri;
  return (
    <Pressable style={styles.card} onPress={onPress}>
      {hasCover ? (
        <Image
          source={{ uri }}
          style={styles.cover}
          onError={() => setFailedCoverUri(uri)}
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
  const [failedCoverUri, setFailedCoverUri] = useState<string | null>(null);
  const uri = coverUri(resolveCover(item));
  const hasCover = Boolean(uri) && uri !== failedCoverUri;
  return (
    <Pressable style={styles.searchRow} onPress={onPress}>
      {hasCover ? (
        <Image
          source={{ uri }}
          style={styles.searchThumb}
          onError={() => setFailedCoverUri(uri)}
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
  // Alena: "сверху избыточное кажется пустое пространство, над хедером" -
  // same double-top-padding issue as ExploreScreen (see its own comment on
  // this same style key) - `padding: spacing.lg` stacked with AppHeader's
  // own insets.top handling.
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
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
