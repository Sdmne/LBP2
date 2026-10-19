import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import seoCopy from "../../backend/seo-copy.json";

const locales = ["en", "ru", "es", "pt", "fr", "de", "it", "pl"] as const;
type Locale = (typeof locales)[number];

const routeLabels: Record<string, Record<Locale, string>> = seoCopy.labels;

const descriptions: Record<Locale, string> = seoCopy.descriptions;

const privateRoutes = new Set(["auth", "profile", "settings", "messages", "chat", "likes", "visitors", "favourites", "blocked", "subscription", "boost", "referral", "community", "verification", "photos", "account", "family-room", "ai-advisor", "compatibility", "compatibility-report", "safety-checkin", "video-verification"]);

function localeFromPath(pathname: string): Locale {
  const candidate = pathname.split("/").filter(Boolean)[0] as Locale | undefined;
  return candidate && locales.includes(candidate) ? candidate : "en";
}

function readableSlug(value: string) {
  let decoded = value || "";
  try { decoded = decodeURIComponent(decoded); } catch { /* Preserve malformed route text without crashing navigation. */ }
  return decoded
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function upsertMeta(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"][data-route-seo]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    element.dataset.routeSeo = "true";
    document.head.appendChild(element);
  }
  element.content = content;
  return element;
}

export function RouteSeo() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.head.querySelectorAll("[data-route-seo], [data-server-seo]").forEach((element) => element.remove());
    const parts = pathname.split("/").filter(Boolean);
    const locale = localeFromPath(pathname);
    document.documentElement.lang = locale;
    const route = parts[1] || "home";
    const isArticle = route === "knowledge-hub" && Boolean(parts[2]);
    if (isArticle) return;

    const nestedLabel = routeLabels[`${route}/${parts[2]}`]?.[locale];
    const baseLabel = routeLabels[route]?.[locale] || readableSlug(route) || routeLabels.home[locale];
    const label = nestedLabel || (parts[2] ? `${baseLabel} — ${readableSlug(parts.at(-1) || "")}` : baseLabel);
    const title = `${label} | LetsBeParents`;
    const description = `${label}. ${descriptions[locale]}`;
    const canonical = `${window.location.origin}${pathname.replace(/\/$/, "") || `/${locale}`}`;
    const suffix = parts.length > 1 ? `/${parts.slice(1).join("/")}` : "";
    const localeTag: Record<Locale, string> = { en: "en_US", ru: "ru_RU", es: "es_ES", pt: "pt_PT", fr: "fr_FR", de: "de_DE", it: "it_IT", pl: "pl_PL" };

    document.documentElement.lang = locale;
    document.title = title;
    upsertMeta("name", "description", description);
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:url", canonical);
    const image = new URL(seoCopy.defaultImage, window.location.origin).href;
    upsertMeta("property", "og:image", image);
    upsertMeta("property", "og:site_name", "LetsBeParents");
    upsertMeta("property", "og:locale", localeTag[locale]);
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", image);
    if (privateRoutes.has(route)) upsertMeta("name", "robots", "noindex, nofollow");

    const canonicalLink = document.createElement("link");
    canonicalLink.rel = "canonical";
    canonicalLink.href = canonical;
    canonicalLink.dataset.routeSeo = "true";
    document.head.appendChild(canonicalLink);
    for (const alternateLocale of locales) {
      const alternate = document.createElement("link");
      alternate.rel = "alternate";
      alternate.hreflang = alternateLocale;
      alternate.href = `${window.location.origin}/${alternateLocale}${suffix}`;
      alternate.dataset.routeSeo = "true";
      document.head.appendChild(alternate);
    }
    const fallback = document.createElement("link");
    fallback.rel = "alternate";
    fallback.hreflang = "x-default";
    fallback.href = `${window.location.origin}/en${suffix}`;
    fallback.dataset.routeSeo = "true";
    document.head.appendChild(fallback);
  }, [pathname]);

  return null;
}
