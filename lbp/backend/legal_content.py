"""Localized legal copy tied to the exact published English document."""

from functools import lru_cache
import hashlib
import json
from pathlib import Path


@lru_cache(maxsize=1)
def _translations():
    path = Path(__file__).with_name("legal-translations.json")
    if not path.is_file():
        return {}
    rows = json.loads(path.read_text(encoding="utf-8"))
    return {(row["locale"], row["slug"]): row for row in rows}


def localized_legal_page(locale, slug, original):
    if original.get("locale") != "en" or locale == "en":
        return original
    translation = _translations().get((locale, slug))
    if not translation:
        return original
    source = original["title"] + "\0" + original["body_html"]
    digest = hashlib.sha256(source.encode("utf-8")).hexdigest()
    if digest != translation["sourceSha256"]:
        return original
    return {
        **original,
        "locale": locale,
        "title": translation["title"],
        "body_html": translation["body_html"],
    }
