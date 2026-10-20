import type { ApiClient } from "./api";

type ArticleRow = Record<string, unknown>;
type ArticlePage = {
  items: ArticleRow[];
  total: number;
  hasMore?: boolean;
};

const record = (value: unknown): ArticleRow =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as ArticleRow
    : {};

export function normalizeArticleCategory(value: unknown): string {
  const slug = String(value ?? "").trim().toLowerCase();
  return slug === "ivf" ? "ivf-in-vitro-fertilization" : slug;
}

export function articleCategoryTranslation(item: ArticleRow, locale: string): string {
  const meta = record(item.meta);
  const categories = [record(item.category), record(meta.category)];
  const translations = [item.categoryTranslations, ...categories.map((category) => category.translations)]
    .flatMap((value) => Array.isArray(value) ? value : []);
  for (const value of translations) {
    const translation = record(value);
    if (String(translation.locale ?? "").trim().toLowerCase() === locale.toLowerCase()) {
      const name = String(translation.name ?? "").trim();
      if (name) return name;
    }
  }
  return "";
}

export function normalizeArticle(item: ArticleRow): ArticleRow {
  const meta = record(item.meta);
  const category = record(item.category);
  const metaCategory = record(meta.category);
  const translation = record(meta.selectedTranslation);
  const categorySlug = normalizeArticleCategory(
    category.slug ?? item.categorySlug ?? category.name
      ?? (typeof item.category === "string" ? item.category : undefined)
      ?? metaCategory.slug ?? metaCategory.name ?? meta.categorySlug,
  );
  const views = Number(item.views ?? item.viewCount ?? meta.views ?? meta.viewCount ?? meta.viewsCount ?? 0);
  return {
    ...item,
    id: item.id ?? item.slug,
    categorySlug,
    categoryName: category.name ?? item.categoryName ?? metaCategory.name ?? meta.categoryName ?? "",
    coverUrl: item.coverUrl || item.cover_url || item.coverImageUrl || translation.coverImageUrl || "",
    publishedAt: item.publishedAt ?? item.published_at ?? meta.publishedAt ?? item.created_at,
    views: Number.isFinite(views) ? Math.max(0, views) : 0,
  };
}

export async function loadKnowledgeArticles(api: Pick<ApiClient, "get">, locale: string): Promise<ArticleRow[]> {
  const items: ArticleRow[] = [];
  const seen = new Set<string>();
  let offset = 0;
  while (true) {
    const page = await api.get<ArticlePage>(
      `/public/articles?locale=${encodeURIComponent(locale)}&limit=100&offset=${offset}`,
    );
    const previousCount = items.length;
    for (const source of page.items) {
      const item = normalizeArticle(source);
      const key = String(item.slug ?? item.id);
      if (!seen.has(key)) {
        seen.add(key);
        items.push(item);
      }
    }
    offset += page.items.length;
    const hasMore = page.hasMore ?? offset < page.total;
    if (!hasMore) return items;
    if (!page.items.length || items.length === previousCount) {
      throw new Error("Article pagination did not advance");
    }
  }
}
