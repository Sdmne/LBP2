import { api } from "./client";

// GET /api/public/articles and /api/public/articles/{locale}/{slug} -
// public_articles() / public_article() in main.py. Real, live, DB-backed
// content (no auth needed, same as clinics/lawyers) - not the website's own
// separate `referenceKnowledgeArticles` static seed file, which the site's
// KnowledgeHub component actually renders from instead of this endpoint
// (traced in ui.tsx: the live fetch's result is computed but never used for
// the grid). This app calls the real endpoint directly rather than copying
// that static file, so it always reflects whatever is actually published.

export type ArticleSummary = {
  id: number | string;
  slug: string;
  title: string;
  excerpt: string;
  cover_url: string | null;
  category: string;
  published_at: string | null;
  views: number;
};

export type ArticleDetail = ArticleSummary & {
  body_html: string;
};

export type ArticlesPage = {
  items: ArticleSummary[];
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
  categories: string[];
};

export function fetchArticles(params: { locale: string; category?: string; limit?: number; offset?: number }) {
  const search = new URLSearchParams();
  search.set("locale", params.locale);
  if (params.category) search.set("category", params.category);
  search.set("limit", String(params.limit ?? 12));
  search.set("offset", String(params.offset ?? 0));
  return api.get<ArticlesPage>(`/api/public/articles?${search.toString()}`);
}

export function fetchArticle(locale: string, slug: string) {
  return api.get<ArticleDetail>(`/api/public/articles/${encodeURIComponent(locale)}/${encodeURIComponent(slug)}`);
}
