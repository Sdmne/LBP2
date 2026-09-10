import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { fetchArticle, type ArticleDetail } from "../api/articles";
import { categoryLabel } from "./KnowledgeHubScreen";
import { ApiError } from "../api/client";
import { SITE_BASE_URL } from "../config";
import { useI18n } from "../i18n/I18nContext";
import { colors, spacing } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = NativeStackScreenProps<RootStackParamList, "KnowledgeArticle">;

// Real article body from GET /api/public/articles/{locale}/{slug}
// (body_html - see api/articles.ts). RN has no built-in HTML renderer and
// this app has no WebView/render-html dependency installed (checked
// package.json - none present, and this environment can't reach the npm
// registry to add one), so htmlToBlocks() below does a plain-text
// conversion: paragraphs and list items become separate lines, headings get
// bold, everything else is stripped. Good enough to read the article;
// nowhere near as polished as the site's real HTML rendering. Revisit if/
// when a WebView-capable package can actually be installed.
function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "’")
    .replace(/&lsquo;/g, "‘")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–");
}

type Block = { text: string; heading?: boolean; bullet?: boolean };

function htmlToBlocks(html: string): Block[] {
  const withBreaks = html
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ");
  const headingMatches = new Set<string>();
  withBreaks.replace(/<h[1-3][^>]*>([\s\S]*?)(?=\n|$)/gi, (_m, inner) => {
    headingMatches.add(decodeEntities(inner.replace(/<[^>]+>/g, "").trim()));
    return "";
  });
  const plain = withBreaks.replace(/<[^>]+>/g, "");
  return plain
    .split("\n")
    .map((line) => decodeEntities(line).trim())
    .filter((line) => line.length > 0)
    .map((line) => ({
      text: line,
      heading: headingMatches.has(line),
      bullet: line.startsWith("• "),
    }));
}

export default function KnowledgeArticleScreen({ route }: Props) {
  const { slug } = route.params;
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchArticle(locale, slug)
      .then((result) => {
        if (alive) setArticle(result);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof ApiError && err.status === 404 ? t("knowledgeArticle.unavailable") : t("knowledgeHub.loadError"));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [locale, slug, t]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.pink} />
      </View>
    );
  }

  if (error || !article) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || t("knowledgeArticle.unavailable")}</Text>
      </View>
    );
  }

  const blocks = htmlToBlocks(article.body_html || "");
  const publishedDate = article.published_at
    ? new Date(article.published_at).toLocaleDateString(locale === "ru" ? "ru-RU" : locale === "es" ? "es-ES" : "en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}>
      {article.cover_url ? <Image source={{ uri: `${SITE_BASE_URL}${article.cover_url}` }} style={styles.cover} /> : null}
      <View style={styles.body}>
        <View style={styles.metaRow}>
          <Text style={styles.categoryPill}>{categoryLabel(t, article.category)}</Text>
          {publishedDate ? <Text style={styles.meta}>{publishedDate}</Text> : null}
        </View>
        <Text style={styles.title}>{article.title}</Text>
        <Text style={styles.meta}>{article.views ?? 0} {t("knowledgeArticle.views")}</Text>
      <View style={styles.blocks}>
        {blocks.map((block, index) => (
          <Text key={index} style={[styles.paragraph, block.heading && styles.heading, block.bullet && styles.bullet]}>
            {block.text}
          </Text>
        ))}
      </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: spacing.xl },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, backgroundColor: colors.bg },
  errorText: { color: colors.danger, textAlign: "center" },
  cover: { width: "100%", height: 220, backgroundColor: colors.line },
  body: { paddingHorizontal: 20, paddingTop: 18 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  categoryPill: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.pink,
    backgroundColor: colors.tintPink,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
  },
  title: { fontSize: 21, fontWeight: "800", color: colors.ink, lineHeight: 27, marginBottom: 14 },
  meta: { fontSize: 12, color: colors.muted },
  blocks: { marginTop: spacing.lg, gap: spacing.sm },
  paragraph: { fontSize: 14.5, color: colors.text, lineHeight: 22 },
  heading: { fontSize: 17, fontWeight: "800", color: colors.ink, marginTop: spacing.sm },
  bullet: { paddingLeft: spacing.xs },
});
