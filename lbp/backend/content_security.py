"""Allow-listed rich content for editor writes and historical content reads."""

import json
import re
from urllib.parse import urlsplit

import bleach
import tinycss2
from bleach.css_sanitizer import CSSSanitizer

CONTENT_TAGS = {
    "a", "b", "blockquote", "br", "caption", "code", "col", "colgroup",
    "dd", "del", "div", "dl", "dt", "em", "figcaption", "figure", "h1",
    "h2", "h3", "h4", "h5", "h6", "hr", "i", "iframe", "img", "li",
    "ol", "p", "pre", "s", "small", "span", "strike", "strong", "sub",
    "sup", "table", "tbody", "td", "th", "thead", "tfoot", "tr", "u", "ul",
}
CONTENT_STYLES = {
    "background-color", "border", "border-color", "border-style", "border-width",
    "border-collapse", "border-spacing", "color", "font-family", "font-size",
    "font-style", "font-weight", "height", "line-height", "list-style-type",
    "margin", "margin-bottom", "margin-left", "margin-right", "margin-top",
    "max-width", "padding", "padding-bottom", "padding-left", "padding-right",
    "padding-top", "text-align", "text-decoration", "vertical-align",
    "white-space", "width",
}
RASTER_DATA_IMAGE = re.compile(
    r"data:image/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/\s]*={0,2}", re.IGNORECASE
)
YOUTUBE_HOSTS = {"www.youtube.com", "youtube.com", "www.youtube-nocookie.com", "youtube-nocookie.com"}
HTML_FIELDS = {"body_html", "bodyHtml", "contentHtml"}
TEXT_FIELDS = {"title", "excerpt", "description", "metaTitle", "metaDescription", "seoTitle", "seoDescription"}


def safe_style_tokens(tokens) -> bool:
    for token in tokens:
        if token.type == "url":
            return False
        if token.type == "function":
            if token.name.lower() in {"url", "expression", "var", "image", "image-set", "-webkit-image-set"}:
                return False
            if not safe_style_tokens(token.arguments):
                return False
    return True


class ContentCSSSanitizer(CSSSanitizer):
    def sanitize_css(self, style):
        cleaned = super().sanitize_css(style)
        tokens = tinycss2.parse_declaration_list(cleaned, skip_comments=True, skip_whitespace=True)
        return tinycss2.serialize([token for token in tokens if token.type == "declaration" and safe_style_tokens(token.value)])


def safe_content_url(value: str, *, image: bool = False, frame: bool = False) -> bool:
    value = value.strip()
    if image and RASTER_DATA_IMAGE.fullmatch(value):
        return True
    try:
        parsed = urlsplit(value)
        if frame:
            return (
                parsed.scheme.lower() == "https"
                and parsed.hostname in YOUTUBE_HOSTS
                and not parsed.username and not parsed.password
                and parsed.port in {None, 443}
                and re.fullmatch(r"/embed/[A-Za-z0-9_-]+", parsed.path) is not None
            )
        return parsed.scheme.lower() in ({"", "http", "https"} if image else {"", "http", "https", "mailto", "tel"})
    except ValueError:
        return False


def content_attribute(tag: str, name: str, value: str) -> bool:
    if name in {"style", "class", "title", "lang", "dir"}:
        return True
    if tag == "a":
        if name == "href":
            return safe_content_url(value)
        return name == "rel"
    if tag == "img":
        if name == "src":
            return safe_content_url(value, image=True)
        return name in {"alt", "width", "height", "loading"}
    if tag == "iframe":
        if name == "src":
            return safe_content_url(value, frame=True)
        return name in {"width", "height", "allowfullscreen", "loading"}
    if tag in {"td", "th", "col", "colgroup"}:
        return name in {"colspan", "rowspan", "span", "scope", "width", "height"}
    if tag in {"ul", "ol", "li"}:
        return name in {"start", "value", "type"}
    return False


def sanitize_content_html(value: str) -> str:
    # Cleaner/parser instances are request-local: Bleach cleaners are not thread-safe.
    return bleach.clean(
        value, tags=CONTENT_TAGS, attributes=content_attribute,
        protocols={"http", "https", "mailto", "tel", "data"},
        strip=True, strip_comments=True,
        css_sanitizer=ContentCSSSanitizer(allowed_css_properties=CONTENT_STYLES),
    )


def sanitize_content_metadata(value):
    if isinstance(value, list):
        return [sanitize_content_metadata(item) for item in value]
    if not isinstance(value, dict):
        return value
    result = {}
    for key, item in value.items():
        if isinstance(item, str) and key in HTML_FIELDS:
            result[key] = sanitize_content_html(item)
        elif isinstance(item, str) and key in TEXT_FIELDS:
            result[key] = bleach.clean(item, tags=set(), attributes={}, strip=True, strip_comments=True)
        else:
            result[key] = sanitize_content_metadata(item)
    return result


def sanitize_content_values(values: dict) -> dict:
    result = sanitize_content_metadata(values)
    for key in {"meta", "data"}:
        item = result.get(key)
        if isinstance(item, str):
            try:
                result[key] = json.dumps(sanitize_content_metadata(json.loads(item)), ensure_ascii=False)
            except (TypeError, ValueError):
                # Preserve malformed legacy metadata for its existing consumer/fallback.
                pass
    return result
