"""Public metadata rendered into the current frontend shell, without private data."""
import html
import json
import re
from pathlib import Path
from urllib.parse import quote, unquote, urljoin, urlsplit

COPY = json.loads(Path(__file__).with_name("seo-copy.json").read_text(encoding="utf-8"))
LOCALES = tuple(COPY["locales"])
PUBLIC_ROUTES = (
    "", "knowledge-hub", "clinics", "lawyers", "resources", "professionals",
    "trust-safety", "pricing", "contact", "terms-of-use", "privacy-policy", "delete-account",
)
HTML_ROUTES = (*PUBLIC_ROUTES, "auth/login", "auth/register", "auth/signup", "auth/forgot-password")


def public_origin(value):
    parsed = urlsplit(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("An explicit HTTPS public application origin is required")
    if parsed.path not in ("", "/") or parsed.query or parsed.fragment:
        raise ValueError("Public application origin must not contain a path, query or fragment")
    return f"https://{parsed.netloc}"


def parse_public_path(path):
    if not isinstance(path, str) or len(path) > 512 or "?" in path or "#" in path:
        raise ValueError("Invalid public path")
    parts = path.strip("/").split("/")
    if not parts or parts[0] not in LOCALES or any(not p or p in (".", "..") for p in parts):
        raise ValueError("Invalid public path")
    locale = parts[0]
    route = "/".join(parts[1:])
    is_article = len(parts) == 3 and parts[1] == "knowledge-hub"
    is_nested = len(parts) in (3, 4) and parts[1] in ("clinics", "lawyers", "resources", "find-your-path")
    if route not in HTML_ROUTES and not is_article and not is_nested:
        raise ValueError("Unsupported public route")
    for part in parts[1:]:
        decoded = unquote(part)
        if not re.fullmatch(r"[\w-]+", decoded, flags=re.UNICODE):
            raise ValueError("Invalid public path segment")
    return locale, route, is_article


def plain_text(value, limit=320):
    text = re.sub(r"<[^>]*>", " ", str(value or ""))
    return re.sub(r"\s+", " ", html.unescape(text)).strip()[:limit]


def image_url(value, origin):
    if not str(value or "").strip():
        return origin + COPY["defaultImage"]
    candidate = urljoin(origin + "/", str(value or ""))
    parsed = urlsplit(candidate)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        return origin + COPY["defaultImage"]
    return candidate


def page_metadata(path, origin, article=None):
    origin = public_origin(origin)
    locale, route, is_article = parse_public_path(path)
    parts = route.split("/") if route else ["home"]
    label = COPY["labels"].get(route, COPY["labels"].get(parts[0], {})).get(locale)
    if not label:
        label = unquote(parts[-1]).replace("-", " ").replace("_", " ").title()
    if len(parts) > 1 and route not in COPY["labels"]:
        label += " — " + unquote(parts[-1]).replace("-", " ").replace("_", " ").title()
    title = label + " | LetsBeParents"
    description = label + ". " + COPY["descriptions"][locale]
    image = origin + COPY["defaultImage"]
    if is_article and article:
        meta = article.get("meta") if isinstance(article.get("meta"), dict) else {}
        title = plain_text(article.get("title"), 240) or title
        description = plain_text(article.get("excerpt") or article.get("body_html")) or description
        image = image_url(article.get("cover_url") or article.get("coverUrl") or meta.get("coverImageUrl"), origin)
    canonical = origin + "/" + "/".join(quote(unquote(p), safe="-") for p in path.strip("/").split("/"))
    return {
        "locale": locale, "title": title, "description": description, "image": image,
        "canonical": canonical, "type": "article" if is_article else "website",
        "private": route.startswith("auth/"), "article": article if is_article else None,
    }


def render_page_html(shell, metadata):
    if '<div id="root"' not in shell or "/assets/" not in shell or "</head>" not in shell:
        raise ValueError("Frontend shell is unavailable or invalid")
    esc = lambda value: html.escape(str(value), quote=True)
    title = esc(metadata["title"])
    shell = re.sub(r"<title>.*?</title>", lambda _: f"<title>{title}</title>", shell, count=1, flags=re.DOTALL)
    shell = re.sub(r'<html\b[^>]*>', f'<html lang="{esc(metadata["locale"])}">', shell, count=1)
    tags = []
    def meta(attr, name, content):
        tags.append(f'<meta {attr}="{esc(name)}" content="{esc(content)}" data-server-seo="true"/>')
    meta("name", "description", metadata["description"])
    for name, value in {
        "og:title": metadata["title"], "og:description": metadata["description"],
        "og:url": metadata["canonical"], "og:image": metadata["image"],
        "og:type": metadata["type"], "og:site_name": "LetsBeParents",
        "og:locale": COPY["localeTags"][metadata["locale"]],
    }.items():
        meta("property", name, value)
    for name, value in {
        "twitter:card": "summary_large_image", "twitter:title": metadata["title"],
        "twitter:description": metadata["description"], "twitter:image": metadata["image"],
    }.items():
        meta("name", name, value)
    if metadata["private"]:
        meta("name", "robots", "noindex, nofollow")
    tags.append(f'<link rel="canonical" href="{esc(metadata["canonical"])}" data-server-seo="true"/>')
    return shell.replace("</head>", "".join(tags) + "</head>", 1)


def render_sitemap(origin, articles):
    origin = public_origin(origin)
    paths = {f"/{locale}" + (f"/{route}" if route else "") for locale in LOCALES for route in PUBLIC_ROUTES}
    for article in articles:
        locale, slug = article.get("locale"), str(article.get("slug") or "")
        if locale in LOCALES and re.fullmatch(r"[\w-]+", slug, flags=re.UNICODE):
            paths.add(f"/{locale}/knowledge-hub/{quote(slug, safe='-')}")
    entries = "".join(f"<url><loc>{html.escape(origin + path)}</loc></url>" for path in sorted(paths))
    return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + entries + "</urlset>"
