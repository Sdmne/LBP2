import { fetchArticles, type ArticleSummary } from "../api/articles";

export const KNOWLEDGE_CATEGORIES = ["ivf", "co-parenting", "sperm-donor", "fertility", "lgbtq", "parenthood"];

export type KnowledgeSection = { category: string; items: ArticleSummary[] };

export function knowledgeCategory(category: string): string {
  const normalized = category.trim().toLowerCase();
  return normalized === "ivf-in-vitro-fertilization" ? "ivf" : normalized;
}

export function groupKnowledgeArticles(items: ArticleSummary[]): KnowledgeSection[] {
  const groups = new Map<string, ArticleSummary[]>();
  for (const item of items) {
    const category = knowledgeCategory(item.category);
    const group = groups.get(category) ?? [];
    group.push(item);
    groups.set(category, group);
  }
  const order = [...KNOWLEDGE_CATEGORIES, ...Array.from(groups.keys()).filter((category) => !KNOWLEDGE_CATEGORIES.includes(category))];
  return order.filter((category) => groups.has(category)).map((category) => ({ category, items: groups.get(category)! }));
}

export async function loadKnowledgeArticles(locale: string): Promise<ArticleSummary[]> {
  const items = new Map<ArticleSummary["id"], ArticleSummary>();
  let offset = 0;
  while (true) {
    const page = await fetchArticles({ locale, limit: 100, offset });
    for (const item of page.items) items.set(item.id, item);
    offset += page.items.length;
    if (!page.hasMore || offset >= page.total) return Array.from(items.values());
    if (page.items.length === 0) throw new Error("Incomplete article page");
  }
}
