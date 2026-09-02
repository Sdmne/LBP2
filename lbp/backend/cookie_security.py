import base64
import hashlib
import json
from typing import Any

from cryptography.fernet import Fernet, InvalidToken


CONSENT_LEVELS = {
    "necessary": {"necessary": True, "preferences": False, "statistics": False},
    "preferences": {"necessary": True, "preferences": True, "statistics": False},
    "analytics": {"necessary": True, "preferences": False, "statistics": True},
    "all": {"necessary": True, "preferences": True, "statistics": True},
}


def decode_consent_level(value: str | None) -> dict[str, bool] | None:
    preferences = CONSENT_LEVELS.get(value or "")
    return dict(preferences) if preferences else None


def encode_consent_level(value: Any) -> str:
    source = value if isinstance(value, dict) else {}
    preferences = bool(source.get("preferences"))
    statistics = bool(source.get("statistics"))
    if preferences and statistics:
        return "all"
    if preferences:
        return "preferences"
    if statistics:
        return "analytics"
    return "necessary"


class CookieCipher:
    def __init__(self, secret: str):
        normalized = secret.strip()
        if len(normalized) < 32:
            raise ValueError("COOKIE_ENCRYPTION_SECRET must contain at least 32 characters")
        key = base64.urlsafe_b64encode(hashlib.sha256(normalized.encode("utf-8")).digest())
        self._fernet = Fernet(key)

    def encrypt(self, purpose: str, value: Any) -> str:
        envelope = {
            "version": 1,
            "purpose": purpose,
            "value": value,
        }
        payload = json.dumps(envelope, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        return self._fernet.encrypt(payload).decode("ascii")

    def decrypt(self, purpose: str, token: str | None) -> Any | None:
        if not isinstance(token, str) or not token or len(token) > 8192:
            return None
        try:
            payload = self._fernet.decrypt(token.encode("ascii"))
            envelope = json.loads(payload.decode("utf-8"))
        except (InvalidToken, UnicodeError, json.JSONDecodeError, ValueError, TypeError):
            return None
        if not isinstance(envelope, dict):
            return None
        if envelope.get("version") != 1 or envelope.get("purpose") != purpose:
            return None
        return envelope.get("value")
