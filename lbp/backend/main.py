import os
import base64
import html
import hashlib
import hmac
import io
import json
import logging
import re
import secrets
import shutil
import smtplib
import ssl
import uuid
import urllib.error
import urllib.parse
import urllib.request
from email.message import EmailMessage
from email.utils import formataddr
from pathlib import Path
from datetime import date, datetime, timedelta, timezone
from contextlib import contextmanager
from threading import Lock, Thread
from typing import Any, Literal

try:
    import bcrypt
except ImportError:  # pragma: no cover - optional until the image is rebuilt
    bcrypt = None

try:
    from PIL import Image, ImageOps, UnidentifiedImageError
except ImportError:  # pragma: no cover - optional until the image is rebuilt
    Image = None
    ImageOps = None
    UnidentifiedImageError = OSError

try:
    from google.cloud import vision
    from google.oauth2 import service_account
except ImportError:  # pragma: no cover - optional until the image is rebuilt
    vision = None
    service_account = None

import firebase_admin
import psycopg
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials as firebase_credentials
from auth_security import hash_password, password_needs_rehash, token_hash, verify_password
from cookie_security import CookieCipher, decode_consent_level, encode_consent_level
from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, Header, HTTPException, Query, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel, Field
from postgres_database import postgres_cursor


DB_CONFIG = {
    "host": os.getenv("DB_HOST", "db"),
    "port": int(os.getenv("DB_PORT", "5432")),
    "user": os.getenv("DB_USER", ""),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", ""),
    "options": "-c timezone=UTC",
}

security = HTTPBasic(auto_error=False)
ADMIN_API_USER = os.getenv("ADMIN_API_USER", "admin")
ADMIN_API_PASSWORD = os.getenv("ADMIN_API_PASSWORD")
ADMIN_TEST_USER = os.getenv("ADMIN_TEST_USER", "").strip()
ADMIN_TEST_PASSWORD = os.getenv("ADMIN_TEST_PASSWORD")
ADMIN_DISABLED_LOGIN_EMAILS = {
    email.strip().lower()
    for email in os.getenv("ADMIN_DISABLED_LOGIN_EMAILS", "").split(",")
    if email.strip()
}
ADMIN_SESSION_COOKIE = "lbp_admin_session"
ADMIN_SESSION_HOURS = 12
AMPLITUDE_API_KEY = os.getenv("AMPLITUDE_API_KEY", "").strip()
AMPLITUDE_USER_PROFILE_URL_TEMPLATE = os.getenv(
    "AMPLITUDE_USER_PROFILE_URL_TEMPLATE",
    "",
).strip()
PARTNER_API_PASSWORD = os.getenv("PARTNER_API_PASSWORD") or ADMIN_API_PASSWORD
PARTNER_SESSION_SECRET = os.getenv("PARTNER_SESSION_SECRET") or ADMIN_API_PASSWORD or ""
PARTNER_ACCOUNT_EMAIL = os.getenv("PARTNER_ACCOUNT_EMAIL", "").strip()
PARTNER_DEFAULT_ID = os.getenv("PARTNER_DEFAULT_ID", "").strip()
PARTNER_DEFAULT_CLINIC_ID = os.getenv("PARTNER_DEFAULT_CLINIC_ID", "").strip()
SESSION_DAYS = 7
COOKIE_CONSENT_DAYS = 180
COOKIE_ATTRIBUTION_DAYS = 90
COOKIE_LOCALE_DAYS = 365
COOKIE_SESSION_DAYS = 7
COOKIE_CONSENT_NAME = "lbp_consent"
COOKIE_CONSENT_ID_NAME = "lbp_consent_id"
COOKIE_ATTR_FIRST_NAME = "lbp_attr_first"
COOKIE_ATTR_LAST_NAME = "lbp_attr_last"
COOKIE_LOCALE_NAME = "NEXT_LOCALE"
COOKIE_SESSION_NAME = "__Secure-authjs.session-token"
COOKIE_LEGACY_SESSION_NAME = "authjs.session-token"
COOKIE_LEGACY_PREFERENCES_NAME = "lbp_cookie_preferences"
COOKIE_LEGACY_FREETIMBAT_NAMES = (
    "COMPANY_ID",
    "ID",
    "LOGIN",
    "PASSWORD",
    "REMEMBER_ME",
    "SCREEN_NAME",
)
COOKIE_CIPHER = CookieCipher(os.environ["COOKIE_ENCRYPTION_SECRET"])
EMAIL_VERIFICATION_HOURS = 24
PASSWORD_RESET_MINUTES = 60
AUTH_EMAIL_RESEND_SECONDS = 60
PARTNER_SESSION_DAYS = 30
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "/app/uploads"))
UPLOAD_URL_PREFIX = os.getenv("UPLOAD_URL_PREFIX", "/uploads")
PRIVATE_UPLOAD_DIR = Path(os.getenv("PRIVATE_UPLOAD_DIR", "/app/private/quarantine"))
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))
MAX_PROFILE_PHOTOS = 6
MAX_IMAGE_PIXELS = int(os.getenv("MAX_IMAGE_PIXELS", str(40_000_000)))
MIN_PROFILE_IMAGE_SIDE = int(os.getenv("MIN_PROFILE_IMAGE_SIDE", "256"))
ALLOWED_IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
ALLOWED_CHAT_ATTACHMENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
}
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "").strip()
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "").strip()
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "").strip()
CALL_RING_SECONDS = max(20, int(os.getenv("CALL_RING_SECONDS", "60")))
SUPPORT_PROFILE_SOURCE_ID = os.getenv("SUPPORT_PROFILE_SOURCE_ID", "").strip()
SUPPORT_PROFILE_NAME = "LetsBeParents Support"
SUPPORT_WELCOME_MESSAGE = "Welcome to LetsBeParents! We're here to help you. Feel free to ask us anything."
PARTNER_SERVICES_FILE = Path(__file__).with_name("partner_services.json")
CATALOG_LOCATIONS_FILE = Path(__file__).with_name("catalog_locations.json")
FREE_DAILY_LIKE_LIMIT = 3
PREMIUM_DAILY_LIKE_LIMIT = 15
FREE_DAILY_COLD_CHAT_LIMIT = 0
PREMIUM_DAILY_COLD_CHAT_LIMIT = 5
EXPECTED_FIREBASE_PROJECT_ID = os.getenv("EXPECTED_FIREBASE_PROJECT_ID", "").strip()
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "").strip()
FIREBASE_CREDENTIALS_PATH = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
FIREBASE_APP_NAME = EXPECTED_FIREBASE_PROJECT_ID or "lbp-firebase"
FIREBASE_APP_LOCK = Lock()
VISION_PROJECT_ID = os.getenv("VISION_PROJECT_ID", FIREBASE_PROJECT_ID or EXPECTED_FIREBASE_PROJECT_ID).strip()
VISION_CREDENTIALS_PATH = os.getenv("VISION_CREDENTIALS_PATH", "").strip()
VISION_ENABLED = os.getenv("VISION_ENABLED", "0").strip().lower() in {"1", "true", "yes", "on"}
VISION_TIMEOUT_SECONDS = max(1, int(os.getenv("VISION_TIMEOUT_SECONDS", "20")))
AUTOMATIC_PHOTO_RECHECK_LIMIT = max(1, int(os.getenv("AUTOMATIC_PHOTO_RECHECK_LIMIT", "100")))
VISION_CLIENT_LOCK = Lock()
VISION_CLIENT = None
DIDIT_API_BASE = os.getenv("DIDIT_API_BASE", "https://verification.didit.me/v3").rstrip("/")
DIDIT_API_KEY = os.getenv("DIDIT_API_KEY", "").strip()
DIDIT_WORKFLOW_ID = os.getenv("DIDIT_WORKFLOW_ID", "").strip()
DIDIT_WEBHOOK_SECRET = os.getenv("DIDIT_WEBHOOK_SECRET", "").strip()
DIDIT_ENABLED = os.getenv("DIDIT_ENABLED", "0").strip().lower() in {"1", "true", "yes", "on"}
PUBLIC_APP_URL = os.getenv("PUBLIC_APP_URL", "").rstrip("/")
DIDIT_TIMEOUT_SECONDS = int(os.getenv("DIDIT_TIMEOUT_SECONDS", "20"))
DIDIT_MAX_PORTRAIT_BYTES = 2 * 1024 * 1024
DIDIT_PORTRAIT_TRANSPORT_BYTES = max(
    6 * 1024,
    min(DIDIT_MAX_PORTRAIT_BYTES, int(os.getenv("DIDIT_PORTRAIT_TRANSPORT_BYTES", "9216"))),
)
SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip()
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", SMTP_USER).strip()
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "LetsBeParents").strip() or "LetsBeParents"
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "1").strip().lower() in {"1", "true", "yes", "on"}
SMTP_USE_SSL = os.getenv("SMTP_USE_SSL", "0").strip().lower() in {"1", "true", "yes", "on"}
SMTP_TIMEOUT_SECONDS = max(1, int(os.getenv("SMTP_TIMEOUT_SECONDS", "20")))
EMAIL_NOTIFICATIONS_ENABLED = os.getenv("EMAIL_NOTIFICATIONS_ENABLED", "1").strip().lower() in {"1", "true", "yes", "on"}
logger = logging.getLogger("uvicorn.error")
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]

CATALOG_PROFILE_TYPES = {
    "SINGLE_WOMAN",
    "SINGLE_MAN",
    "HETERO_COUPLE",
    "LESBIAN_COUPLE",
    "GAY_COUPLE",
}
CATALOG_DONOR_TYPES = {"SPERM", "EGG"}
CATALOG_LOOKING_FOR = {"CO_PARENTING_PARTNER", "SPERM_DONOR", "EGG_DONOR"}
CATALOG_ETHNICITIES = {
    "CAUCASIAN_WHITE",
    "AFRICAN_AMERICAN_BLACK",
    "HISPANIC_LATINO",
    "ASIAN_EAST",
    "ASIAN_SOUTH",
    "ASIAN_SOUTHEAST",
    "MIDDLE_EASTERN_ARAB",
    "ASHKENAZI_JEWISH",
    "SEPHARDIC_MIZRAHI_JEWISH",
    "NATIVE_AMERICAN",
    "PACIFIC_ISLANDER",
    "MIXED_MULTIRACIAL",
}
CATALOG_HAIR_COLORS = {
    "BLONDE",
    "LIGHT_BLONDE",
    "DARK_BLONDE",
    "STRAWBERRY_BLONDE",
    "AUBURN",
    "RED",
    "LIGHT_BROWN",
    "MEDIUM_BROWN",
    "DARK_BROWN",
    "BLACK",
    "GREY",
    "WHITE",
    "BALD_SHAVED",
}
CATALOG_EYE_COLORS = {"GREY", "LIGHT_BLUE", "BLUE", "GREEN", "YELLOW", "BROWN_HAZEL", "BLACK"}
CATALOG_EDUCATION = {
    "HIGH_SCHOOL",
    "SOME_COLLEGE",
    "VOCATIONAL",
    "ASSOCIATE",
    "BACHELORS",
    "MASTERS",
    "PHD",
    "PROFESSIONAL",
    "POSTDOCTORAL",
    "STUDENT",
    "PREFER_NOT_TO_SAY",
    "OTHER",
}
CATALOG_RELIGIONS = {
    "CHRISTIAN_ORTHODOX",
    "CHRISTIAN_CATHOLIC",
    "CHRISTIAN_PROTESTANT",
    "CHRISTIAN_OTHER",
    "MUSLIM_SUNNI",
    "MUSLIM_SHIA",
    "JEWISH_ORTHODOX",
    "JEWISH_CONSERVATIVE",
    "JEWISH_REFORM",
    "JEWISH_SECULAR",
    "HINDU",
    "BUDDHIST",
    "SIKH",
    "SHINTO",
    "SPIRITUAL",
    "NOT_RELIGIOUS",
}


def load_catalog_locations() -> dict[str, Any]:
    try:
        with CATALOG_LOCATIONS_FILE.open("r", encoding="utf-8") as source:
            payload = json.load(source)
    except (OSError, ValueError):
        return {"countries": [], "cities": {}, "source": "database", "sourceUrl": "", "license": ""}
    countries = payload.get("countries")
    cities = payload.get("cities")
    return {
        "countries": countries if isinstance(countries, list) else [],
        "cities": cities if isinstance(cities, dict) else {},
        "source": str(payload.get("source") or "GeoNames"),
        "sourceUrl": str(payload.get("sourceUrl") or "https://www.geonames.org/"),
        "license": str(payload.get("license") or "CC BY 4.0"),
    }


CATALOG_LOCATIONS = load_catalog_locations()
CATALOG_COUNTRY_LABELS = {
    str(item.get("value") or "").upper(): str(item.get("label") or item.get("value") or "")
    for item in CATALOG_LOCATIONS["countries"]
    if isinstance(item, dict) and item.get("value")
}
CATALOG_CITIES_BY_COUNTRY = CATALOG_LOCATIONS["cities"]

if EXPECTED_FIREBASE_PROJECT_ID and FIREBASE_PROJECT_ID and FIREBASE_PROJECT_ID != EXPECTED_FIREBASE_PROJECT_ID:
    raise RuntimeError(
        f"Refusing to start with Firebase project {FIREBASE_PROJECT_ID!r}; "
        f"expected {EXPECTED_FIREBASE_PROJECT_ID!r}"
    )

if EXPECTED_FIREBASE_PROJECT_ID and VISION_PROJECT_ID and VISION_PROJECT_ID != EXPECTED_FIREBASE_PROJECT_ID:
    raise RuntimeError(
        f"Refusing to start with Google Vision project {VISION_PROJECT_ID!r}; "
        f"expected {EXPECTED_FIREBASE_PROJECT_ID!r}"
    )

app = FastAPI(
    title="Elena LetsBeParents replacement API",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@contextmanager
def db_cursor(dictionary: bool = True):
    del dictionary
    with postgres_cursor(DB_CONFIG) as (conn, cursor):
        yield conn, cursor


def get_firebase_app():
    if not EXPECTED_FIREBASE_PROJECT_ID or FIREBASE_PROJECT_ID != EXPECTED_FIREBASE_PROJECT_ID:
        raise RuntimeError("The expected Firebase project is not configured")
    if not FIREBASE_CREDENTIALS_PATH:
        raise RuntimeError("Firebase credentials are not configured")

    try:
        return firebase_admin.get_app(FIREBASE_APP_NAME)
    except ValueError:
        pass

    with FIREBASE_APP_LOCK:
        try:
            return firebase_admin.get_app(FIREBASE_APP_NAME)
        except ValueError:
            credentials_path = Path(FIREBASE_CREDENTIALS_PATH)
            with credentials_path.open("r", encoding="utf-8") as credentials_file:
                credentials_data = json.load(credentials_file)
            credentials_project = str(credentials_data.get("project_id") or "").strip()
            if credentials_project != EXPECTED_FIREBASE_PROJECT_ID:
                raise RuntimeError(
                    f"Firebase credentials target {credentials_project!r}; "
                    f"expected {EXPECTED_FIREBASE_PROJECT_ID!r}"
                )
            return firebase_admin.initialize_app(
                firebase_credentials.Certificate(credentials_data),
                {"projectId": EXPECTED_FIREBASE_PROJECT_ID},
                name=FIREBASE_APP_NAME,
            )


def verify_firebase_token(id_token: str) -> dict[str, Any]:
    try:
        return firebase_auth.verify_id_token(id_token, app=get_firebase_app())
    except (
        firebase_auth.ExpiredIdTokenError,
        firebase_auth.InvalidIdTokenError,
        firebase_auth.RevokedIdTokenError,
    ) as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired Firebase session") from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Firebase authentication is unavailable") from exc


def fetch_count(cursor, table: str) -> int:
    cursor.execute(f"SELECT COUNT(*) AS cnt FROM `{table}`")
    row = cursor.fetchone()
    return int(row["cnt"])


def normalize_row(row: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in row.items()}


def json_value(value: Any) -> Any:
    if value is None or isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return value


def public_safe_data(value: Any) -> Any:
    data = json_value(value)
    deny = {
        "email",
        "phone",
        "phoneNumber",
        "mobile",
        "address",
        "password",
        "passwordHash",
        "lastLoginAt",
        "stripeCustomerId",
        "appleId",
        "googleId",
        "firebaseUid",
        "token",
        "tokens",
    }
    if isinstance(data, list):
        return [public_safe_data(item) for item in data]
    if isinstance(data, dict):
        safe = {}
        for key, item in data.items():
            if key in deny or "email" in key.lower() or "phone" in key.lower():
                continue
            safe[key] = public_safe_data(item)
        return safe
    return data


def int_or_none(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def catalog_token(value: Any) -> str:
    return re.sub(r"[^A-Z0-9]+", "_", str(value or "").strip().upper()).strip("_")


def catalog_enum_values(values: list[str] | None, allowed: set[str], field_name: str) -> list[str]:
    normalized: list[str] = []
    for raw_value in values or []:
        for item in str(raw_value).split(","):
            value = catalog_token(item)
            if not value or value in normalized:
                continue
            if value not in allowed:
                raise HTTPException(status_code=422, detail=f"Unsupported {field_name} value: {item}")
            normalized.append(value)
    return normalized


def catalog_enum_value(value: str | None, allowed: set[str], field_name: str) -> str | None:
    if value is None or not str(value).strip():
        return None
    normalized = catalog_token(value)
    if normalized not in allowed:
        raise HTTPException(status_code=422, detail=f"Unsupported {field_name} value: {value}")
    return normalized


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def normalize_cookie_preferences(value: Any) -> dict[str, bool]:
    source = value if isinstance(value, dict) else {}
    return {
        "necessary": True,
        "preferences": bool(source.get("preferences")),
        "statistics": bool(source.get("statistics")),
    }


def encrypted_cookie_value(request: Request, name: str, purpose: str) -> Any | None:
    return COOKIE_CIPHER.decrypt(purpose, request.cookies.get(name))


def set_encrypted_cookie(
    response: Response,
    name: str,
    purpose: str,
    value: Any,
    max_age: int,
) -> None:
    response.set_cookie(
        key=name,
        value=COOKIE_CIPHER.encrypt(purpose, value),
        max_age=max_age,
        expires=now_utc() + timedelta(seconds=max_age),
        path="/",
        secure=True,
        httponly=True,
        samesite="lax",
    )


def set_public_cookie(
    response: Response,
    name: str,
    value: str,
    max_age: int,
    *,
    secure: bool = True,
) -> None:
    response.set_cookie(
        key=name,
        value=value,
        max_age=max_age,
        expires=now_utc() + timedelta(seconds=max_age),
        path="/",
        secure=secure,
        httponly=False,
        samesite="lax",
    )


def delete_public_cookie(response: Response, name: str, *, secure: bool = True) -> None:
    response.delete_cookie(
        key=name,
        path="/",
        secure=secure,
        httponly=False,
        samesite="lax",
    )


def delete_private_cookie(response: Response, name: str) -> None:
    response.delete_cookie(
        key=name,
        path="/",
        secure=True,
        httponly=True,
        samesite="lax",
    )


def clear_legacy_site_cookies(response: Response) -> None:
    delete_private_cookie(response, COOKIE_LEGACY_PREFERENCES_NAME)
    for name in COOKIE_LEGACY_FREETIMBAT_NAMES:
        response.delete_cookie(key=name, path="/", samesite="lax")


def attribution_touch(request: Request) -> dict[str, str]:
    query = request.query_params
    referrer = str(request.headers.get("referer") or "")[:1000]
    referrer_host = ""
    try:
        parsed_referrer = urllib.parse.urlparse(referrer)
        referrer_host = str(parsed_referrer.hostname or "")[:100]
        referrer = urllib.parse.urlunparse(
            (parsed_referrer.scheme, parsed_referrer.netloc, parsed_referrer.path, "", "", "")
        )[:300]
    except ValueError:
        referrer = ""
    source = str(query.get("utm_source") or "").strip()[:100]
    if not source:
        source = referrer_host if referrer_host and referrer_host != request.url.hostname else "direct"
    landing_path = str(query.get("page") or "").strip()
    if not landing_path.startswith("/"):
        try:
            landing_path = str(urllib.parse.urlparse(referrer).path or "/")
        except ValueError:
            landing_path = "/"
    return {
        "source": source,
        "medium": str(query.get("utm_medium") or "").strip()[:100],
        "campaign": str(query.get("utm_campaign") or "").strip()[:150],
        "referrer": referrer,
        "landingPath": landing_path[:300],
        "capturedAt": now_utc().isoformat(),
    }


def ensure_privacy_cookies(request: Request, response: Response) -> str:
    raw_consent_id = request.cookies.get(COOKIE_CONSENT_ID_NAME)
    consent_id = raw_consent_id
    try:
        consent_id = str(uuid.UUID(str(consent_id)))
        consent_id_is_plain = True
    except (ValueError, TypeError, AttributeError):
        consent_id = encrypted_cookie_value(request, COOKIE_CONSENT_ID_NAME, "consent-id")
        consent_id_is_plain = False
    if not isinstance(consent_id, str) or not consent_id:
        stored_consent = encrypted_cookie_value(request, COOKIE_CONSENT_NAME, "consent-preferences")
        candidate = stored_consent.get("consentId") if isinstance(stored_consent, dict) else None
        try:
            consent_id = str(uuid.UUID(str(candidate)))
        except (ValueError, TypeError, AttributeError):
            consent_id = str(uuid.uuid4())
        consent_id_is_plain = False
    if not consent_id_is_plain:
        set_public_cookie(
            response,
            COOKIE_CONSENT_ID_NAME,
            consent_id,
            COOKIE_CONSENT_DAYS * 24 * 60 * 60,
        )
    attribution_seconds = COOKIE_ATTRIBUTION_DAYS * 24 * 60 * 60

    touch = attribution_touch(request)
    first_touch = encrypted_cookie_value(request, COOKIE_ATTR_FIRST_NAME, "attribution-first")
    if not isinstance(first_touch, dict):
        first_touch = touch
        set_encrypted_cookie(response, COOKIE_ATTR_FIRST_NAME, "attribution-first", first_touch, attribution_seconds)
    set_encrypted_cookie(response, COOKIE_ATTR_LAST_NAME, "attribution-last", touch, attribution_seconds)
    return consent_id


def set_user_session_cookie(response: Response, token: str) -> None:
    set_encrypted_cookie(
        response,
        COOKIE_SESSION_NAME,
        "user-session",
        {"token": token},
        COOKIE_SESSION_DAYS * 24 * 60 * 60,
    )
    delete_private_cookie(response, COOKIE_LEGACY_SESSION_NAME)


def request_session_tokens(request: Request, authorization: str | None) -> list[str]:
    tokens: list[str] = []
    encrypted_session = encrypted_cookie_value(request, COOKIE_SESSION_NAME, "user-session")
    if encrypted_session is None:
        encrypted_session = encrypted_cookie_value(request, COOKIE_LEGACY_SESSION_NAME, "user-session")
    if isinstance(encrypted_session, dict):
        token = str(encrypted_session.get("token") or "").strip()
        if token:
            tokens.append(token)
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        # Old browser bundles could store the literal strings below after an
        # HttpOnly cookie login.  Treat them as absent and fall back to the
        # encrypted session cookie instead of rejecting a valid login.
        if token and token.lower() not in {"undefined", "null"}:
            if token not in tokens:
                tokens.append(token)
    return tokens


def request_session_token(request: Request, authorization: str | None) -> str | None:
    tokens = request_session_tokens(request, authorization)
    return tokens[0] if tokens else None


VISION_LIKELIHOODS = {
    0: "UNKNOWN",
    1: "VERY_UNLIKELY",
    2: "UNLIKELY",
    3: "POSSIBLE",
    4: "LIKELY",
    5: "VERY_LIKELY",
}


def safe_storage_path(root: Path, storage_key: str) -> Path:
    normalized = str(storage_key or "").replace("\\", "/").lstrip("/")
    base = root.resolve()
    target = (base / normalized).resolve()
    if target == base or base not in target.parents:
        raise HTTPException(status_code=400, detail="Invalid photo storage key")
    return target


def normalize_profile_image(body: bytes) -> tuple[str, str, bytes, dict[str, Any]]:
    if Image is None or ImageOps is None:
        raise HTTPException(status_code=503, detail="Image validation is temporarily unavailable")
    try:
        source = Image.open(io.BytesIO(body))
        actual_format = str(source.format or "").upper()
        if getattr(source, "is_animated", False):
            raise HTTPException(status_code=415, detail="Animated profile photos are not supported")
        width, height = source.size
        if width * height > MAX_IMAGE_PIXELS:
            raise HTTPException(status_code=413, detail="Photo dimensions are too large")
        source.load()
    except HTTPException:
        raise
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError) as error:
        raise HTTPException(status_code=422, detail="The uploaded file is not a valid image") from error
    if actual_format not in {"JPEG", "PNG", "WEBP"}:
        raise HTTPException(status_code=415, detail="Only JPEG, PNG and WebP images are supported")
    if width < MIN_PROFILE_IMAGE_SIDE or height < MIN_PROFILE_IMAGE_SIDE:
        raise HTTPException(status_code=422, detail=f"Photo must be at least {MIN_PROFILE_IMAGE_SIDE} px on each side")
    normalized = ImageOps.exif_transpose(source)
    if normalized.mode in {"RGBA", "LA"} or (normalized.mode == "P" and "transparency" in normalized.info):
        rgba = normalized.convert("RGBA")
        background = Image.new("RGB", rgba.size, "white")
        background.paste(rgba, mask=rgba.getchannel("A"))
        normalized = background
    else:
        normalized = normalized.convert("RGB")
    output = io.BytesIO()
    normalized.save(output, format="JPEG", quality=90, optimize=True, progressive=True)
    normalized_body = output.getvalue()
    if len(normalized_body) > MAX_UPLOAD_BYTES:
        output = io.BytesIO()
        normalized.save(output, format="JPEG", quality=80, optimize=True, progressive=True)
        normalized_body = output.getvalue()
    if len(normalized_body) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Normalized photo is too large")
    return (
        "image/jpeg",
        ".jpg",
        normalized_body,
        {
            "sourceFormat": actual_format,
            "width": normalized.width,
            "height": normalized.height,
            "sha256": hashlib.sha256(normalized_body).hexdigest(),
        },
    )


def inspect_chat_image(body: bytes) -> dict[str, Any]:
    if Image is None:
        raise HTTPException(status_code=503, detail="Image validation is temporarily unavailable")
    try:
        source = Image.open(io.BytesIO(body))
        actual_format = str(source.format or "").upper()
        width, height = source.size
        if getattr(source, "is_animated", False):
            raise HTTPException(status_code=415, detail="Animated chat images are not supported")
        if actual_format not in {"JPEG", "PNG", "WEBP"}:
            raise HTTPException(status_code=415, detail="Only JPEG, PNG and WebP images are supported")
        if width * height > MAX_IMAGE_PIXELS:
            raise HTTPException(status_code=413, detail="Image dimensions are too large")
        source.verify()
    except HTTPException:
        raise
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError) as error:
        raise HTTPException(status_code=422, detail="The uploaded file is not a valid image") from error
    return {"sourceFormat": actual_format, "width": width, "height": height, "sha256": hashlib.sha256(body).hexdigest()}


def vision_is_configured() -> bool:
    return bool(VISION_ENABLED and VISION_CREDENTIALS_PATH and vision is not None and service_account is not None)


def get_vision_client():
    global VISION_CLIENT
    if not vision_is_configured():
        raise RuntimeError("Google Vision is not configured")
    if VISION_CLIENT is not None:
        return VISION_CLIENT
    with VISION_CLIENT_LOCK:
        if VISION_CLIENT is not None:
            return VISION_CLIENT
        credentials_path = Path(VISION_CREDENTIALS_PATH)
        with credentials_path.open("r", encoding="utf-8") as credentials_file:
            credentials_data = json.load(credentials_file)
        credentials_project = str(credentials_data.get("project_id") or "").strip()
        if credentials_project != EXPECTED_FIREBASE_PROJECT_ID:
            raise RuntimeError(
                f"Google Vision credentials target {credentials_project!r}; "
                f"expected {EXPECTED_FIREBASE_PROJECT_ID!r}"
            )
        credentials = service_account.Credentials.from_service_account_info(
            credentials_data,
            scopes=["https://www.googleapis.com/auth/cloud-platform"],
        )
        VISION_CLIENT = vision.ImageAnnotatorClient(credentials=credentials)
        return VISION_CLIENT


def vision_likelihood(value: Any) -> str:
    try:
        return VISION_LIKELIHOODS.get(int(value), "UNKNOWN")
    except (TypeError, ValueError):
        return "UNKNOWN"


def automatic_photo_decision(result: dict[str, Any]) -> dict[str, Any]:
    """Resolve every Vision outcome without creating a manual moderation queue."""
    normalized = dict(result)
    decision = str(normalized.get("decision") or "REJECTED").upper()
    if decision == "APPROVED":
        return normalized
    if decision != "REJECTED":
        reason = str(normalized.get("reason") or "AUTOMATIC_CHECK_INCONCLUSIVE").upper()
        normalized.update(decision="REJECTED", reason=f"AUTOMATIC_REJECTED_{reason}"[:512])
    return normalized


def moderate_profile_image(body: bytes, require_face: bool) -> dict[str, Any]:
    if not vision_is_configured():
        return automatic_photo_decision({
            "decision": "MANUAL_REVIEW",
            "reason": "VISION_NOT_CONFIGURED",
            "providerConfigured": False,
        })
    try:
        client = get_vision_client()
        image_request = vision.Image(content=body)
        safe_response = client.safe_search_detection(
            image=image_request,
            retry=None,
            timeout=VISION_TIMEOUT_SECONDS,
        )
        face_response = (
            client.face_detection(
                image=image_request,
                retry=None,
                timeout=VISION_TIMEOUT_SECONDS,
            )
            if require_face
            else None
        )
    except Exception as error:
        return automatic_photo_decision({
            "decision": "MANUAL_REVIEW",
            "reason": "VISION_REQUEST_FAILED",
            "providerConfigured": True,
            "providerError": type(error).__name__,
        })
    provider_error = str(getattr(getattr(safe_response, "error", None), "message", "") or "").strip()
    if not provider_error and face_response is not None:
        provider_error = str(getattr(getattr(face_response, "error", None), "message", "") or "").strip()
    if provider_error:
        return automatic_photo_decision({
            "decision": "MANUAL_REVIEW",
            "reason": "VISION_PROVIDER_ERROR",
            "providerConfigured": True,
            "providerError": provider_error[:500],
        })
    safe = getattr(safe_response, "safe_search_annotation", None)
    safe_search = {
        key: vision_likelihood(getattr(safe, key, 0))
        for key in ("adult", "spoof", "medical", "violence", "racy")
    }
    result: dict[str, Any] = {
        "decision": "APPROVED",
        "reason": "SAFE",
        "providerConfigured": True,
        "safeSearch": safe_search,
    }
    if safe_search["adult"] == "VERY_LIKELY" or safe_search["violence"] == "VERY_LIKELY":
        result.update(decision="REJECTED", reason="PROHIBITED_CONTENT")
        return automatic_photo_decision(result)
    if (
        safe_search["adult"] == "LIKELY"
        or safe_search["violence"] == "LIKELY"
        or safe_search["racy"] in {"LIKELY", "VERY_LIKELY"}
    ):
        result.update(decision="MANUAL_REVIEW", reason="AMBIGUOUS_CONTENT")
    if not require_face:
        return automatic_photo_decision(result)
    faces = list(getattr(face_response, "face_annotations", []) or [])
    result["faceCount"] = len(faces)
    if not faces:
        result.update(decision="REJECTED", reason="MAIN_PHOTO_FACE_REQUIRED")
        return automatic_photo_decision(result)
    if len(faces) != 1:
        result.update(decision="REJECTED", reason="MAIN_PHOTO_SINGLE_FACE_REQUIRED")
        return automatic_photo_decision(result)
    face = faces[0]
    face_quality = {
        "detectionConfidence": round(float(getattr(face, "detection_confidence", 0) or 0), 4),
        "blurred": vision_likelihood(getattr(face, "blurred_likelihood", 0)),
        "underExposed": vision_likelihood(getattr(face, "under_exposed_likelihood", 0)),
        "headwear": vision_likelihood(getattr(face, "headwear_likelihood", 0)),
        "panAngle": round(float(getattr(face, "pan_angle", 0) or 0), 2),
        "tiltAngle": round(float(getattr(face, "tilt_angle", 0) or 0), 2),
        "rollAngle": round(float(getattr(face, "roll_angle", 0) or 0), 2),
    }
    result["face"] = face_quality
    needs_review = (
        face_quality["detectionConfidence"] < 0.70
        or face_quality["blurred"] in {"LIKELY", "VERY_LIKELY"}
        or face_quality["underExposed"] in {"LIKELY", "VERY_LIKELY"}
        or face_quality["headwear"] in {"LIKELY", "VERY_LIKELY"}
        or abs(face_quality["panAngle"]) > 35
        or abs(face_quality["tiltAngle"]) > 35
        or abs(face_quality["rollAngle"]) > 35
    )
    if result["decision"] == "APPROVED" and needs_review:
        result.update(decision="MANUAL_REVIEW", reason="MAIN_PHOTO_QUALITY_REVIEW")
    return automatic_photo_decision(result)


def combine_profile_and_avatar_moderation(
    profile_photo: dict[str, Any],
    avatar_crop: dict[str, Any],
) -> dict[str, Any]:
    profile_photo = automatic_photo_decision(profile_photo)
    avatar_crop = automatic_photo_decision(avatar_crop)
    profile_decision = str(profile_photo.get("decision") or "REJECTED").upper()
    avatar_decision = str(avatar_crop.get("decision") or "REJECTED").upper()
    if "REJECTED" in {profile_decision, avatar_decision}:
        decision = "REJECTED"
    else:
        decision = "APPROVED"
    failed_part = "PROFILE_PHOTO" if profile_decision != "APPROVED" else "AVATAR_CROP"
    failed_result = profile_photo if profile_decision != "APPROVED" else avatar_crop
    reason = "SAFE"
    if decision != "APPROVED":
        reason = f"{failed_part}_{str(failed_result.get('reason') or decision)}"[:512]
    return {
        "decision": automatic_photo_decision({"decision": decision, "reason": reason})["decision"],
        "reason": reason,
        "providerConfigured": bool(profile_photo.get("providerConfigured"))
        and bool(avatar_crop.get("providerConfigured")),
        "profilePhoto": profile_photo,
        "avatarCrop": avatar_crop,
    }


def didit_is_configured() -> bool:
    return bool(DIDIT_ENABLED and DIDIT_API_KEY and DIDIT_WORKFLOW_ID)


def didit_request(
    path: str,
    method: str = "GET",
    payload: dict[str, Any] | None = None,
    allow_not_found: bool = False,
) -> dict[str, Any]:
    if not didit_is_configured():
        raise HTTPException(status_code=503, detail="Profile verification provider is not configured")
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(
        f"{DIDIT_API_BASE}/{path.lstrip('/')}",
        data=body,
        method=method,
        headers={"x-api-key": DIDIT_API_KEY, "Accept": "application/json", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=DIDIT_TIMEOUT_SECONDS) as response:
            raw = response.read()
    except urllib.error.HTTPError as error:
        if allow_not_found and error.code == 404:
            return {}
        provider_body = error.read().decode("utf-8", errors="replace")[:2000]
        try:
            provider_data = json.loads(provider_body)
            detail = provider_data.get("detail") or provider_data.get("message") or "Verification provider rejected the request"
        except (json.JSONDecodeError, AttributeError):
            detail = "Verification provider rejected the request"
        raise HTTPException(status_code=502, detail=str(detail)) from error
    except (urllib.error.URLError, TimeoutError) as error:
        raise HTTPException(status_code=502, detail="Verification provider is temporarily unavailable") from error
    try:
        data = json.loads(raw.decode("utf-8")) if raw else {}
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=502, detail="Verification provider returned an invalid response") from error
    if not isinstance(data, dict):
        raise HTTPException(status_code=502, detail="Verification provider returned an invalid response")
    return data


def didit_internal_status(value: Any) -> str:
    normalized = re.sub(r"[^A-Z]+", "_", str(value or "").strip().upper()).strip("_")
    return {
        "APPROVED": "APPROVED",
        "DECLINED": "DECLINED",
        "REJECTED": "DECLINED",
        "ABANDONED": "ABANDONED",
        "EXPIRED": "EXPIRED",
        "KYC_EXPIRED": "EXPIRED",
        "IN_REVIEW": "IN_REVIEW",
        "RESUBMITTED": "PENDING",
        "AWAITING_USER": "PENDING",
        "IN_PROGRESS": "PENDING",
        "NOT_STARTED": "NOT_STARTED",
        "PENDING": "PENDING",
    }.get(normalized, "PENDING")


def didit_safe_decision(value: Any) -> Any:
    forbidden_fragments = ("image", "video", "document_file", "session_token", "session_url", "portrait")
    if isinstance(value, list):
        return [didit_safe_decision(item) for item in value]
    if isinstance(value, dict):
        safe: dict[str, Any] = {}
        for key, item in value.items():
            if any(fragment in str(key).lower() for fragment in forbidden_fragments):
                continue
            safe[str(key)] = didit_safe_decision(item)
        return safe
    return value


def didit_portrait_base64(public_url: str) -> str:
    url = str(public_url or "").strip()
    if not url:
        raise HTTPException(status_code=409, detail="Upload a primary profile photo before verification")
    upload_prefix = f"{UPLOAD_URL_PREFIX.rstrip('/')}/"
    if url.startswith(upload_prefix):
        relative = url[len(upload_prefix):].replace("/", os.sep)
        root = UPLOAD_DIR.resolve()
        source = (root / relative).resolve()
        if source != root and root not in source.parents:
            raise HTTPException(status_code=400, detail="Invalid primary profile photo")
        try:
            body = source.read_bytes()
        except OSError as error:
            raise HTTPException(status_code=409, detail="Primary profile photo is unavailable") from error
    elif url.startswith("https://") or url.startswith("http://"):
        request = urllib.request.Request(url, headers={"User-Agent": "LetsBeParents/1.0"})
        try:
            with urllib.request.urlopen(request, timeout=DIDIT_TIMEOUT_SECONDS) as response:
                body = response.read(DIDIT_MAX_PORTRAIT_BYTES + 1)
        except (urllib.error.URLError, TimeoutError) as error:
            raise HTTPException(status_code=409, detail="Primary profile photo is unavailable") from error
    else:
        raise HTTPException(status_code=409, detail="Primary profile photo is unavailable")
    if not body:
        raise HTTPException(status_code=409, detail="Primary profile photo is empty")
    if Image is None:
        if len(body) > DIDIT_PORTRAIT_TRANSPORT_BYTES:
            raise HTTPException(status_code=503, detail="Profile verification image processing is unavailable")
        return base64.b64encode(body).decode("ascii")
    try:
        source = Image.open(io.BytesIO(body))
        if ImageOps is not None:
            source = ImageOps.exif_transpose(source)
        source = source.convert("RGB")
        compact: bytes | None = None
        smallest: bytes | None = None
        for max_side in (320, 288, 256, 224, 192, 176, 160):
            portrait = source.copy()
            portrait.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
            for quality in (78, 70, 62, 54, 46):
                output = io.BytesIO()
                portrait.save(output, format="JPEG", quality=quality, optimize=True, progressive=True)
                candidate = output.getvalue()
                if smallest is None or len(candidate) < len(smallest):
                    smallest = candidate
                if len(candidate) <= DIDIT_PORTRAIT_TRANSPORT_BYTES:
                    compact = candidate
                    break
            if compact is not None:
                break
        body = compact or smallest or b""
    except (UnidentifiedImageError, OSError, ValueError) as error:
        raise HTTPException(status_code=409, detail="Primary profile photo is unavailable") from error
    if not body:
        raise HTTPException(status_code=409, detail="Primary profile photo is unavailable")
    if len(body) > DIDIT_MAX_PORTRAIT_BYTES:
        raise HTTPException(status_code=413, detail="Primary profile photo is too large for verification")
    return base64.b64encode(body).decode("ascii")


def didit_shorten_floats(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): didit_shorten_floats(item) for key, item in value.items()}
    if isinstance(value, list):
        return [didit_shorten_floats(item) for item in value]
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def didit_webhook_signature_is_valid(payload: dict[str, Any], raw_body: bytes, request: Request) -> bool:
    if not DIDIT_WEBHOOK_SECRET:
        return False
    timestamp = request.headers.get("x-timestamp", "")
    try:
        incoming = int(timestamp)
    except (TypeError, ValueError):
        return False
    if abs(int(now_utc().timestamp()) - incoming) > 300:
        return False
    signature_v2 = request.headers.get("x-signature-v2", "")
    if signature_v2:
        canonical = json.dumps(didit_shorten_floats(payload), sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        expected = hmac.new(DIDIT_WEBHOOK_SECRET.encode("utf-8"), canonical.encode("utf-8"), hashlib.sha256).hexdigest()
        if hmac.compare_digest(signature_v2, expected):
            return True
    signature_simple = request.headers.get("x-signature-simple", "")
    if signature_simple:
        canonical = ":".join(str(payload.get(key, "")) for key in ("timestamp", "session_id", "status", "webhook_type"))
        expected = hmac.new(DIDIT_WEBHOOK_SECRET.encode("utf-8"), canonical.encode("utf-8"), hashlib.sha256).hexdigest()
        if hmac.compare_digest(signature_simple, expected):
            return True
    signature = request.headers.get("x-signature", "")
    if signature:
        expected = hmac.new(DIDIT_WEBHOOK_SECRET.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(signature, expected)
    return False


def database_datetime(value: datetime) -> str:
    return value.astimezone(timezone.utc).replace(tzinfo=None).isoformat(sep=" ", timespec="seconds")


def normalize_email(email: str) -> str:
    return email.strip().lower()


def slugify(value: str, fallback: str = "item") -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or fallback


def unique_clinic_slug(cursor, name: str) -> str:
    base = slugify(name, "clinic")
    slug = base
    suffix = 2
    while True:
        cursor.execute(
            "SELECT id FROM clinics WHERE JSON_UNQUOTE(JSON_EXTRACT(data, '$.slug')) = %s LIMIT 1",
            (slug,),
        )
        if not cursor.fetchone():
            return slug
        slug = f"{base}-{suffix}"
        suffix += 1


def public_user(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "profileId": row.get("profile_id"),
        "email": row["email"],
        "displayName": row.get("display_name"),
        "role": row.get("role"),
        "status": row.get("status"),
        "emailVerified": bool(row.get("email_verified_at")),
        "passwordLoginEnabled": bool(row.get("password_login_enabled", True)),
        "createdAt": row.get("created_at"),
    }


class SignupPayload(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=200)
    displayName: str = Field(min_length=1, max_length=255)
    locale: str = Field(default="en", max_length=8)


class LoginPayload(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=200)


class FirebaseAuthPayload(BaseModel):
    idToken: str = Field(min_length=100, max_length=20000)
    displayName: str | None = Field(default=None, max_length=255)
    intent: Literal["login", "register"] = "login"


class ForgotPasswordPayload(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    locale: str = Field(default="en", max_length=8)


class AuthLocalePayload(BaseModel):
    locale: str = Field(default="en", max_length=8)


class CookieConsentPayload(BaseModel):
    preferences: bool = False
    statistics: bool = False
    locale: str = Field(default="en", pattern="^(en|ru|es)$")


class VerifyEmailPayload(BaseModel):
    token: str = Field(min_length=20, max_length=512)


class ResetPasswordPayload(BaseModel):
    token: str = Field(min_length=20, max_length=512)
    password: str = Field(min_length=8, max_length=200)


class ContactPayload(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    email: str | None = Field(default=None, max_length=320)
    subject: str | None = Field(default=None, max_length=255)
    message: str | None = Field(default=None, max_length=5000)
    payload: dict[str, Any] = Field(default_factory=dict)


class ProfileUpdatePayload(BaseModel):
    displayName: str | None = Field(default=None, max_length=255)
    dateOfBirth: str | None = Field(default=None, max_length=32)
    country: str | None = Field(default=None, max_length=128)
    state: str | None = Field(default=None, max_length=128)
    city: str | None = Field(default=None, max_length=128)
    cityPlaceId: str | None = Field(default=None, max_length=255)
    latitude: float | None = None
    longitude: float | None = None
    profileType: str | None = Field(default=None, max_length=120)
    about: str | None = Field(default=None, max_length=5000)
    bio: str | None = Field(default=None, max_length=5000)
    height: int | None = Field(default=None, ge=80, le=250)
    weight: int | None = Field(default=None, ge=25, le=350)
    eyeColor: str | None = Field(default=None, max_length=80)
    hairColor: str | None = Field(default=None, max_length=80)
    ethnicity: str | None = Field(default=None, max_length=120)
    occupation: str | None = Field(default=None, max_length=255)
    education: str | None = Field(default=None, max_length=120)
    religion: str | None = Field(default=None, max_length=120)
    smokingStatus: str | None = Field(default=None, max_length=120)
    drinkingStatus: str | None = Field(default=None, max_length=120)
    languages: list[str] | None = None
    lookingFor: list[str] | None = None
    donorType: list[str] | None = None
    desiredDonorContact: str | None = Field(default=None, max_length=120)
    unitPreference: str | None = Field(default=None, pattern="^(METRIC|IMPERIAL)$")
    visibleInCatalog: bool | None = None


class ConversationCreatePayload(BaseModel):
    targetProfileId: str = Field(min_length=1, max_length=191)


class MessageCreatePayload(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class CallCreatePayload(BaseModel):
    callType: str = Field(default="VOICE", pattern="^(VOICE|VIDEO)$")


class VerificationPayload(BaseModel):
    verificationType: str = Field(default="profile", max_length=80)
    payload: dict[str, Any] = Field(default_factory=dict)


class SubscriptionIntentPayload(BaseModel):
    plan: str = Field(default="monthly", pattern="^(monthly|quarterly|annual)$")
    payload: dict[str, Any] = Field(default_factory=dict)


class AdminPatchPayload(BaseModel):
    values: dict[str, Any] = Field(default_factory=dict)


class AdminCreatePayload(BaseModel):
    values: dict[str, Any] = Field(default_factory=dict)


class AdminLoginPayload(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=200)


class AdminAccountCreatePayload(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=200)
    role: str = Field(default="STAFF", pattern="^(ADMIN|STAFF)$")
    permissions: list[str] = Field(default_factory=list, max_length=32)


class AdminAccountUpdatePayload(BaseModel):
    password: str | None = Field(default=None, max_length=200)
    role: str = Field(default="STAFF", pattern="^(ADMIN|STAFF)$")
    permissions: list[str] = Field(default_factory=list, max_length=32)


class AdminSubscriptionGrantPayload(BaseModel):
    profileRef: str = Field(min_length=1, max_length=320)
    plan: str = Field(pattern="^(PREMIUM_MONTHLY|PREMIUM_QUARTERLY|PREMIUM_ANNUAL)$")
    days: int = Field(ge=1, le=366)


class AdminSubscriptionReviewPayload(BaseModel):
    status: str = Field(pattern="^(APPROVED|DECLINED)$")
    days: int | None = Field(default=None, ge=1, le=366)


class AdminSupportMessagePayload(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class AdminNotificationTestPayload(BaseModel):
    profileId: int = Field(gt=0)
    notificationType: str = Field(pattern="^(NEW_MATCH|NEW_LIKE|NEW_MESSAGE|PROFILE_VIEW|MARKETING)$")
    actorName: str | None = Field(default=None, max_length=255)
    message: str | None = Field(default=None, max_length=5000)
    respectPreference: bool = False


class PartnerLoginPayload(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=200)


class PartnerClinicPatchPayload(BaseModel):
    values: dict[str, Any] = Field(default_factory=dict)


class PartnerClinicCreatePayload(BaseModel):
    values: dict[str, Any] = Field(default_factory=dict)


class MemberSettingsPayload(BaseModel):
    interfaceLanguage: str | None = Field(default=None, max_length=16)
    notificationSettings: list[dict[str, Any]] | None = None
    visibleInCatalog: bool | None = None
    betaFlags: dict[str, Any] | None = None


class LikesReadPayload(BaseModel):
    readThroughId: int | None = Field(default=None, ge=0)


class MemberBlockPayload(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


class MemberReportPayload(BaseModel):
    reason: str | None = Field(default=None, max_length=500)
    details: str | None = Field(default=None, max_length=5000)


class AccountDeletionPayload(BaseModel):
    reason: str | None = Field(default=None, max_length=255)
    details: str | None = Field(default=None, max_length=5000)


DEFAULT_NOTIFICATION_SETTINGS = [
    {"type": "NEW_MATCH", "emailEnabled": True},
    {"type": "NEW_LIKE", "emailEnabled": True},
    {"type": "NEW_MESSAGE", "emailEnabled": True},
    {"type": "PROFILE_VIEW", "emailEnabled": True},
    {"type": "MARKETING", "emailEnabled": True},
]

NOTIFICATION_COPY = {
    "en": {
        "NEW_MATCH": ("You have a new match", "You and {actor} liked each other."),
        "NEW_LIKE": ("Someone liked your profile", "{actor} liked your profile."),
        "NEW_MESSAGE": ("You have a new message", "{actor} sent you a message: {message}"),
        "PROFILE_VIEW": ("Your profile was viewed", "{actor} viewed your profile today."),
        "MARKETING": ("News from LetsBeParents", "There is something new waiting for you at LetsBeParents."),
        "open": "Open LetsBeParents",
        "fallbackActor": "A LetsBeParents member",
    },
    "ru": {
        "NEW_MATCH": ("У вас новое совпадение", "Вы и {actor} понравились друг другу."),
        "NEW_LIKE": ("Вашу анкету отметили", "{actor} поставил(а) лайк вашей анкете."),
        "NEW_MESSAGE": ("У вас новое сообщение", "{actor} отправил(а) сообщение: {message}"),
        "PROFILE_VIEW": ("Вашу анкету просмотрели", "{actor} посмотрел(а) вашу анкету сегодня."),
        "MARKETING": ("Новости LetsBeParents", "В LetsBeParents появилось что-то новое для вас."),
        "open": "Открыть LetsBeParents",
        "fallbackActor": "Пользователь LetsBeParents",
    },
    "es": {
        "NEW_MATCH": ("Tienes una nueva coincidencia", "Tú y {actor} os gustáis."),
        "NEW_LIKE": ("A alguien le gusta tu perfil", "A {actor} le gusta tu perfil."),
        "NEW_MESSAGE": ("Tienes un mensaje nuevo", "{actor} te ha enviado un mensaje: {message}"),
        "PROFILE_VIEW": ("Alguien ha visto tu perfil", "{actor} ha visto tu perfil hoy."),
        "MARKETING": ("Novedades de LetsBeParents", "Hay novedades para ti en LetsBeParents."),
        "open": "Abrir LetsBeParents",
        "fallbackActor": "Un miembro de LetsBeParents",
    },
}


def email_notifications_configured() -> bool:
    return bool(
        EMAIL_NOTIFICATIONS_ENABLED
        and SMTP_HOST
        and SMTP_PORT
        and SMTP_FROM_EMAIL
        and (not SMTP_USER or SMTP_PASSWORD)
    )


def notification_preference_enabled(profile_data: dict[str, Any], notification_type: str) -> bool:
    rows = profile_data.get("notificationSettings")
    if isinstance(rows, list):
        for row in rows:
            if isinstance(row, dict) and str(row.get("type") or "").upper() == notification_type:
                return row.get("emailEnabled") is not False
    return any(row["type"] == notification_type and row["emailEnabled"] for row in DEFAULT_NOTIFICATION_SETTINGS)


def record_notification_delivery(
    notification_type: str,
    profile_id: int,
    status_value: str,
    email_address: str | None = None,
    detail: str | None = None,
):
    payload = {
        "notificationType": notification_type,
        "profileId": profile_id,
        "status": status_value,
        "emailHash": hashlib.sha256(email_address.encode("utf-8")).hexdigest() if email_address else None,
        "detail": detail,
        "createdAt": now_utc().isoformat(),
    }
    try:
        with db_cursor() as (conn, cursor):
            cursor.execute(
                "INSERT INTO api_events (event_type, payload) VALUES ('member.email_notification', %s)",
                (json.dumps(payload, ensure_ascii=False),),
            )
            conn.commit()
    except Exception:
        logger.exception("Could not record email notification delivery")


def notification_target_path(notification_type: str, locale_code: str) -> str:
    route = {
        "NEW_MATCH": "/likes/",
        "NEW_LIKE": "/likes/",
        "NEW_MESSAGE": "/chat/",
        "PROFILE_VIEW": "/profile/",
        "MARKETING": "/",
    }.get(notification_type, "/profile/")
    return f"{PUBLIC_APP_URL}/{locale_code}{route}"


def send_profile_notification(
    profile_id: int,
    notification_type: str,
    actor_name: str | None = None,
    message_preview: str | None = None,
    force: bool = False,
) -> dict[str, Any]:
    notification_type = str(notification_type or "").upper()
    if notification_type not in {row["type"] for row in DEFAULT_NOTIFICATION_SETTINGS}:
        return {"ok": False, "status": "UNSUPPORTED"}

    with db_cursor() as (_, cursor):
        cursor.execute(
            """
            SELECT u.email, p.data
            FROM profiles p
            JOIN local_users u ON u.profile_id = p.id AND u.status = 'ACTIVE'
            WHERE p.id = %s AND p.status = 'ACTIVE'
            ORDER BY u.id ASC
            LIMIT 1
            """,
            (profile_id,),
        )
        recipient = cursor.fetchone()

    if not recipient:
        record_notification_delivery(notification_type, profile_id, "SKIPPED", detail="RECIPIENT_NOT_FOUND")
        return {"ok": False, "status": "RECIPIENT_NOT_FOUND"}

    email_address = normalize_email(recipient.get("email"))
    profile_data = as_dict(recipient.get("data"))
    if not email_address:
        record_notification_delivery(notification_type, profile_id, "SKIPPED", detail="EMAIL_NOT_FOUND")
        return {"ok": False, "status": "EMAIL_NOT_FOUND"}
    if not force and not notification_preference_enabled(profile_data, notification_type):
        record_notification_delivery(notification_type, profile_id, "SKIPPED", email_address, "PREFERENCE_DISABLED")
        return {"ok": True, "status": "PREFERENCE_DISABLED"}
    if not email_notifications_configured():
        record_notification_delivery(notification_type, profile_id, "FAILED", email_address, "SMTP_NOT_CONFIGURED")
        return {"ok": False, "status": "SMTP_NOT_CONFIGURED"}

    locale_code = str(profile_data.get("interfaceLanguage") or "en").lower()
    if locale_code not in NOTIFICATION_COPY:
        locale_code = "en"
    copy = NOTIFICATION_COPY[locale_code]
    subject, body_template = copy[notification_type]
    actor = (actor_name or copy["fallbackActor"]).strip()
    preview = re.sub(r"\s+", " ", str(message_preview or "")).strip()
    if len(preview) > 180:
        preview = preview[:177] + "..."
    body = body_template.format(actor=actor, message=preview)
    target_url = notification_target_path(notification_type, locale_code)

    email_message = EmailMessage()
    email_message["Subject"] = subject
    email_message["From"] = formataddr((SMTP_FROM_NAME, SMTP_FROM_EMAIL))
    email_message["To"] = email_address
    email_message.set_content(f"{body}\n\n{copy['open']}: {target_url}")
    email_message.add_alternative(
        "<html><body style=\"font-family:Arial,sans-serif;color:#050816\">"
        f"<h2>{html.escape(subject)}</h2><p>{html.escape(body)}</p>"
        f"<p><a href=\"{html.escape(target_url, quote=True)}\" style=\"display:inline-block;padding:12px 18px;border-radius:6px;background:#f70a68;color:#fff;text-decoration:none\">{html.escape(copy['open'])}</a></p>"
        "</body></html>",
        subtype="html",
    )

    try:
        context = ssl.create_default_context()
        if SMTP_USE_SSL:
            server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=SMTP_TIMEOUT_SECONDS, context=context)
        else:
            server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=SMTP_TIMEOUT_SECONDS)
        with server:
            if SMTP_USE_TLS and not SMTP_USE_SSL:
                server.starttls(context=context)
            if SMTP_USER:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(email_message)
        record_notification_delivery(notification_type, profile_id, "SENT", email_address)
        return {"ok": True, "status": "SENT"}
    except Exception as exc:
        logger.warning("Email notification delivery failed: %s", type(exc).__name__)
        record_notification_delivery(notification_type, profile_id, "FAILED", email_address, type(exc).__name__)
        return {"ok": False, "status": "DELIVERY_FAILED"}


AUTH_EMAIL_COPY = {
    "en": {
        "verifySubject": "Confirm your LetsBeParents email",
        "verifyTitle": "Confirm your email",
        "verifyBody": "Use the button below to confirm your email address. The link is valid for 24 hours.",
        "verifyButton": "Confirm email",
        "resetSubject": "Reset your LetsBeParents password",
        "resetTitle": "Reset your password",
        "resetBody": "Use the button below to choose a new password. The one-time link is valid for 60 minutes.",
        "resetButton": "Reset password",
        "ignore": "If you did not request this email, you can safely ignore it.",
    },
    "ru": {
        "verifySubject": "Подтвердите email в LetsBeParents",
        "verifyTitle": "Подтвердите email",
        "verifyBody": "Нажмите кнопку ниже, чтобы подтвердить адрес электронной почты. Ссылка действует 24 часа.",
        "verifyButton": "Подтвердить email",
        "resetSubject": "Восстановление пароля LetsBeParents",
        "resetTitle": "Установите новый пароль",
        "resetBody": "Нажмите кнопку ниже, чтобы установить новый пароль. Одноразовая ссылка действует 60 минут.",
        "resetButton": "Сменить пароль",
        "ignore": "Если вы не запрашивали это письмо, просто проигнорируйте его.",
    },
    "es": {
        "verifySubject": "Confirma tu correo de LetsBeParents",
        "verifyTitle": "Confirma tu correo",
        "verifyBody": "Usa el botón para confirmar tu correo electrónico. El enlace es válido durante 24 horas.",
        "verifyButton": "Confirmar correo",
        "resetSubject": "Restablece tu contraseña de LetsBeParents",
        "resetTitle": "Restablece tu contraseña",
        "resetBody": "Usa el botón para elegir una contraseña nueva. El enlace de un solo uso es válido durante 60 minutos.",
        "resetButton": "Restablecer contraseña",
        "ignore": "Si no solicitaste este correo, puedes ignorarlo.",
    },
}


def auth_locale(value: str | None) -> str:
    code = str(value or "en").strip().lower()
    return code if code in AUTH_EMAIL_COPY else "en"


def record_auth_email_event(event_type: str, user_id: int, delivery_status: str):
    try:
        with db_cursor() as (conn, cursor):
            cursor.execute(
                "INSERT INTO api_events (event_type, payload) VALUES (%s, %s)",
                (
                    event_type,
                    json.dumps(
                        {"userId": user_id, "status": delivery_status, "createdAt": now_utc().isoformat()},
                        ensure_ascii=False,
                    ),
                ),
            )
            conn.commit()
    except Exception:
        logger.exception("Could not record authentication email event")


def send_transactional_email(recipient: str, subject: str, title: str, body: str, button: str, target_url: str, note: str) -> bool:
    if not email_notifications_configured():
        return False
    email_message = EmailMessage()
    email_message["Subject"] = subject
    email_message["From"] = formataddr((SMTP_FROM_NAME, SMTP_FROM_EMAIL))
    email_message["To"] = recipient
    email_message.set_content(f"{title}\n\n{body}\n\n{target_url}\n\n{note}")
    email_message.add_alternative(
        "<html><body style=\"font-family:Arial,sans-serif;color:#050816\">"
        f"<h2>{html.escape(title)}</h2><p>{html.escape(body)}</p>"
        f"<p><a href=\"{html.escape(target_url, quote=True)}\" style=\"display:inline-block;padding:12px 18px;border-radius:8px;background:#f70a68;color:#fff;text-decoration:none;font-weight:700\">{html.escape(button)}</a></p>"
        f"<p style=\"color:#667085\">{html.escape(note)}</p>"
        "</body></html>",
        subtype="html",
    )
    try:
        context = ssl.create_default_context()
        if SMTP_USE_SSL:
            server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=SMTP_TIMEOUT_SECONDS, context=context)
        else:
            server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=SMTP_TIMEOUT_SECONDS)
        with server:
            if SMTP_USE_TLS and not SMTP_USE_SSL:
                server.starttls(context=context)
            if SMTP_USER:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(email_message)
        return True
    except Exception as exc:
        logger.warning("Authentication email delivery failed: %s", type(exc).__name__)
        return False


def issue_auth_action_token(cursor, user_id: int, purpose: str, lifetime: timedelta) -> tuple[str, datetime]:
    cursor.execute(
        "UPDATE auth_action_tokens SET revoked_at = UTC_TIMESTAMP() WHERE user_id = %s AND purpose = %s AND used_at IS NULL AND revoked_at IS NULL",
        (user_id, purpose),
    )
    raw_token = secrets.token_urlsafe(48)
    expires_at = now_utc() + lifetime
    cursor.execute(
        "INSERT INTO auth_action_tokens (user_id, purpose, token_hash, expires_at) VALUES (%s, %s, %s, %s)",
        (user_id, purpose, token_hash(raw_token), database_datetime(expires_at)),
    )
    return raw_token, expires_at


def send_auth_action_email(user_id: int, email: str, purpose: str, raw_token: str, locale_code: str) -> bool:
    locale_code = auth_locale(locale_code)
    copy = AUTH_EMAIL_COPY[locale_code]
    if purpose == "VERIFY_EMAIL":
        target_url = f"{PUBLIC_APP_URL}/{locale_code}/auth/verify-email/?token={raw_token}"
        keys = ("verifySubject", "verifyTitle", "verifyBody", "verifyButton")
        event_type = "auth.email_verification"
    else:
        target_url = f"{PUBLIC_APP_URL}/{locale_code}/auth/reset-password/?token={raw_token}"
        keys = ("resetSubject", "resetTitle", "resetBody", "resetButton")
        event_type = "auth.password_reset"
    delivered = send_transactional_email(
        email,
        copy[keys[0]],
        copy[keys[1]],
        copy[keys[2]],
        copy[keys[3]],
        target_url,
        copy["ignore"],
    )
    record_auth_email_event(event_type, user_id, "SENT" if delivered else "FAILED")
    return delivered


def b64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode((value + padding).encode("ascii"))


def sign_admin_session(user: str) -> str:
    expires = now_utc() + timedelta(hours=ADMIN_SESSION_HOURS)
    payload = {"user": user, "exp": int(expires.timestamp())}
    body = b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signature = hmac.new(ADMIN_API_PASSWORD.encode("utf-8"), body.encode("ascii"), hashlib.sha256).hexdigest()
    return f"{body}.{signature}"


def is_admin_login_disabled(user: str | None) -> bool:
    return str(user or "").strip().lower() in ADMIN_DISABLED_LOGIN_EMAILS


def dynamic_admin_account(user: str | None) -> dict[str, Any] | None:
    email = str(user or "").strip().lower()
    if not email:
        return None
    with db_cursor() as (_, cursor):
        cursor.execute("SELECT id, source_key, title, status, data, created_at, updated_at FROM app_entities WHERE entity_type = 'admin_account' AND LOWER(source_key) = %s ORDER BY id DESC LIMIT 1", (email,))
        row = cursor.fetchone()
    if not row or str(row.get("status") or "").upper() != "ACTIVE":
        return None
    data = row.get("data")
    if isinstance(data, str):
        try: data = json.loads(data)
        except json.JSONDecodeError: data = {}
    data = data if isinstance(data, dict) else {}
    return {**normalize_row(row), **data, "email": str(data.get("email") or row.get("source_key") or "").lower()}


def is_configured_admin_user(user: str | None) -> bool:
    email = str(user or "").strip()
    return bool(email) and (
        secrets.compare_digest(email, ADMIN_API_USER)
        or (bool(ADMIN_TEST_USER) and secrets.compare_digest(email, ADMIN_TEST_USER))
        or dynamic_admin_account(email) is not None
    )


def has_valid_admin_credentials(user: str | None, password: str | None) -> bool:
    email = str(user or "").strip()
    secret = str(password or "")
    primary_match = (
        secrets.compare_digest(email, ADMIN_API_USER)
        and bool(ADMIN_API_PASSWORD)
        and secrets.compare_digest(secret, ADMIN_API_PASSWORD)
    )
    test_match = (
        bool(ADMIN_TEST_USER)
        and bool(ADMIN_TEST_PASSWORD)
        and secrets.compare_digest(email, ADMIN_TEST_USER)
        and secrets.compare_digest(secret, ADMIN_TEST_PASSWORD)
    )
    dynamic = dynamic_admin_account(email)
    dynamic_match = bool(dynamic and dynamic.get("passwordHash") and verify_password(secret, str(dynamic["passwordHash"])))
    return (primary_match or test_match or dynamic_match) and not is_admin_login_disabled(email)


def required_admin_permissions(path: str) -> set[str]:
    tail = path.removeprefix("/api/admin/").strip("/")
    if not tail or tail in {"session", "logout", "login", "filters"}: return set()
    if tail == "stats": return {"dashboard"}
    if tail.startswith("accounts") or tail.startswith("settings") or tail.startswith("list/settings") or tail.startswith("item/settings") or tail.startswith("create/settings") or tail.startswith("notifications/test"): return {"settings"}
    if tail.startswith("operations"): return {"monitoring", "storage", "settings"}
    if tail.startswith("users") or tail.startswith("list/users") or tail.startswith("item/users"): return {"users"}
    if tail.startswith("subscriptions") or tail.startswith("list/subscriptions") or tail.startswith("item/subscriptions"): return {"subscriptions"}
    if tail.startswith("list/verifications") or tail.startswith("item/verifications"): return {"verifications"}
    if tail.startswith("clinics") or tail.startswith("list/clinics") or tail.startswith("item/clinics"): return {"clinics"}
    if tail.startswith("list/lawyers") or tail.startswith("item/lawyers"): return {"lawyers"}
    if "article" in tail or "categor" in tail: return {"articles"}
    if tail.startswith("support"): return {"support"}
    if "moderation-photos" in tail: return {"moderation-photos"}
    if "moderation-reports" in tail or "reports" in tail: return {"moderation-reports"}
    if tail.startswith("livekit"): return {"livekit"}
    if "static-pages" in tail: return {"static-pages"}
    if "marketing" in tail: return {"marketing"}
    return set()


def enforce_admin_permissions(request: Request, user: str) -> None:
    account = dynamic_admin_account(user)
    if not account or str(account.get("role") or "ADMIN").upper() == "ADMIN": return
    granted = {str(item) for item in account.get("permissions", []) if item}
    required = required_admin_permissions(request.url.path)
    if required and not granted.intersection(required):
        raise HTTPException(status_code=403, detail="This admin account does not have permission for this section")


def verify_admin_session(token: str | None) -> str | None:
    if not token or not ADMIN_API_PASSWORD:
        return None
    try:
        body, signature = token.rsplit(".", 1)
        expected = hmac.new(ADMIN_API_PASSWORD.encode("utf-8"), body.encode("ascii"), hashlib.sha256).hexdigest()
        if not secrets.compare_digest(signature, expected):
            return None
        payload = json.loads(b64url_decode(body).decode("utf-8"))
        user = str(payload.get("user") or "")
        expires = int(payload.get("exp") or 0)
        if not is_configured_admin_user(user) or is_admin_login_disabled(user) or expires <= int(now_utc().timestamp()):
            return None
        return user
    except (ValueError, TypeError, json.JSONDecodeError, UnicodeDecodeError):
        return None


def require_admin(
    request: Request,
    credentials: HTTPBasicCredentials | None = Depends(security),
) -> str:
    if not ADMIN_API_PASSWORD:
        raise HTTPException(status_code=503, detail="Admin API password is not configured")
    if credentials and has_valid_admin_credentials(credentials.username, credentials.password):
        enforce_admin_permissions(request, credentials.username)
        return credentials.username
    session_user = verify_admin_session(request.cookies.get(ADMIN_SESSION_COOKIE))
    if session_user:
        enforce_admin_permissions(request, session_user)
        return session_user
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin credentials")


def sign_partner_token(user: dict[str, Any]) -> tuple[str, str]:
    expires = now_utc() + timedelta(days=PARTNER_SESSION_DAYS)
    payload = {
        "email": user["email"],
        "id": user["id"],
        "role": user.get("role") or "PARTNER_MANAGER",
        "partnerId": user.get("partnerId") or PARTNER_DEFAULT_ID,
        "exp": int(expires.timestamp()),
        "iat": int(now_utc().timestamp()),
    }
    body = b64url_encode(json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
    signature = hmac.new(PARTNER_SESSION_SECRET.encode("utf-8"), body.encode("ascii"), hashlib.sha256).hexdigest()
    return f"{body}.{signature}", expires.isoformat()


def verify_partner_token(token: str) -> dict[str, Any]:
    try:
        body, signature = token.rsplit(".", 1)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid partner token")
    expected = hmac.new(PARTNER_SESSION_SECRET.encode("utf-8"), body.encode("ascii"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=401, detail="Invalid partner token")
    try:
        payload = json.loads(b64url_decode(body).decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid partner token")
    if int(payload.get("exp") or 0) < int(now_utc().timestamp()):
        raise HTTPException(status_code=401, detail="Expired partner token")
    return payload


def require_partner(authorization: str | None = Header(None)) -> dict[str, Any]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Bearer token required")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Bearer token required")
    return verify_partner_token(token)


def load_partner_services() -> list[dict[str, Any]]:
    if not PARTNER_SERVICES_FILE.exists():
        return []
    try:
        data = json.loads(PARTNER_SERVICES_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    return data if isinstance(data, list) else []


def localized_name(item: dict[str, Any], locale: str = "en") -> str:
    translations = item.get("translations") if isinstance(item, dict) else None
    if isinstance(translations, list):
        fallback = ""
        for translation in translations:
            if not isinstance(translation, dict):
                continue
            if translation.get("locale") == locale:
                return str(translation.get("name") or "")
            if translation.get("locale") == "en":
                fallback = str(translation.get("name") or "")
            elif not fallback:
                fallback = str(translation.get("name") or "")
        return fallback
    return str(item.get("name") or item.get("slug") or "")


def partner_user_from_row(email: str, row: dict[str, Any] | None = None) -> dict[str, Any]:
    data = as_dict(row.get("data")) if row else {}
    partner_data = data.get("partner") if isinstance(data.get("partner"), dict) else {}
    return {
        "email": email,
        "id": data.get("id") or data.get("userId") or (str(row.get("id")) if row else "partner-recovery"),
        "role": "PARTNER_MANAGER",
        "partnerId": data.get("partnerId") or partner_data.get("id") or PARTNER_DEFAULT_ID,
        "displayName": (row or {}).get("display_name") or data.get("name") or "Partner",
    }


def fetch_partner_user(cursor, email: str) -> dict[str, Any]:
    cursor.execute(
        """
        SELECT id, email, display_name, role, data
        FROM profiles
        WHERE email = %s
        LIMIT 1
        """,
        (email,),
    )
    row = cursor.fetchone()
    allowed = {normalize_email(PARTNER_ACCOUNT_EMAIL), normalize_email(ADMIN_API_USER)}
    if row:
        role = str(row.get("role") or "").upper()
        if "PARTNER" in role or email in allowed:
            return partner_user_from_row(email, row)
    if email in allowed:
        return partner_user_from_row(email)
    raise HTTPException(status_code=401, detail="Partner account not found")


def partner_clinic_where(partner: dict[str, Any]) -> tuple[str, list[Any]]:
    partner_id = str(partner.get("partnerId") or PARTNER_DEFAULT_ID)
    email = str(partner.get("email") or "")
    parts = [
        "JSON_UNQUOTE(JSON_EXTRACT(data, '$.partnerId')) = %s",
        "JSON_UNQUOTE(JSON_EXTRACT(data, '$.partner.id')) = %s",
        "JSON_UNQUOTE(JSON_EXTRACT(data, '$.partner.email')) = %s",
        "JSON_UNQUOTE(JSON_EXTRACT(data, '$.ownerEmail')) = %s",
        "JSON_UNQUOTE(JSON_EXTRACT(data, '$.id')) = %s",
    ]
    return "(" + " OR ".join(parts) + ")", [partner_id, partner_id, email, email, PARTNER_DEFAULT_CLINIC_ID]


def normalize_partner_clinic(row: dict[str, Any]) -> dict[str, Any]:
    data = as_dict(row.get("data"))
    languages = data.get("languages") if isinstance(data.get("languages"), list) else []
    services = data.get("services") if isinstance(data.get("services"), list) else []
    return {
        "dbId": row.get("id"),
        "id": data.get("id") or str(row.get("id")),
        "name": row.get("name") or data.get("name"),
        "slug": data.get("slug"),
        "logoUrl": data.get("logoUrl"),
        "location": data.get("location"),
        "country": row.get("country") or data.get("country"),
        "region": data.get("region"),
        "city": row.get("city") or data.get("city"),
        "latitude": data.get("latitude"),
        "longitude": data.get("longitude"),
        "establishedYear": data.get("establishedYear"),
        "hours": data.get("hours"),
        "website": data.get("website"),
        "phone": data.get("phone"),
        "email": data.get("email"),
        "hospitalAffiliations": data.get("hospitalAffiliations"),
        "credentials": data.get("credentials"),
        "honorsAwards": data.get("honorsAwards"),
        "aboutHtml": data.get("aboutHtml"),
        "chatEnabled": bool(data.get("chatEnabled", False)),
        "isActive": bool(data.get("isActive", row.get("status") == "active")),
        "status": row.get("status"),
        "languages": languages,
        "languagesCount": len(languages) if languages else int(data.get("languagesCount") or 0),
        "services": services,
        "servicesCount": len(services) if services else int(data.get("servicesCount") or 0),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }


def fetch_partner_clinic(cursor, partner: dict[str, Any], identifier: str | int) -> dict[str, Any]:
    scope_sql, scope_params = partner_clinic_where(partner)
    raw = str(identifier).strip()
    lookup_parts = ["JSON_UNQUOTE(JSON_EXTRACT(data, '$.id')) = %s", "JSON_UNQUOTE(JSON_EXTRACT(data, '$.slug')) = %s"]
    lookup_params: list[Any] = [raw, raw]
    if raw.isdigit():
        lookup_parts.insert(0, "id = %s")
        lookup_params.insert(0, int(raw))
    cursor.execute(
        f"""
        SELECT id, name, country, city, status, data, created_at, updated_at
        FROM clinics
        WHERE ({' OR '.join(lookup_parts)}) AND {scope_sql}
        LIMIT 1
        """,
        [*lookup_params, *scope_params],
    )
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Clinic not found")
    return row


def require_user(request: Request, authorization: str | None = Header(None)) -> dict[str, Any]:
    tokens = request_session_tokens(request, authorization)
    if not tokens:
        raise HTTPException(status_code=401, detail="Session token required")
    with db_cursor() as (conn, cursor):
        for token in tokens:
            cursor.execute(
                """
                SELECT u.id, u.email, u.display_name, u.role, u.status, u.created_at, s.id AS session_id,
                       u.profile_id, u.email_verified_at, u.password_login_enabled
                FROM auth_sessions s
                JOIN local_users u ON u.id = s.user_id
                WHERE s.token_hash = %s
                  AND s.revoked_at IS NULL
                  AND s.expires_at > UTC_TIMESTAMP()
                  AND u.status = 'ACTIVE'
                LIMIT 1
                """,
                (token_hash(token),),
            )
            row = cursor.fetchone()
            if not row:
                continue
            cursor.execute("UPDATE auth_sessions SET last_seen_at = UTC_TIMESTAMP() WHERE id = %s", (row["session_id"],))
            conn.commit()
            row["_session_token"] = token
            return row
    raise HTTPException(status_code=401, detail="Invalid or expired session")


def optional_user(request: Request, authorization: str | None = Header(None)) -> dict[str, Any] | None:
    if not request_session_token(request, authorization):
        return None
    try:
        return require_user(request, authorization)
    except HTTPException as exc:
        if exc.status_code == 401:
            return None
        raise


def create_session(cursor, user_id: int) -> tuple[str, str]:
    token = secrets.token_urlsafe(42)
    expires = now_utc() + timedelta(days=SESSION_DAYS)
    cursor.execute(
        """
        INSERT INTO auth_sessions (user_id, token_hash, expires_at)
        VALUES (%s, %s, %s)
        """,
        (user_id, token_hash(token), database_datetime(expires)),
    )
    return token, expires.isoformat()


def require_profile_id(user: dict[str, Any]) -> int:
    profile_id = int_or_none(user.get("profile_id"))
    if not profile_id:
        raise HTTPException(status_code=409, detail="This account is not linked to a profile")
    return profile_id


def as_dict(value: Any) -> dict[str, Any]:
    parsed = json_value(value)
    return parsed if isinstance(parsed, dict) else {}


def record_device_session(cursor, profile_id: int, request: Request, source: str) -> None:
    """Persist a factual sign-in record for the admin Devices history."""
    forwarded_for = str(request.headers.get("x-forwarded-for") or "").split(",", 1)[0].strip()
    client_host = getattr(request.client, "host", "") if request.client else ""
    user_agent = str(request.headers.get("user-agent") or "").strip()
    normalized_agent = user_agent.lower()
    device_type = "mobile" if any(token in normalized_agent for token in ("android", "iphone", "ipad", "mobile")) else "desktop"
    data = {
        "profileId": profile_id,
        "signedInAt": now_utc().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": source,
        "ip": forwarded_for or client_host,
        "userAgent": user_agent[:1000],
        "deviceType": device_type,
    }
    cursor.execute(
        """
        INSERT INTO app_entities (entity_type, source_key, title, status, data, created_at, updated_at)
        VALUES ('device_session', %s, %s, 'ACTIVE', %s, UTC_TIMESTAMP(), UTC_TIMESTAMP())
        """,
        (
            f"device-session-{profile_id}-{secrets.token_hex(12)}",
            f"Sign-in session for profile {profile_id}",
            json.dumps(data, ensure_ascii=False),
        ),
    )


def public_profile_summary(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if not row:
        return None
    data = public_safe_data(row.get("data"))
    data = data if isinstance(data, dict) else {}
    return {
        "id": row.get("id"),
        "displayName": row.get("displayName") or row.get("display_name"),
        "role": row.get("role"),
        "status": row.get("status"),
        "country": row.get("country") or data.get("country"),
        "city": row.get("city") or data.get("city"),
        "avatarUrl": row.get("avatarUrl") or data.get("avatarUrl"),
        "profileType": data.get("profileType") or row.get("role"),
        "isVerified": data.get("isVerified"),
        "isPremium": data.get("isPremium"),
        "likedByViewer": row.get("likedByViewer"),
        "likeReadOnly": row.get("likeReadOnly"),
        "likedAt": row.get("likedAt"),
        "matchedAt": row.get("matchedAt"),
        "data": data,
    }


def directory_public_record(row: dict[str, Any], kind: str, include_contact: bool = False) -> dict[str, Any]:
    item = normalize_row(row)
    raw = as_dict(item.pop("data", None))
    safe = public_safe_data(raw)
    safe = safe if isinstance(safe, dict) else {}
    item["data"] = safe
    for key in (
        "slug",
        "logoUrl",
        "photoUrl",
        "location",
        "region",
        "website",
        "hours",
        "aboutHtml",
        "languages",
        "services",
        "practiceAreas",
        "servicesCount",
        "practiceAreasCount",
        "latitude",
        "longitude",
        "facebookUrl",
        "instagramUrl",
        "linkedinUrl",
        "state",
        "zip",
    ):
        if key not in item or item.get(key) is None:
            item[key] = safe.get(key)
    if include_contact:
        contact = {
            "website": raw.get("website"),
            "phone": raw.get("phone") or raw.get("phoneNumber"),
            "fax": raw.get("fax") or raw.get("faxNumber"),
            "email": raw.get("email"),
            "location": raw.get("location") or raw.get("address"),
            "state": raw.get("state"),
            "zip": raw.get("zip"),
            "facebookUrl": raw.get("facebookUrl"),
            "instagramUrl": raw.get("instagramUrl"),
            "linkedinUrl": raw.get("linkedinUrl"),
            "hours": raw.get("hours"),
        }
        item["contact"] = {key: value for key, value in contact.items() if value not in (None, "")}
    item["kind"] = kind
    return item


def inferred_article_category(title: str, slug: str, meta: dict[str, Any]) -> str:
    for key in ("category", "categoryName", "categorySlug"):
        value = meta.get(key)
        if isinstance(value, dict):
            value = value.get("name") or value.get("slug")
        if isinstance(value, str) and value.strip():
            return value.strip()
    haystack = f"{title} {slug}".lower()
    if any(token in haystack for token in ("lgbtq", "lesbian", "gay ", "same-sex")):
        return "lgbtq"
    if any(token in haystack for token in ("co-parent", "co_parent", "coparent")):
        return "co-parenting"
    if any(token in haystack for token in ("sperm donor", "sperm-donor", "sperm donation", "sperm-donation")):
        return "sperm-donor"
    if any(token in haystack for token in ("ivf", "iui", "egg freezing", "egg-freezing", "embryo")):
        return "ivf"
    return "fertility"


def attach_profile_photos(cursor, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    profile_ids = sorted({profile_id for item in items if (profile_id := int_or_none(item.get("id")))})
    if not profile_ids:
        return items
    placeholders = ", ".join(["%s"] * len(profile_ids))
    cursor.execute(
        f"""
        SELECT profile_id AS profileId, public_url AS publicUrl
        FROM profile_photos
        WHERE status = 'ACTIVE' AND moderation_status = 'APPROVED' AND profile_id IN ({placeholders})
        ORDER BY profile_id ASC, position ASC, id ASC
        """,
        profile_ids,
    )
    photos_by_profile: dict[int, list[str]] = {}
    for photo in cursor.fetchall():
        profile_id = int_or_none(photo.get("profileId"))
        public_url = str(photo.get("publicUrl") or "").strip()
        if profile_id and public_url:
            photos_by_profile.setdefault(profile_id, []).append(public_url)
    for item in items:
        profile_id = int_or_none(item.get("id"))
        urls: list[str] = []
        gallery_photos = photos_by_profile.get(profile_id or 0, [])
        for value in gallery_photos or [item.get("avatarUrl")]:
            url = str(value or "").strip()
            if url and url not in urls:
                urls.append(url)
        item["photos"] = urls
    return items


def fetch_profile(cursor, profile_id: int) -> dict[str, Any] | None:
    cursor.execute(
        """
        SELECT id,
               display_name AS displayName,
               role,
               status,
               email,
               JSON_UNQUOTE(JSON_EXTRACT(data, '$.country')) AS country,
               JSON_UNQUOTE(JSON_EXTRACT(data, '$.city')) AS city,
               JSON_UNQUOTE(JSON_EXTRACT(data, '$.avatarUrl')) AS avatarUrl,
               data,
               created_at,
               updated_at
        FROM profiles
        WHERE id = %s
        LIMIT 1
        """,
        (profile_id,),
    )
    return cursor.fetchone()


def fetch_clinic(cursor, clinic_identifier: str | int) -> dict[str, Any]:
    raw = str(clinic_identifier).strip()
    lookup_parts = ["JSON_UNQUOTE(JSON_EXTRACT(data, '$.slug')) = %s", "JSON_UNQUOTE(JSON_EXTRACT(data, '$.id')) = %s"]
    lookup_params: list[Any] = [raw, raw]
    if raw.isdigit():
        lookup_parts.insert(0, "id = %s")
        lookup_params.insert(0, int(raw))
    cursor.execute(
        f"""
        SELECT id, name, country, city, status, created_at, updated_at, data
        FROM clinics
        WHERE ({' OR '.join(lookup_parts)}) AND status = 'active'
        LIMIT 1
        """,
        lookup_params,
    )
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Clinic not found")
    return row


def fetch_lawyer(cursor, lawyer_identifier: str | int) -> dict[str, Any]:
    raw = str(lawyer_identifier).strip()
    lookup_parts = ["JSON_UNQUOTE(JSON_EXTRACT(data, '$.slug')) = %s", "JSON_UNQUOTE(JSON_EXTRACT(data, '$.id')) = %s"]
    lookup_params: list[Any] = [raw, raw]
    if raw.isdigit():
        lookup_parts.insert(0, "id = %s")
        lookup_params.insert(0, int(raw))
    cursor.execute(
        f"""
        SELECT id, name, country, city, status, created_at, updated_at, data
        FROM lawyers
        WHERE ({' OR '.join(lookup_parts)}) AND status = 'active'
        LIMIT 1
        """,
        lookup_params,
    )
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Lawyer not found")
    return row


def resolve_profile_id(cursor, profile_identifier: str | int) -> int:
    raw = str(profile_identifier).strip()
    if not raw:
        raise HTTPException(status_code=422, detail="Profile id is required")
    if raw.isdigit():
        cursor.execute("SELECT id FROM profiles WHERE id = %s AND status = 'ACTIVE' LIMIT 1", (int(raw),))
    else:
        cursor.execute(
            """
            SELECT id
            FROM profiles
            WHERE JSON_UNQUOTE(JSON_EXTRACT(data, '$.id')) = %s
              AND status = 'ACTIVE'
            LIMIT 1
            """,
            (raw,),
        )
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Profile not found")
    return int(row["id"])


def resolve_admin_profile_id(cursor, profile_identifier: str | int) -> int:
    """Resolve an internal id or migrated source UUID for admin-only routes.

    Member actions accept only active profiles. Admin moderation must also reach
    banned and deleted profiles, therefore this resolver has no status predicate.
    """
    raw = str(profile_identifier).strip()
    if not raw:
        raise HTTPException(status_code=422, detail="Profile id is required")
    predicates = ["JSON_UNQUOTE(JSON_EXTRACT(data, '$.id')) = %s"]
    params: list[Any] = [raw]
    if raw.isdigit():
        predicates.insert(0, "id = %s")
        params.insert(0, int(raw))
    cursor.execute(f"SELECT id FROM profiles WHERE {' OR '.join(predicates)} LIMIT 1", params)
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return int(row["id"])


def ordered_pair(profile_a_id: int, profile_b_id: int) -> tuple[int, int]:
    return (profile_a_id, profile_b_id) if profile_a_id < profile_b_id else (profile_b_id, profile_a_id)


def json_bool(data: dict[str, Any], key: str, default: bool = False) -> bool:
    value = data.get(key)
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y", "on", "active", "approved"}
    return default


def profile_data(profile: dict[str, Any] | None) -> dict[str, Any]:
    return as_dict(profile.get("data") if profile else {})


def profile_is_premium(profile: dict[str, Any] | None) -> bool:
    data = profile_data(profile)
    return json_bool(data, "isPremium") or json_bool(data, "premium")


def profile_is_verified(profile: dict[str, Any] | None) -> bool:
    data = profile_data(profile)
    return json_bool(data, "isVerified") or bool(data.get("verifiedAt"))


def profile_has_completed_onboarding(profile: dict[str, Any] | None) -> bool:
    data = profile_data(profile)
    return json_bool(data, "isWizardCompleted") or bool(str(data.get("avatarUrl") or "").strip())


def profile_birth_date(value: Any) -> date | None:
    try:
        return datetime.strptime(str(value or "").strip(), "%Y-%m-%d").date()
    except ValueError:
        return None


def latest_adult_birth_date() -> date:
    today = datetime.now(timezone.utc).date()
    return date(today.year - 18, today.month, today.day)


def profile_has_adult_birth_date(profile: dict[str, Any] | None) -> bool:
    birth_date = profile_birth_date(profile_data(profile).get("dateOfBirth"))
    return birth_date is not None and birth_date <= latest_adult_birth_date()


def catalog_completion_sql(table_name: str = "profiles") -> str:
    return f"""(
      (
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT({table_name}.data, '$.isWizardCompleted')), 'false') = 'true'
        OR NULLIF(NULLIF(JSON_UNQUOTE(JSON_EXTRACT({table_name}.data, '$.avatarUrl')), ''), 'null') IS NOT NULL
      )
      AND (
        (
          TO_DATE(NULLIF(NULLIF(JSON_UNQUOTE(JSON_EXTRACT({table_name}.data, '$.dateOfBirth')), ''), 'null'), 'YYYY-MM-DD') IS NOT NULL
          AND TO_DATE(NULLIF(NULLIF(JSON_UNQUOTE(JSON_EXTRACT({table_name}.data, '$.dateOfBirth')), ''), 'null'), 'YYYY-MM-DD') <= CURRENT_DATE - INTERVAL '18 years'
        )
        OR (
          JSON_UNQUOTE(JSON_EXTRACT({table_name}.data, '$.mismatchKind')) = 'NO_DATA'
          AND NULLIF(NULLIF(JSON_UNQUOTE(JSON_EXTRACT({table_name}.data, '$.profileType')), ''), 'null') IS NOT NULL
          AND NULLIF(NULLIF(JSON_UNQUOTE(JSON_EXTRACT({table_name}.data, '$.country')), ''), 'null') IS NOT NULL
        )
      )
    )"""


def normalize_subscription_plan(value: str) -> str:
    normalized = str(value or "").strip().upper()
    aliases = {
        "MONTHLY": "PREMIUM_MONTHLY",
        "ANNUAL": "PREMIUM_ANNUAL",
        "PREMIUM_MONTHLY": "PREMIUM_MONTHLY",
        "PREMIUM_QUARTERLY": "PREMIUM_QUARTERLY",
        "PREMIUM_ANNUAL": "PREMIUM_ANNUAL",
    }
    plan = aliases.get(normalized)
    if not plan:
        raise HTTPException(status_code=422, detail="Unsupported Premium plan")
    return plan


def subscription_plan_days(plan: str) -> int:
    return {
        "PREMIUM_MONTHLY": 30,
        "PREMIUM_QUARTERLY": 90,
        "PREMIUM_ANNUAL": 365,
    }[normalize_subscription_plan(plan)]


def profile_is_visible_in_catalog(profile: dict[str, Any] | None) -> bool:
    if not profile or profile.get("status") != "ACTIVE" or profile.get("role") != "USER":
        return False
    data = profile_data(profile)
    legacy_catalog_profile = (
        str(data.get("mismatchKind") or "").strip().upper() == "NO_DATA"
        and str(data.get("profileType") or "").strip().lower() not in {"", "null"}
        and str(data.get("country") or "").strip().lower() not in {"", "null"}
    )
    return (
        profile_has_completed_onboarding(profile)
        and (profile_has_adult_birth_date(profile) or legacy_catalog_profile)
        and json_bool(data, "visibleInCatalog", json_bool(data, "isVisibleInCatalog", True))
    )


def has_active_block(cursor, profile_a_id: int, profile_b_id: int) -> bool:
    cursor.execute(
        """
        SELECT id
        FROM profile_blocks
        WHERE status = 'ACTIVE'
          AND (
            (blocker_profile_id = %s AND blocked_profile_id = %s)
            OR (blocker_profile_id = %s AND blocked_profile_id = %s)
          )
        LIMIT 1
        """,
        (profile_a_id, profile_b_id, profile_b_id, profile_a_id),
    )
    return cursor.fetchone() is not None


def active_match_id(cursor, profile_a_id: int, profile_b_id: int) -> int | None:
    low_id, high_id = ordered_pair(profile_a_id, profile_b_id)
    cursor.execute(
        """
        SELECT id
        FROM profile_matches
        WHERE profile_a_id = %s AND profile_b_id = %s AND status = 'ACTIVE'
        LIMIT 1
        """,
        (low_id, high_id),
    )
    row = cursor.fetchone()
    return int(row["id"]) if row else None


def daily_like_count(cursor, profile_id: int) -> int:
    cursor.execute(
        """
        SELECT COUNT(*) AS cnt
        FROM profile_likes
        WHERE actor_profile_id = %s
          AND status = 'ACTIVE'
          AND created_at >= UTC_DATE()
          AND created_at < UTC_DATE() + INTERVAL 1 DAY
        """,
        (profile_id,),
    )
    return int(cursor.fetchone()["cnt"])


def daily_cold_chat_count(cursor, profile_id: int) -> int:
    cursor.execute(
        """
        SELECT COUNT(*) AS cnt
        FROM app_entities
        WHERE entity_type = 'cold_chat_open'
          AND status = 'ACTIVE'
          AND CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$.profileId')) AS UNSIGNED) = %s
          AND created_at >= UTC_DATE()
          AND created_at < UTC_DATE() + INTERVAL 1 DAY
        """,
        (profile_id,),
    )
    return int(cursor.fetchone()["cnt"])


def record_cold_chat_open(cursor, profile_id: int, target_profile_id: int, conversation_id: int) -> None:
    data = {
        "profileId": profile_id,
        "targetProfileId": target_profile_id,
        "conversationId": conversation_id,
        "openedAt": now_utc().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    cursor.execute(
        """
        INSERT INTO app_entities (entity_type, source_key, title, status, data, created_at, updated_at)
        VALUES ('cold_chat_open', %s, %s, 'ACTIVE', %s, UTC_TIMESTAMP(), UTC_TIMESTAMP())
        ON DUPLICATE KEY UPDATE updated_at = updated_at
        """,
        (
            f"cold-chat-{conversation_id}-{profile_id}",
            f"Cold chat {profile_id}->{target_profile_id}",
            json.dumps(data, ensure_ascii=False),
        ),
    )


def record_profile_view(cursor, viewer_profile_id: int, viewed_profile_id: int) -> bool:
    if viewer_profile_id == viewed_profile_id or has_active_block(cursor, viewer_profile_id, viewed_profile_id):
        return False
    source_key = f"local-{viewer_profile_id}-{viewed_profile_id}"
    cursor.execute(
        """
        SELECT id, data
        FROM app_entities
        WHERE entity_type = 'profile_view' AND source_key = %s
        LIMIT 1
        """,
        (source_key,),
    )
    row = cursor.fetchone()
    viewed_at = now_utc().isoformat()
    notification_date = now_utc().date().isoformat()
    if row:
        data = as_dict(row.get("data"))
        should_notify = data.get("notificationDate") != notification_date
        data["viewerProfileId"] = viewer_profile_id
        data["viewedProfileId"] = viewed_profile_id
        data["viewCount"] = int_or_none(data.get("viewCount")) or 0
        data["viewCount"] += 1
        data["lastViewedAt"] = viewed_at
        if should_notify:
            data["notificationDate"] = notification_date
        cursor.execute(
            """
            UPDATE app_entities
            SET status = 'active', data = %s, updated_at = UTC_TIMESTAMP()
            WHERE id = %s
            """,
            (json.dumps(data, ensure_ascii=False), row["id"]),
        )
        return should_notify
    data = {
        "viewerProfileId": viewer_profile_id,
        "viewedProfileId": viewed_profile_id,
        "viewCount": 1,
        "lastViewedAt": viewed_at,
        "notificationDate": notification_date,
    }
    cursor.execute(
        """
        INSERT INTO app_entities (entity_type, source_key, title, status, data, created_at, updated_at)
        VALUES ('profile_view', %s, %s, 'active', %s, UTC_TIMESTAMP(), UTC_TIMESTAMP())
        """,
        (source_key, f"Profile view {viewer_profile_id}->{viewed_profile_id}", json.dumps(data, ensure_ascii=False)),
    )
    return True


def ensure_conversation(cursor, profile_a_id: int, profile_b_id: int, match_id: int | None = None) -> int:
    low_id, high_id = ordered_pair(profile_a_id, profile_b_id)
    cursor.execute(
        """
        INSERT INTO conversations (match_id, profile_a_id, profile_b_id, status, created_at, updated_at)
        VALUES (%s, %s, %s, 'ACTIVE', UTC_TIMESTAMP(), UTC_TIMESTAMP())
        ON DUPLICATE KEY UPDATE
          match_id = COALESCE(VALUES(match_id), match_id),
          status = 'ACTIVE',
          updated_at = UTC_TIMESTAMP()
        """,
        (match_id, low_id, high_id),
    )
    cursor.execute(
        """
        SELECT id
        FROM conversations
        WHERE profile_a_id = %s AND profile_b_id = %s
        LIMIT 1
        """,
        (low_id, high_id),
    )
    return int(cursor.fetchone()["id"])


def require_verified_conversation_action(
    cursor,
    profile_id: int,
    conversation: dict[str, Any],
) -> dict[str, Any]:
    profile_a_id = int(conversation["profile_a_id"])
    profile_b_id = int(conversation["profile_b_id"])
    peer_profile_id = profile_b_id if profile_a_id == profile_id else profile_a_id
    peer_profile = fetch_profile(cursor, peer_profile_id)
    if peer_profile and str(peer_profile.get("role") or "").upper() == "SUPPORT":
        return peer_profile
    actor_profile = fetch_profile(cursor, profile_id)
    if not profile_is_verified(actor_profile):
        raise HTTPException(status_code=403, detail="Verify your profile before contacting other members")
    return peer_profile or {}


def ensure_support_profile(cursor) -> int:
    cursor.execute(
        "SELECT id FROM profiles WHERE role = 'SUPPORT' AND status = 'ACTIVE' ORDER BY id ASC LIMIT 1"
    )
    profile = cursor.fetchone()
    if profile:
        return int(profile["id"])

    cursor.execute(
        "SELECT id FROM profiles WHERE JSON_UNQUOTE(JSON_EXTRACT(data, '$.id')) = %s ORDER BY id ASC LIMIT 1",
        (SUPPORT_PROFILE_SOURCE_ID,),
    )
    profile = cursor.fetchone()
    if profile:
        support_profile_id = int(profile["id"])
        cursor.execute(
            """
            UPDATE profiles
            SET role = 'SUPPORT', display_name = %s, status = 'ACTIVE',
                data = jsonb_set(
                    jsonb_set(
                        jsonb_set(COALESCE(data, '{}'::jsonb), '{id}', to_jsonb(%s::text), true),
                        '{profileType}', '"SUPPORT"'::jsonb, true
                    ),
                    '{isVerified}', 'true'::jsonb, true
                ),
                updated_at = UTC_TIMESTAMP()
            WHERE id = %s
            """,
            (SUPPORT_PROFILE_NAME, SUPPORT_PROFILE_SOURCE_ID, support_profile_id),
        )
        return support_profile_id

    support_data = json.dumps(
        {
            "id": SUPPORT_PROFILE_SOURCE_ID,
            "profileType": "SUPPORT",
            "isVerified": True,
        },
        ensure_ascii=False,
    )
    cursor.execute(
        """
        INSERT INTO profiles (role, display_name, email, status, data, created_at, updated_at)
        VALUES ('SUPPORT', %s, NULL, 'ACTIVE', CAST(%s AS JSONB), UTC_TIMESTAMP(), UTC_TIMESTAMP())
        """,
        (SUPPORT_PROFILE_NAME, support_data),
    )
    return int(cursor.lastrowid)


def ensure_support_conversation(cursor, profile_id: int) -> tuple[int, int] | None:
    cursor.execute(
        "SELECT role, status FROM profiles WHERE id = %s LIMIT 1",
        (profile_id,),
    )
    profile = cursor.fetchone()
    if not profile or str(profile.get("status") or "").upper() != "ACTIVE":
        return None
    if str(profile.get("role") or "").upper() == "SUPPORT":
        return None
    support_profile_id = ensure_support_profile(cursor)
    conversation_id = ensure_conversation(cursor, profile_id, support_profile_id)
    cursor.execute(
        "DELETE FROM conversation_hidden WHERE conversation_id = %s AND profile_id = %s",
        (conversation_id, profile_id),
    )
    return conversation_id, support_profile_id


def send_support_status_message(cursor, profile_id: int, body: str) -> int | None:
    support_conversation = ensure_support_conversation(cursor, profile_id)
    message_body = str(body or "").strip()
    if not support_conversation or not message_body:
        return None
    conversation_id, support_profile_id = support_conversation
    cursor.execute(
        """
        INSERT INTO conversation_messages (conversation_id, sender_profile_id, body, status, created_at)
        VALUES (%s, %s, %s, 'ACTIVE', UTC_TIMESTAMP())
        """,
        (conversation_id, support_profile_id, message_body),
    )
    message_id = int(cursor.lastrowid)
    cursor.execute("UPDATE conversations SET updated_at = UTC_TIMESTAMP() WHERE id = %s", (conversation_id,))
    return message_id


def ensure_support_welcome(cursor, profile_id: int) -> int | None:
    support_conversation = ensure_support_conversation(cursor, profile_id)
    if not support_conversation:
        return None
    conversation_id, support_profile_id = support_conversation
    cursor.execute(
        """
        INSERT IGNORE INTO support_welcome_deliveries (profile_id, support_profile_id, conversation_id, created_at)
        VALUES (%s, %s, %s, UTC_TIMESTAMP())
        """,
        (profile_id, support_profile_id, conversation_id),
    )
    cursor.execute(
        """
        SELECT id
        FROM conversation_messages
        WHERE conversation_id = %s AND sender_profile_id = %s AND body = %s AND status = 'ACTIVE'
        ORDER BY id ASC
        LIMIT 1
        """,
        (conversation_id, support_profile_id, SUPPORT_WELCOME_MESSAGE),
    )
    message = cursor.fetchone()
    if not message:
        cursor.execute(
            """
            INSERT INTO conversation_messages (conversation_id, sender_profile_id, body, status, created_at)
            VALUES (%s, %s, %s, 'ACTIVE', UTC_TIMESTAMP())
            """,
            (conversation_id, support_profile_id, SUPPORT_WELCOME_MESSAGE),
        )
        cursor.execute("UPDATE conversations SET updated_at = UTC_TIMESTAMP() WHERE id = %s", (conversation_id,))
    return conversation_id


def ensure_match(cursor, profile_a_id: int, profile_b_id: int) -> int:
    low_id, high_id = ordered_pair(profile_a_id, profile_b_id)
    cursor.execute(
        """
        INSERT INTO profile_matches (profile_a_id, profile_b_id, status, created_at, updated_at)
        VALUES (%s, %s, 'ACTIVE', UTC_TIMESTAMP(), UTC_TIMESTAMP())
        ON DUPLICATE KEY UPDATE status = 'ACTIVE', updated_at = UTC_TIMESTAMP()
        """,
        (low_id, high_id),
    )
    cursor.execute(
        """
        SELECT id
        FROM profile_matches
        WHERE profile_a_id = %s AND profile_b_id = %s
        LIMIT 1
        """,
        (low_id, high_id),
    )
    return int(cursor.fetchone()["id"])


def update_profile_data(cursor, profile_id: int, updates: dict[str, Any], display_name: str | None = None):
    current = fetch_profile(cursor, profile_id)
    if not current:
        raise HTTPException(status_code=404, detail="Profile not found")
    data = as_dict(current.get("data"))
    for key, value in updates.items():
        data[key] = value
    assignments = ["data = %s", "updated_at = UTC_TIMESTAMP()"]
    params: list[Any] = [json.dumps(data, ensure_ascii=False)]
    if display_name is not None:
        assignments.insert(0, "display_name = %s")
        params.insert(0, display_name)
    params.append(profile_id)
    cursor.execute(f"UPDATE profiles SET {', '.join(assignments)} WHERE id = %s", params)


def conversation_scope_sql() -> str:
    return """
        SELECT c.id, c.match_id, c.profile_a_id, c.profile_b_id, c.status, c.created_at, c.updated_at,
               CASE WHEN c.profile_a_id = %s THEN c.profile_b_id ELSE c.profile_a_id END AS other_profile_id,
               p.display_name AS otherDisplayName,
               p.role AS otherRole,
               JSON_UNQUOTE(JSON_EXTRACT(p.data, '$.avatarUrl')) AS otherAvatarUrl,
               JSON_UNQUOTE(JSON_EXTRACT(p.data, '$.city')) AS otherCity,
               JSON_UNQUOTE(JSON_EXTRACT(p.data, '$.country')) AS otherCountry,
               COALESCE(
                 (
                   SELECT MAX(s.last_seen_at)
                   FROM local_users u
                   JOIN auth_sessions s ON s.user_id = u.id
                   WHERE u.profile_id = p.id
                     AND u.status = 'ACTIVE'
                 ),
                 (
                   SELECT MAX(m.created_at)
                   FROM conversation_messages m
                   WHERE m.conversation_id = c.id
                     AND m.sender_profile_id = p.id
                     AND m.status = 'ACTIVE'
                 )
               ) AS otherLastSeenAt,
               (
                 SELECT body
                 FROM conversation_messages m
                 WHERE m.conversation_id = c.id AND m.status = 'ACTIVE'
                 ORDER BY m.created_at DESC, m.id DESC
                 LIMIT 1
               ) AS lastMessage,
               (
                 SELECT media_url
                 FROM conversation_messages m
                 WHERE m.conversation_id = c.id AND m.status = 'ACTIVE'
                 ORDER BY m.created_at DESC, m.id DESC
                 LIMIT 1
               ) AS lastMessageMediaUrl,
               (
                 SELECT sender_profile_id
                 FROM conversation_messages m
                 WHERE m.conversation_id = c.id AND m.status = 'ACTIVE'
                 ORDER BY m.created_at DESC, m.id DESC
                 LIMIT 1
               ) AS lastMessageSenderProfileId,
               (
                 SELECT created_at
                 FROM conversation_messages m
                 WHERE m.conversation_id = c.id AND m.status = 'ACTIVE'
                 ORDER BY m.created_at DESC, m.id DESC
                 LIMIT 1
               ) AS lastMessageAt,
               (
                 SELECT COUNT(*)
                 FROM conversation_messages m
                 WHERE m.conversation_id = c.id
                   AND m.sender_profile_id <> %s
                   AND m.read_at IS NULL
                   AND m.status = 'ACTIVE'
               ) AS unreadCount
        FROM conversations c
        JOIN profiles p ON p.id = CASE WHEN c.profile_a_id = %s THEN c.profile_b_id ELSE c.profile_a_id END
        WHERE (c.profile_a_id = %s OR c.profile_b_id = %s)
          AND c.status = 'ACTIVE'
          AND p.status = 'ACTIVE'
           AND NOT EXISTS (
             SELECT 1
             FROM profile_blocks b
             WHERE b.status = 'ACTIVE'
               AND (
                 (b.blocker_profile_id = %s AND b.blocked_profile_id = p.id)
                 OR (b.blocker_profile_id = p.id AND b.blocked_profile_id = %s)
               )
           )
          AND NOT EXISTS (
            SELECT 1
            FROM conversation_hidden h
            WHERE h.conversation_id = c.id
              AND h.profile_id = %s
          )
    """


def audit(conn, actor: str, action: str, target_type: str | None = None, target_id: Any = None, payload: Any = None):
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            INSERT INTO admin_audit_log (actor, action, target_type, target_id, payload)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                actor,
                action,
                target_type,
                str(target_id) if target_id is not None else None,
                json.dumps(payload, ensure_ascii=False) if payload is not None else None,
            ),
        )
    finally:
        cursor.close()


@app.get("/api/health")
def health():
    with db_cursor() as (_, cursor):
        cursor.execute("SELECT 1 AS ok")
        row = cursor.fetchone()
    return {"ok": row["ok"] == 1, "database": DB_CONFIG["database"]}


@app.get("/api")
def api_root():
    return {
        "ok": True,
        "service": "Elena LetsBeParents replacement API",
        "docs": "/api/docs",
    }


@app.post("/api/auth/signup")
def auth_signup(payload: SignupPayload, response: Response):
    email = normalize_email(payload.email)
    if "@" not in email or "." not in email.rsplit("@", 1)[-1]:
        raise HTTPException(status_code=422, detail="Valid email is required")
    password_hash = hash_password(payload.password)
    with db_cursor() as (conn, cursor):
        cursor.execute("SELECT id FROM local_users WHERE email = %s LIMIT 1", (email,))
        if cursor.fetchone():
            raise HTTPException(status_code=409, detail="ACCOUNT_ALREADY_EXISTS")
        profile_data = json.dumps(
            {
                "source": "local_signup",
                "email": email,
                "displayName": payload.displayName.strip(),
            },
            ensure_ascii=False,
        )
        cursor.execute(
            """
            INSERT INTO profiles (role, display_name, email, status, data, created_at, updated_at)
            VALUES ('USER', %s, %s, 'ACTIVE', CAST(%s AS JSONB), UTC_TIMESTAMP(), UTC_TIMESTAMP())
            """,
            (payload.displayName.strip(), email, profile_data),
        )
        profile_id = cursor.lastrowid
        cursor.execute(
            """
            INSERT INTO local_users (
                profile_id, email, password_hash, password_login_enabled, display_name,
                role, status, email_verified_at
            )
            VALUES (%s, %s, %s, 1, %s, 'USER', 'ACTIVE', NULL)
            """,
            (profile_id, email, password_hash, payload.displayName.strip()),
        )
        user_id = cursor.lastrowid
        ensure_support_welcome(cursor, int(profile_id))
        token, expires_at = create_session(cursor, user_id)
        verification_token, _ = issue_auth_action_token(
            cursor,
            user_id,
            "VERIFY_EMAIL",
            timedelta(hours=EMAIL_VERIFICATION_HOURS),
        )
        conn.commit()
        cursor.execute(
            """
            SELECT id, profile_id, email, display_name, role, status, email_verified_at,
                   password_login_enabled, created_at
            FROM local_users
            WHERE id = %s
            """,
            (user_id,),
        )
        user = cursor.fetchone()
    email_sent = send_auth_action_email(user_id, email, "VERIFY_EMAIL", verification_token, payload.locale)
    set_user_session_cookie(response, token)
    return {
        "expiresAt": expires_at,
        "user": public_user(user),
        "emailVerificationRequired": True,
        "emailSent": email_sent,
    }


@app.post("/api/auth/firebase")
def auth_firebase(payload: FirebaseAuthPayload, response: Response, request: Request):
    decoded = verify_firebase_token(payload.idToken)
    firebase_uid = str(decoded.get("uid") or decoded.get("sub") or "").strip()
    email = normalize_email(str(decoded.get("email") or ""))
    verified_claim = decoded.get("email_verified", False)
    email_verified = verified_claim is True or str(verified_claim).lower() == "true"
    firebase_claims = decoded.get("firebase") if isinstance(decoded.get("firebase"), dict) else {}
    provider = str(firebase_claims.get("sign_in_provider") or "firebase").strip()[:64]
    identities = firebase_claims.get("identities") if isinstance(firebase_claims.get("identities"), dict) else {}
    provider_identities = identities.get(provider) if isinstance(identities.get(provider), list) else []
    provider_uid = str(provider_identities[0]).strip()[:255] if provider_identities else None

    if not firebase_uid:
        raise HTTPException(status_code=401, detail="Firebase user identifier is missing")
    if "@" not in email or "." not in email.rsplit("@", 1)[-1]:
        raise HTTPException(status_code=422, detail="A valid email is required for social sign-in")
    if not email_verified:
        raise HTTPException(status_code=403, detail="A verified email is required for social sign-in")
    # The migrated PostgreSQL schema keeps this legacy column as SMALLINT.
    # psycopg intentionally does not coerce a Python bool into that type.
    email_verified_flag = 1 if email_verified else 0

    requested_name = (payload.displayName or "").strip()
    token_name = str(decoded.get("name") or "").strip()
    display_name = (requested_name or token_name or email.split("@", 1)[0])[:255]
    is_new_user = False

    with db_cursor() as (conn, cursor):
        cursor.execute(
            """
            SELECT u.id, u.profile_id, u.email, u.password_hash, u.password_login_enabled,
                   u.display_name, u.role, u.status, u.email_verified_at, u.created_at
            FROM firebase_identities fi
            JOIN local_users u ON u.id = fi.user_id
            WHERE fi.firebase_uid = %s
            LIMIT 1
            """,
            (firebase_uid,),
        )
        user = cursor.fetchone()

        if user:
            if user["status"] != "ACTIVE":
                raise HTTPException(status_code=403, detail="ACCOUNT_INACTIVE")
            cursor.execute(
                """
                UPDATE firebase_identities
                SET provider = %s, provider_uid = %s, email = %s,
                    email_verified = %s, last_login_at = UTC_TIMESTAMP()
                WHERE firebase_uid = %s
                """,
                (provider, provider_uid, email, email_verified_flag, firebase_uid),
            )
            cursor.execute(
                "UPDATE local_users SET email_verified_at = COALESCE(email_verified_at, UTC_TIMESTAMP()) WHERE id = %s",
                (user["id"],),
            )
            user["email_verified_at"] = user.get("email_verified_at") or now_utc()
        else:
            cursor.execute(
                """
                SELECT id, profile_id, email, password_hash, password_login_enabled,
                       display_name, role, status, email_verified_at, created_at
                FROM local_users
                WHERE email = %s
                LIMIT 1
                """,
                (email,),
            )
            user = cursor.fetchone()

            if user:
                if user["status"] != "ACTIVE":
                    raise HTTPException(status_code=403, detail="ACCOUNT_INACTIVE")
                if bool(user.get("password_login_enabled")):
                    raise HTTPException(status_code=409, detail="SOCIAL_ACCOUNT_CONFLICT")
                cursor.execute(
                    "SELECT id FROM firebase_identities WHERE user_id = %s LIMIT 1",
                    (user["id"],),
                )
                if cursor.fetchone():
                    raise HTTPException(status_code=409, detail="SOCIAL_ACCOUNT_CONFLICT")
                user_id = user["id"]
                cursor.execute(
                    "UPDATE local_users SET email_verified_at = COALESCE(email_verified_at, UTC_TIMESTAMP()) WHERE id = %s",
                    (user_id,),
                )
            else:
                profile_data = json.dumps(
                    {
                        "source": "firebase_auth",
                        "firebaseUid": firebase_uid,
                        "provider": provider,
                        "email": email,
                        "displayName": display_name,
                        "emailVerified": True,
                    },
                    ensure_ascii=False,
                )
                cursor.execute(
                    """
                    INSERT INTO profiles (role, display_name, email, status, data, created_at, updated_at)
                    VALUES (
                        'USER', %s, %s, 'ACTIVE',
                        CAST(%s AS JSONB),
                        UTC_TIMESTAMP(), UTC_TIMESTAMP()
                    )
                    """,
                    (display_name, email, profile_data),
                )
                profile_id = cursor.lastrowid
                cursor.execute(
                    """
                    INSERT INTO local_users (
                        profile_id, email, password_hash, password_login_enabled, display_name,
                        role, status, email_verified_at
                    )
                    VALUES (%s, %s, '', 0, %s, 'USER', 'ACTIVE', UTC_TIMESTAMP())
                    """,
                    (profile_id, email, display_name),
                )
                user_id = cursor.lastrowid
                is_new_user = True

            cursor.execute(
                """
                INSERT INTO firebase_identities (
                    user_id, firebase_uid, provider, provider_uid, email,
                    email_verified, last_login_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, UTC_TIMESTAMP())
                """,
                (user_id, firebase_uid, provider, provider_uid, email, email_verified_flag),
            )
            cursor.execute(
                """
                SELECT id, profile_id, email, password_hash, password_login_enabled,
                       display_name, role, status, email_verified_at, created_at
                FROM local_users
                WHERE id = %s
                """,
                (user_id,),
            )
            user = cursor.fetchone()

        ensure_support_welcome(cursor, int(user["profile_id"]))
        record_device_session(cursor, int(user["profile_id"]), request, f"social:{provider}")
        token, expires_at = create_session(cursor, user["id"])
        conn.commit()

    set_user_session_cookie(response, token)
    return {
        "expiresAt": expires_at,
        "user": public_user(user),
        "provider": provider,
        "isNewUser": is_new_user,
    }


@app.post("/api/auth/login")
def auth_login(payload: LoginPayload, response: Response, request: Request):
    email = normalize_email(payload.email)
    with db_cursor() as (conn, cursor):
        cursor.execute(
            """
            SELECT id, profile_id, email, password_hash, password_login_enabled, display_name,
                   role, status, email_verified_at, created_at
            FROM local_users
            WHERE email = %s
            LIMIT 1
            """,
            (email,),
        )
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="USER_NOT_FOUND")
        if user["status"] != "ACTIVE":
            raise HTTPException(status_code=403, detail="ACCOUNT_INACTIVE")
        if not bool(user.get("password_login_enabled")):
            raise HTTPException(status_code=409, detail="PASSWORD_LOGIN_UNAVAILABLE")
        if not verify_password(payload.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="INVALID_PASSWORD")
        if password_needs_rehash(user["password_hash"]):
            upgraded_hash = hash_password(payload.password)
            cursor.execute(
                "UPDATE local_users SET password_hash = %s, updated_at = UTC_TIMESTAMP() WHERE id = %s",
                (upgraded_hash, user["id"]),
            )
            user["password_hash"] = upgraded_hash
        ensure_support_welcome(cursor, int(user["profile_id"]))
        record_device_session(cursor, int(user["profile_id"]), request, "password")
        token, expires_at = create_session(cursor, user["id"])
        conn.commit()
    set_user_session_cookie(response, token)
    return {"expiresAt": expires_at, "user": public_user(user)}


@app.get("/api/auth/me")
def auth_me(user: dict[str, Any] = Depends(require_user)):
    # Session consumers need this state to avoid rendering restricted member
    # actions before their corresponding endpoint rejects the request.
    with db_cursor() as (_, cursor):
        profile = fetch_profile(cursor, int(user["profile_id"])) if user.get("profile_id") else None
    result = public_user(user)
    result["profileVerified"] = profile_is_verified(profile)
    result["isPremium"] = profile_is_premium(profile)
    return {"user": result}


@app.post("/api/auth/session/cookie")
def auth_session_cookie(
    request: Request,
    response: Response,
    authorization: str | None = Header(None),
    _user: dict[str, Any] = Depends(require_user),
):
    token = str(_user.get("_session_token") or "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Session token required")
    set_user_session_cookie(response, token)
    return {"ok": True}


@app.post("/api/auth/logout")
def auth_logout(request: Request, response: Response, authorization: str | None = Header(None)):
    tokens = request_session_tokens(request, authorization)
    if tokens:
        with db_cursor() as (conn, cursor):
            for token in tokens:
                cursor.execute(
                    "UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP() WHERE token_hash = %s",
                    (token_hash(token),),
                )
            conn.commit()
    delete_private_cookie(response, COOKIE_SESSION_NAME)
    delete_private_cookie(response, COOKIE_LEGACY_SESSION_NAME)
    return {"ok": True}


@app.post("/api/auth/forgot-password")
def auth_forgot_password(payload: ForgotPasswordPayload):
    email = normalize_email(payload.email)
    reset_delivery = None
    with db_cursor() as (conn, cursor):
        cursor.execute(
            """
            SELECT id, email, display_name, status, password_login_enabled
            FROM local_users
            WHERE email = %s
            LIMIT 1
            """,
            (email,),
        )
        user = cursor.fetchone()
        if user and user["status"] == "ACTIVE":
            reset_token, _ = issue_auth_action_token(
                cursor,
                int(user["id"]),
                "RESET_PASSWORD",
                timedelta(minutes=PASSWORD_RESET_MINUTES),
            )
            reset_delivery = (int(user["id"]), user["email"], reset_token)
        conn.commit()
    if reset_delivery:
        send_auth_action_email(reset_delivery[0], reset_delivery[1], "RESET_PASSWORD", reset_delivery[2], payload.locale)
    return {
        "ok": True,
        "status": "PASSWORD_RESET_EMAIL_SENT",
    }


@app.post("/api/auth/email-verification/resend")
def auth_resend_verification(payload: AuthLocalePayload, user: dict[str, Any] = Depends(require_user)):
    if user.get("email_verified_at"):
        return {"ok": True, "status": "EMAIL_ALREADY_VERIFIED"}
    with db_cursor() as (conn, cursor):
        cursor.execute(
            """
            SELECT id
            FROM auth_action_tokens
            WHERE user_id = %s AND purpose = 'VERIFY_EMAIL'
              AND created_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL %s SECOND)
            LIMIT 1
            """,
            (user["id"], AUTH_EMAIL_RESEND_SECONDS),
        )
        if cursor.fetchone():
            return {"ok": True, "status": "EMAIL_RECENTLY_SENT"}
        verification_token, _ = issue_auth_action_token(
            cursor,
            int(user["id"]),
            "VERIFY_EMAIL",
            timedelta(hours=EMAIL_VERIFICATION_HOURS),
        )
        conn.commit()
    delivered = send_auth_action_email(
        int(user["id"]),
        user["email"],
        "VERIFY_EMAIL",
        verification_token,
        payload.locale,
    )
    return {"ok": True, "status": "EMAIL_SENT" if delivered else "EMAIL_DELIVERY_FAILED"}


@app.post("/api/auth/email-verification/confirm")
def auth_confirm_email(payload: VerifyEmailPayload):
    with db_cursor() as (conn, cursor):
        cursor.execute(
            """
            SELECT t.id, t.user_id
            FROM auth_action_tokens t
            JOIN local_users u ON u.id = t.user_id AND u.status = 'ACTIVE'
            WHERE t.token_hash = %s AND t.purpose = 'VERIFY_EMAIL'
              AND t.used_at IS NULL AND t.revoked_at IS NULL
              AND t.expires_at > UTC_TIMESTAMP()
            LIMIT 1
            FOR UPDATE
            """,
            (token_hash(payload.token),),
        )
        action_token = cursor.fetchone()
        if not action_token:
            raise HTTPException(status_code=400, detail="INVALID_OR_EXPIRED_TOKEN")
        cursor.execute(
            "UPDATE local_users SET email_verified_at = COALESCE(email_verified_at, UTC_TIMESTAMP()) WHERE id = %s",
            (action_token["user_id"],),
        )
        cursor.execute(
            "UPDATE auth_action_tokens SET used_at = UTC_TIMESTAMP() WHERE id = %s",
            (action_token["id"],),
        )
        cursor.execute(
            "UPDATE auth_action_tokens SET revoked_at = UTC_TIMESTAMP() WHERE user_id = %s AND purpose = 'VERIFY_EMAIL' AND id <> %s AND used_at IS NULL AND revoked_at IS NULL",
            (action_token["user_id"], action_token["id"]),
        )
        conn.commit()
    return {"ok": True, "status": "EMAIL_VERIFIED"}


@app.post("/api/auth/reset-password")
def auth_reset_password(payload: ResetPasswordPayload, response: Response):
    with db_cursor() as (conn, cursor):
        cursor.execute(
            """
            SELECT t.id, t.user_id
            FROM auth_action_tokens t
            JOIN local_users u ON u.id = t.user_id AND u.status = 'ACTIVE'
            WHERE t.token_hash = %s AND t.purpose = 'RESET_PASSWORD'
              AND t.used_at IS NULL AND t.revoked_at IS NULL
              AND t.expires_at > UTC_TIMESTAMP()
            LIMIT 1
            FOR UPDATE
            """,
            (token_hash(payload.token),),
        )
        action_token = cursor.fetchone()
        if not action_token:
            raise HTTPException(status_code=400, detail="INVALID_OR_EXPIRED_TOKEN")
        cursor.execute(
            """
            UPDATE local_users
            SET password_hash = %s, password_login_enabled = 1, updated_at = UTC_TIMESTAMP()
            WHERE id = %s
            """,
            (hash_password(payload.password), action_token["user_id"]),
        )
        cursor.execute(
            "UPDATE auth_action_tokens SET used_at = UTC_TIMESTAMP() WHERE id = %s",
            (action_token["id"],),
        )
        cursor.execute(
            "UPDATE auth_action_tokens SET revoked_at = UTC_TIMESTAMP() WHERE user_id = %s AND purpose = 'RESET_PASSWORD' AND id <> %s AND used_at IS NULL AND revoked_at IS NULL",
            (action_token["user_id"], action_token["id"]),
        )
        cursor.execute(
            "UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP() WHERE user_id = %s AND revoked_at IS NULL",
            (action_token["user_id"],),
        )
        conn.commit()
    delete_private_cookie(response, COOKIE_SESSION_NAME)
    delete_private_cookie(response, COOKIE_LEGACY_SESSION_NAME)
    return {"ok": True, "status": "PASSWORD_RESET"}


@app.get("/api/privacy/consent")
def privacy_consent(request: Request, response: Response):
    clear_legacy_site_cookies(response)
    ensure_privacy_cookies(request, response)
    raw_consent = request.cookies.get(COOKIE_CONSENT_NAME)
    preferences = decode_consent_level(raw_consent)
    migrated_consent = False
    if preferences is None:
        stored = encrypted_cookie_value(request, COOKIE_CONSENT_NAME, "consent-preferences")
        if isinstance(stored, dict):
            preferences = normalize_cookie_preferences(stored.get("preferences"))
            migrated_consent = True
    else:
        stored = None

    raw_locale = request.cookies.get(COOKIE_LOCALE_NAME)
    saved_locale = raw_locale if raw_locale in {"en", "ru", "es"} else None
    if saved_locale is None:
        migrated_locale = encrypted_cookie_value(request, COOKIE_LOCALE_NAME, "interface-locale")
        if migrated_locale in {"en", "ru", "es"}:
            saved_locale = migrated_locale
            set_public_cookie(
                response,
                COOKIE_LOCALE_NAME,
                saved_locale,
                COOKIE_LOCALE_DAYS * 24 * 60 * 60,
                secure=False,
            )
    if saved_locale not in {"en", "ru", "es"}:
        saved_locale = None
    if preferences is None:
        return {"ok": True, "saved": False, "preferences": None, "savedAt": None, "locale": saved_locale}
    if migrated_consent:
        set_public_cookie(
            response,
            COOKIE_CONSENT_NAME,
            encode_consent_level(preferences),
            COOKIE_CONSENT_DAYS * 24 * 60 * 60,
        )
    saved_at = stored.get("savedAt") if isinstance(stored, dict) and isinstance(stored.get("savedAt"), str) else None
    return {
        "ok": True,
        "saved": True,
        "preferences": preferences,
        "savedAt": saved_at,
        "locale": saved_locale,
    }


@app.post("/api/privacy/consent")
def save_privacy_consent(payload: CookieConsentPayload, request: Request, response: Response):
    clear_legacy_site_cookies(response)
    consent_id = ensure_privacy_cookies(request, response)
    preferences = normalize_cookie_preferences(payload.model_dump())
    saved_at = now_utc().isoformat()
    set_public_cookie(
        response,
        COOKIE_CONSENT_NAME,
        encode_consent_level(preferences),
        COOKIE_CONSENT_DAYS * 24 * 60 * 60,
    )
    if preferences["preferences"]:
        set_public_cookie(
            response,
            COOKIE_LOCALE_NAME,
            payload.locale,
            COOKIE_LOCALE_DAYS * 24 * 60 * 60,
            secure=False,
        )
    else:
        delete_public_cookie(response, COOKIE_LOCALE_NAME, secure=False)
    return {
        "ok": True,
        "saved": True,
        "preferences": preferences,
        "savedAt": saved_at,
        "locale": payload.locale if preferences["preferences"] else None,
    }


@app.post("/api/public/contact")
def public_contact(payload: ContactPayload):
    body = {
        "name": payload.name,
        "email": normalize_email(payload.email) if payload.email else None,
        "subject": payload.subject,
        "message": payload.message,
        "payload": payload.payload,
    }
    with db_cursor() as (conn, cursor):
        cursor.execute(
            """
            INSERT INTO api_events (event_type, payload)
            VALUES ('public.contact', %s)
            """,
            (json.dumps(body, ensure_ascii=False),),
        )
        conn.commit()
    return {"ok": True, "message": "Message sent"}


@app.post("/api/partner/login")
def partner_login(payload: PartnerLoginPayload):
    if not PARTNER_API_PASSWORD:
        raise HTTPException(status_code=503, detail="Partner API password is not configured")
    email = normalize_email(payload.email)
    if not secrets.compare_digest(payload.password, PARTNER_API_PASSWORD):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    with db_cursor() as (_, cursor):
        user = fetch_partner_user(cursor, email)
    token, expires_at = sign_partner_token(user)
    return {"token": token, "expiresAt": expires_at, "user": user}


@app.get("/api/partner/me")
def partner_me(partner: dict[str, Any] = Depends(require_partner)):
    scope_sql, scope_params = partner_clinic_where(partner)
    with db_cursor() as (_, cursor):
        cursor.execute(f"SELECT COUNT(*) AS cnt FROM clinics WHERE {scope_sql}", scope_params)
        clinic_count = int(cursor.fetchone()["cnt"])
    return {"user": partner, "counts": {"clinics": clinic_count, "chats": 0, "unansweredChats": 0}}


@app.get("/api/partner/services")
def partner_services(_partner: dict[str, Any] = Depends(require_partner)):
    with db_cursor() as (_, cursor):
        cursor.execute(
            """
            SELECT data
            FROM app_entities
            WHERE entity_type = 'partner_service_category'
              AND COALESCE(status, 'active') = 'active'
            ORDER BY CAST(JSON_EXTRACT(data, '$.sortOrder') AS UNSIGNED), id
            """
        )
        items = [as_dict(row.get("data")) for row in cursor.fetchall()]
    if items:
        return {"items": items, "source": "database"}
    return {"items": load_partner_services(), "source": "file"}


@app.get("/api/partner/clinics")
def partner_clinics(partner: dict[str, Any] = Depends(require_partner)):
    scope_sql, scope_params = partner_clinic_where(partner)
    with db_cursor() as (_, cursor):
        cursor.execute(
            f"""
            SELECT id, name, country, city, status, data, created_at, updated_at
            FROM clinics
            WHERE {scope_sql}
            ORDER BY name ASC
            """,
            scope_params,
        )
        items = [normalize_partner_clinic(row) for row in cursor.fetchall()]
    return {"items": items, "total": len(items)}


@app.post("/api/partner/clinics")
def partner_create_clinic(payload: PartnerClinicCreatePayload, partner: dict[str, Any] = Depends(require_partner)):
    values = payload.values or {}
    name = str(values.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="Clinic name is required")
    country = str(values.get("country") or "").strip() or None
    city = str(values.get("city") or "").strip() or None
    is_active = bool(values.get("isActive", True))
    editable = {
        "name",
        "logoUrl",
        "location",
        "country",
        "region",
        "city",
        "latitude",
        "longitude",
        "establishedYear",
        "hours",
        "website",
        "phone",
        "email",
        "hospitalAffiliations",
        "credentials",
        "honorsAwards",
        "aboutHtml",
        "isActive",
        "languages",
        "services",
    }
    data = {key: value for key, value in values.items() if key in editable}
    if not isinstance(data.get("languages", []), list):
        raise HTTPException(status_code=422, detail="languages must be an array")
    if not isinstance(data.get("services", []), list):
        raise HTTPException(status_code=422, detail="services must be an array")
    data["id"] = str(uuid.uuid4())
    data["name"] = name
    data["isActive"] = is_active
    data["partnerId"] = partner.get("partnerId") or PARTNER_DEFAULT_ID
    data["partner"] = {
        "id": partner.get("partnerId") or PARTNER_DEFAULT_ID,
        "email": partner.get("email"),
        "name": partner.get("displayName") or "Partner",
    }
    data["languages"] = data.get("languages") or ["en"]
    data["services"] = data.get("services") or []
    data["languagesCount"] = len(data["languages"])
    data["servicesCount"] = len(data["services"])
    with db_cursor() as (conn, cursor):
        data["slug"] = unique_clinic_slug(cursor, str(values.get("slug") or name))
        cursor.execute(
            """
            INSERT INTO clinics (name, country, city, status, data, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, UTC_TIMESTAMP(), UTC_TIMESTAMP())
            """,
            (name, country, city, "active" if is_active else "inactive", json.dumps(data, ensure_ascii=False)),
        )
        item_id = cursor.lastrowid
        audit(conn, partner.get("email") or "partner", "partner.create_clinic", "clinics", item_id, data)
        conn.commit()
        row = fetch_partner_clinic(cursor, partner, item_id)
    return {"ok": True, "clinic": normalize_partner_clinic(row)}


@app.get("/api/partner/clinics/{clinic_identifier}")
def partner_clinic_detail(clinic_identifier: str, partner: dict[str, Any] = Depends(require_partner)):
    with db_cursor() as (_, cursor):
        row = fetch_partner_clinic(cursor, partner, clinic_identifier)
    return normalize_partner_clinic(row)


@app.patch("/api/partner/clinics/{clinic_identifier}")
def partner_update_clinic(
    clinic_identifier: str,
    payload: PartnerClinicPatchPayload,
    partner: dict[str, Any] = Depends(require_partner),
):
    editable = {
        "name",
        "slug",
        "logoUrl",
        "location",
        "country",
        "region",
        "city",
        "latitude",
        "longitude",
        "establishedYear",
        "hours",
        "website",
        "phone",
        "email",
        "hospitalAffiliations",
        "credentials",
        "honorsAwards",
        "aboutHtml",
        "isActive",
        "languages",
        "services",
    }
    values = {key: value for key, value in payload.values.items() if key in editable}
    if not values:
        raise HTTPException(status_code=422, detail="No allowed fields to update")
    if "languages" in values and not isinstance(values["languages"], list):
        raise HTTPException(status_code=422, detail="languages must be an array")
    if "services" in values and not isinstance(values["services"], list):
        raise HTTPException(status_code=422, detail="services must be an array")
    with db_cursor() as (conn, cursor):
        row = fetch_partner_clinic(cursor, partner, clinic_identifier)
        data = as_dict(row.get("data"))
        data.update(values)
        if "services" in values:
            data["servicesCount"] = len(values["services"])
        if "languages" in values:
            data["languagesCount"] = len(values["languages"])
        assignments = ["data = %s", "updated_at = UTC_TIMESTAMP()"]
        params: list[Any] = [json.dumps(data, ensure_ascii=False)]
        if "name" in values:
            assignments.insert(0, "name = %s")
            params.insert(0, values["name"])
        if "country" in values:
            assignments.insert(0, "country = %s")
            params.insert(0, values["country"])
        if "city" in values:
            assignments.insert(0, "city = %s")
            params.insert(0, values["city"])
        if "isActive" in values:
            assignments.insert(0, "status = %s")
            params.insert(0, "active" if values["isActive"] else "inactive")
        params.append(row["id"])
        cursor.execute(f"UPDATE clinics SET {', '.join(assignments)} WHERE id = %s", params)
        audit(conn, partner.get("email") or "partner", "partner.update_clinic", "clinics", row["id"], values)
        conn.commit()
        row = fetch_partner_clinic(cursor, partner, row["id"])
    return {"ok": True, "clinic": normalize_partner_clinic(row)}


@app.post("/api/partner/clinics/{clinic_identifier}/logo")
async def partner_upload_clinic_logo(
    clinic_identifier: str,
    file: UploadFile = File(...),
    partner: dict[str, Any] = Depends(require_partner),
):
    content_type = (file.content_type or "").split(";")[0].lower()
    ext = ALLOWED_IMAGE_TYPES.get(content_type)
    if not ext:
        raise HTTPException(status_code=415, detail="Only JPEG, PNG and WebP images are supported")
    body = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(body) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Logo file is too large")
    if not body:
        raise HTTPException(status_code=422, detail="Logo file is empty")
    with db_cursor() as (conn, cursor):
        row = fetch_partner_clinic(cursor, partner, clinic_identifier)
        storage_dir = UPLOAD_DIR / "clinics" / str(row["id"])
        storage_dir.mkdir(parents=True, exist_ok=True)
        storage_name = f"logo-{int(now_utc().timestamp())}-{secrets.token_hex(6)}{ext}"
        storage_path = storage_dir / storage_name
        storage_path.write_bytes(body)
        storage_key = f"clinics/{row['id']}/{storage_name}"
        public_url = f"{UPLOAD_URL_PREFIX.rstrip('/')}/{storage_key}"
        metadata = {
            "originalName": file.filename,
            "clinicId": row["id"],
            "purpose": "partner_logo",
        }
        cursor.execute(
            """
            INSERT INTO media_files (storage_key, public_url, mime_type, bytes, metadata)
            VALUES (%s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE public_url = VALUES(public_url), mime_type = VALUES(mime_type), bytes = VALUES(bytes), metadata = VALUES(metadata)
            """,
            (storage_key, public_url, content_type, len(body), json.dumps(metadata, ensure_ascii=False)),
        )
        data = as_dict(row.get("data"))
        data["logoUrl"] = public_url
        cursor.execute("UPDATE clinics SET data = %s, updated_at = UTC_TIMESTAMP() WHERE id = %s", (json.dumps(data, ensure_ascii=False), row["id"]))
        audit(conn, partner.get("email") or "partner", "partner.upload_clinic_logo", "clinics", row["id"], {"publicUrl": public_url})
        conn.commit()
        row = fetch_partner_clinic(cursor, partner, row["id"])
    return {"ok": True, "publicUrl": public_url, "clinic": normalize_partner_clinic(row)}


@app.get("/api/partner/clinics/{clinic_identifier}/visitors")
def partner_clinic_visitors(clinic_identifier: str, partner: dict[str, Any] = Depends(require_partner)):
    with db_cursor() as (_, cursor):
        row = fetch_partner_clinic(cursor, partner, clinic_identifier)
        clinic = normalize_partner_clinic(row)
        source_id = str(clinic.get("id") or "")
        local_id = int(row["id"])
        cursor.execute(
            """
            SELECT
              e.id,
              e.source_key AS sourceKey,
              e.status,
              e.created_at AS createdAt,
              e.updated_at AS updatedAt,
              e.data,
              p.id AS profileLocalId,
              p.display_name AS profileName,
              p.email AS profileEmail,
              p.role AS profileRole,
              JSON_UNQUOTE(JSON_EXTRACT(p.data, '$.profileType')) AS profileType,
              JSON_UNQUOTE(JSON_EXTRACT(p.data, '$.city')) AS city,
              JSON_UNQUOTE(JSON_EXTRACT(p.data, '$.country')) AS country
            FROM app_entities e
            LEFT JOIN profiles p
              ON p.id = CAST(NULLIF(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(e.data, '$.profileLocalId')), ''), 'null') AS UNSIGNED)
            WHERE e.entity_type = 'favourite_clinic'
              AND COALESCE(e.status, 'active') <> 'archived'
              AND (
                JSON_UNQUOTE(JSON_EXTRACT(e.data, '$.clinicId')) = %s
                OR CAST(NULLIF(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(e.data, '$.clinicLocalId')), ''), 'null') AS UNSIGNED) = %s
              )
            ORDER BY COALESCE(e.updated_at, e.created_at) DESC, e.id DESC
            LIMIT 100
            """,
            (source_id, local_id),
        )
        items = []
        for item in cursor.fetchall():
            data = as_dict(item.get("data"))
            items.append({
                "id": item.get("id"),
                "sourceKey": item.get("sourceKey"),
                "status": item.get("status"),
                "createdAt": data.get("createdAt") or item.get("createdAt"),
                "updatedAt": item.get("updatedAt"),
                "profileLocalId": item.get("profileLocalId") or data.get("profileLocalId"),
                "profileName": item.get("profileName") or "Member",
                "profileType": item.get("profileType") or data.get("profileType") or "",
                "city": item.get("city") or "",
                "country": item.get("country") or "",
                "kind": "favourite_clinic",
            })
    return {"items": items, "total": len(items), "clinic": {"id": source_id, "dbId": local_id, "name": clinic.get("name")}}


@app.get("/api/partner/chats")
def partner_chats(status_filter: str | None = Query(None, alias="status"), _partner: dict[str, Any] = Depends(require_partner)):
    return {
        "items": [],
        "total": 0,
        "unanswered": 0,
        "status": status_filter or "all",
    }


def member_unread_like_count(cursor, profile_id: int, read_through_id: int) -> int:
    cursor.execute(
        """
        SELECT COUNT(*) AS cnt
        FROM profile_likes l
        JOIN profiles p ON p.id = l.actor_profile_id
        WHERE l.target_profile_id = %s
          AND l.status = 'ACTIVE'
          AND l.id > %s
          AND p.status = 'ACTIVE'
          AND NOT EXISTS (
            SELECT 1 FROM profile_blocks b
            WHERE b.status = 'ACTIVE'
              AND ((b.blocker_profile_id = %s AND b.blocked_profile_id = p.id)
                OR (b.blocker_profile_id = p.id AND b.blocked_profile_id = %s))
          )
        """,
        (profile_id, read_through_id, profile_id, profile_id),
    )
    return int(cursor.fetchone()["cnt"] or 0)


def member_unread_message_count(cursor, profile_id: int) -> int:
    cursor.execute(
        """
        SELECT COUNT(*) AS cnt
        FROM conversation_messages m
        JOIN conversations c ON c.id = m.conversation_id
        JOIN profiles p
          ON p.id = CASE WHEN c.profile_a_id = %s THEN c.profile_b_id ELSE c.profile_a_id END
        WHERE (c.profile_a_id = %s OR c.profile_b_id = %s)
          AND m.sender_profile_id <> %s
          AND m.read_at IS NULL
          AND m.status = 'ACTIVE'
          AND LOWER(COALESCE(c.status, 'active')) = 'active'
          AND p.status = 'ACTIVE'
          AND NOT EXISTS (
            SELECT 1 FROM profile_blocks b
            WHERE b.status = 'ACTIVE'
              AND ((b.blocker_profile_id = %s AND b.blocked_profile_id = p.id)
                OR (b.blocker_profile_id = p.id AND b.blocked_profile_id = %s))
          )
        """,
        (profile_id, profile_id, profile_id, profile_id, profile_id, profile_id),
    )
    return int(cursor.fetchone()["cnt"] or 0)


@app.get("/api/member/me")
def member_me(user: dict[str, Any] = Depends(require_user)):
    profile_id = require_profile_id(user)
    with db_cursor() as (_, cursor):
        profile = fetch_profile(cursor, profile_id)
        profile_data_value = as_dict(profile.get("data") if profile else {})
        try:
            likes_viewed_id = max(0, int(profile_data_value.get("lastLikesViewedId") or 0))
        except (TypeError, ValueError):
            likes_viewed_id = 0
        cursor.execute(
            """
            SELECT id
            FROM profile_photos
            WHERE profile_id = %s AND position = 0 AND status = 'ACTIVE'
              AND upload_status = 'COMMITTED' AND moderation_status = 'APPROVED'
            ORDER BY id DESC
            LIMIT 1
            """,
            (profile_id,),
        )
        approved_primary = cursor.fetchone()
        cursor.execute(
            """
            SELECT pp.id,
                   CASE
                     WHEN pp.public_url IS NULL OR pp.public_url = '' THEN CONCAT('/api/member/photos/', pp.id, '/content')
                     ELSE pp.public_url
                   END AS publicUrl,
                   CASE
                     WHEN pp.avatar_media_file_id IS NULL THEN NULL
                     WHEN amf.public_url IS NULL OR amf.public_url = '' THEN CONCAT('/api/member/photos/', pp.id, '/avatar-content')
                     ELSE amf.public_url
                   END AS avatarUrl,
                   pp.position, pp.status,
                   pp.upload_status AS uploadStatus,
                   pp.moderation_status AS moderationStatus,
                   pp.moderation_reason AS moderationReason,
                   pp.created_at, pp.updated_at
            FROM profile_photos pp
            LEFT JOIN media_files amf ON amf.id = pp.avatar_media_file_id
            WHERE pp.profile_id = %s AND pp.status IN ('ACTIVE', 'PENDING', 'REJECTED')
            ORDER BY pp.position ASC,
                     CASE pp.status WHEN 'PENDING' THEN 0 WHEN 'REJECTED' THEN 1 ELSE 2 END,
                     pp.id DESC
            """,
            (profile_id,),
        )
        photos = cursor.fetchall()
        cursor.execute(
            """
            SELECT
              (SELECT COUNT(*)
                 FROM profile_likes l
                 JOIN profiles p ON p.id = l.actor_profile_id
                WHERE l.target_profile_id = %s AND l.status = 'ACTIVE'
                  AND p.status = 'ACTIVE'
                  AND l.id > %s
                  AND NOT EXISTS (
                    SELECT 1 FROM profile_blocks b
                    WHERE b.status = 'ACTIVE'
                      AND ((b.blocker_profile_id = %s AND b.blocked_profile_id = p.id)
                        OR (b.blocker_profile_id = p.id AND b.blocked_profile_id = %s))
                  )) AS likesYou,
              (SELECT COUNT(*)
                 FROM profile_likes l
                 JOIN profiles p ON p.id = l.target_profile_id
                WHERE l.actor_profile_id = %s AND l.status = 'ACTIVE'
                  AND p.status = 'ACTIVE'
                  AND NOT EXISTS (
                    SELECT 1 FROM profile_blocks b
                    WHERE b.status = 'ACTIVE'
                      AND ((b.blocker_profile_id = %s AND b.blocked_profile_id = p.id)
                        OR (b.blocker_profile_id = p.id AND b.blocked_profile_id = %s))
                  )) AS myLikes,
              (SELECT COUNT(*)
                 FROM profile_matches m
                 JOIN profiles p ON p.id = CASE WHEN m.profile_a_id = %s THEN m.profile_b_id ELSE m.profile_a_id END
                WHERE (m.profile_a_id = %s OR m.profile_b_id = %s) AND m.status = 'ACTIVE'
                  AND p.status = 'ACTIVE'
                  AND NOT EXISTS (
                    SELECT 1 FROM profile_blocks b
                    WHERE b.status = 'ACTIVE'
                      AND ((b.blocker_profile_id = %s AND b.blocked_profile_id = p.id)
                        OR (b.blocker_profile_id = p.id AND b.blocked_profile_id = %s))
                  )) AS matches,
              (SELECT COUNT(*)
                 FROM conversation_messages m
                 JOIN conversations c ON c.id = m.conversation_id
                 JOIN profiles p
                   ON p.id = CASE WHEN c.profile_a_id = %s THEN c.profile_b_id ELSE c.profile_a_id END
                 WHERE (c.profile_a_id = %s OR c.profile_b_id = %s)
                   AND m.sender_profile_id <> %s
                   AND m.read_at IS NULL
                   AND m.status = 'ACTIVE'
                   AND LOWER(COALESCE(c.status, 'active')) = 'active'
                   AND p.status = 'ACTIVE'
                   AND NOT EXISTS (
                     SELECT 1
                     FROM profile_blocks b
                     WHERE b.status = 'ACTIVE'
                       AND (
                         (b.blocker_profile_id = %s AND b.blocked_profile_id = p.id)
                         OR (b.blocker_profile_id = p.id AND b.blocked_profile_id = %s)
                       )
                   )) AS unreadMessages
            """,
            (
                profile_id, likes_viewed_id, profile_id, profile_id,
                profile_id, profile_id, profile_id,
                profile_id, profile_id, profile_id, profile_id, profile_id,
                profile_id, profile_id, profile_id, profile_id, profile_id, profile_id,
            ),
        )
        counts = cursor.fetchone()
    return {
        "user": public_user(user),
        "profile": public_profile_summary(profile),
        "photos": photos,
        "counts": counts,
    }


@app.get("/api/member/counters")
def member_counters(user: dict[str, Any] = Depends(require_user)):
    profile_id = require_profile_id(user)
    with db_cursor() as (_, cursor):
        profile = fetch_profile(cursor, profile_id)
        profile_data_value = as_dict(profile.get("data") if profile else {})
        try:
            likes_viewed_id = max(0, int(profile_data_value.get("lastLikesViewedId") or 0))
        except (TypeError, ValueError):
            likes_viewed_id = 0
        cursor.execute(
            """
            SELECT
              (SELECT COUNT(*)
                 FROM profile_likes l
                 JOIN profiles p ON p.id = l.actor_profile_id
                WHERE l.target_profile_id = %s AND l.status = 'ACTIVE'
                  AND p.status = 'ACTIVE' AND l.id > %s
                  AND NOT EXISTS (
                    SELECT 1 FROM profile_blocks b
                    WHERE b.status = 'ACTIVE'
                      AND ((b.blocker_profile_id = %s AND b.blocked_profile_id = p.id)
                        OR (b.blocker_profile_id = p.id AND b.blocked_profile_id = %s))
                  )) AS likesYou,
              (SELECT COUNT(*)
                 FROM conversation_messages m
                 JOIN conversations c ON c.id = m.conversation_id
                 JOIN profiles p
                   ON p.id = CASE WHEN c.profile_a_id = %s THEN c.profile_b_id ELSE c.profile_a_id END
                WHERE (c.profile_a_id = %s OR c.profile_b_id = %s)
                  AND m.sender_profile_id <> %s
                  AND m.read_at IS NULL AND m.status = 'ACTIVE'
                  AND LOWER(COALESCE(c.status, 'active')) = 'active'
                  AND p.status = 'ACTIVE'
                  AND NOT EXISTS (
                    SELECT 1 FROM profile_blocks b
                    WHERE b.status = 'ACTIVE'
                      AND ((b.blocker_profile_id = %s AND b.blocked_profile_id = p.id)
                        OR (b.blocker_profile_id = p.id AND b.blocked_profile_id = %s))
                  )) AS unreadMessages
            """,
            (
                profile_id, likes_viewed_id, profile_id, profile_id,
                profile_id, profile_id, profile_id, profile_id, profile_id, profile_id,
            ),
        )
        counts = cursor.fetchone() or {}
    return {"counts": counts}


@app.get("/api/member/settings")
def member_settings(user: dict[str, Any] = Depends(require_user)):
    profile_id = require_profile_id(user)
    with db_cursor() as (_, cursor):
        profile = fetch_profile(cursor, profile_id)
    data = as_dict(profile.get("data") if profile else {})
    notifications = data.get("notificationSettings")
    if not isinstance(notifications, list):
        notifications = DEFAULT_NOTIFICATION_SETTINGS
    return {
        "interfaceLanguage": data.get("interfaceLanguage") or "en",
        "notificationSettings": notifications,
        "visibleInCatalog": data.get("visibleInCatalog", data.get("isVisibleInCatalog", True)),
        "betaFlags": data.get("betaFlags") if isinstance(data.get("betaFlags"), dict) else {},
    }


@app.patch("/api/member/settings")
def member_update_settings(payload: MemberSettingsPayload, user: dict[str, Any] = Depends(require_user)):
    profile_id = require_profile_id(user)
    updates: dict[str, Any] = {}
    if payload.interfaceLanguage is not None:
        updates["interfaceLanguage"] = payload.interfaceLanguage
    if payload.notificationSettings is not None:
        updates["notificationSettings"] = payload.notificationSettings
    if payload.visibleInCatalog is not None:
        updates["visibleInCatalog"] = payload.visibleInCatalog
        updates["isVisibleInCatalog"] = payload.visibleInCatalog
    if payload.betaFlags is not None:
        updates["betaFlags"] = payload.betaFlags
    if not updates:
        raise HTTPException(status_code=422, detail="No settings to update")
    with db_cursor() as (conn, cursor):
        update_profile_data(cursor, profile_id, updates)
        cursor.execute(
            """
            INSERT INTO api_events (event_type, payload)
            VALUES ('member.settings_updated', %s)
            """,
            (json.dumps({"profileId": profile_id, "updates": updates}, ensure_ascii=False),),
        )
        conn.commit()
    return {"ok": True, "settings": updates}


@app.patch("/api/member/profile")
def member_update_profile(payload: ProfileUpdatePayload, user: dict[str, Any] = Depends(require_user)):
    profile_id = require_profile_id(user)
    display_name = payload.displayName.strip() if payload.displayName is not None else None
    if display_name == "":
        raise HTTPException(status_code=422, detail="Display name cannot be empty")
    raw = payload.model_dump(exclude_unset=True)
    updates: dict[str, Any] = {}
    for key, value in raw.items():
        if isinstance(value, str):
            value = value.strip()
        if isinstance(value, list):
            value = [str(item).strip() for item in value if str(item).strip()]
        updates[key] = value
    if "displayName" in raw:
        updates["displayName"] = display_name
    if not updates.get("dateOfBirth"):
        raise HTTPException(status_code=422, detail="Date of birth is required")
    birth_date = profile_birth_date(updates["dateOfBirth"])
    if birth_date is None:
        raise HTTPException(status_code=422, detail="Date of birth must use YYYY-MM-DD format")
    latest_allowed_birth_date = latest_adult_birth_date()
    if birth_date > latest_allowed_birth_date:
        raise HTTPException(status_code=422, detail=f"You must be at least 18 years old (born on or before {latest_allowed_birth_date.isoformat()}).")
    today = datetime.now(timezone.utc).date()
    updates["age"] = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
    if "about" in updates and "bio" not in updates:
        updates["bio"] = updates["about"]
    if "bio" in updates and "about" not in updates:
        updates["about"] = updates["bio"]
    if "visibleInCatalog" in updates:
        updates["isVisibleInCatalog"] = updates["visibleInCatalog"]
    with db_cursor() as (conn, cursor):
        update_profile_data(cursor, profile_id, updates, display_name=display_name)
        if display_name is not None:
            cursor.execute("UPDATE local_users SET display_name = %s, updated_at = UTC_TIMESTAMP() WHERE id = %s", (display_name, user["id"]))
        conn.commit()
        profile = fetch_profile(cursor, profile_id)
    return {"ok": True, "profile": public_profile_summary(profile)}


@app.get("/api/member/photos")
def member_photos(user: dict[str, Any] = Depends(require_user)):
    profile_id = require_profile_id(user)
    with db_cursor() as (_, cursor):
        cursor.execute(
            """
            SELECT pp.id,
                   CASE
                     WHEN pp.public_url IS NULL OR pp.public_url = '' THEN CONCAT('/api/member/photos/', pp.id, '/content')
                     ELSE pp.public_url
                   END AS publicUrl,
                   CASE
                     WHEN pp.avatar_media_file_id IS NULL THEN NULL
                     WHEN amf.public_url IS NULL OR amf.public_url = '' THEN CONCAT('/api/member/photos/', pp.id, '/avatar-content')
                     ELSE amf.public_url
                   END AS avatarUrl,
                   pp.position, pp.status,
                   pp.upload_status AS uploadStatus,
                   pp.moderation_status AS moderationStatus,
                   pp.moderation_reason AS moderationReason,
                   pp.created_at, pp.updated_at
            FROM profile_photos pp
            LEFT JOIN media_files amf ON amf.id = pp.avatar_media_file_id
            WHERE pp.profile_id = %s AND pp.status IN ('ACTIVE', 'PENDING', 'REJECTED')
            ORDER BY pp.position ASC,
                     CASE pp.status WHEN 'PENDING' THEN 0 WHEN 'REJECTED' THEN 1 ELSE 2 END,
                     pp.id DESC
            """,
            (profile_id,),
        )
        photos = cursor.fetchall()
    return {"items": photos}


async def read_profile_image(file: UploadFile) -> tuple[str, str, bytes, dict[str, Any]]:
    content_type = (file.content_type or "").split(";")[0].lower()
    ext = ALLOWED_IMAGE_TYPES.get(content_type)
    if not ext:
        raise HTTPException(status_code=415, detail="Only JPEG, PNG and WebP images are supported")
    body = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(body) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Photo is too large")
    if not body:
        raise HTTPException(status_code=422, detail="Photo file is empty")
    normalized_content_type, normalized_ext, normalized_body, metadata = normalize_profile_image(body)
    metadata["declaredContentType"] = content_type
    metadata["originalBytes"] = len(body)
    return normalized_content_type, normalized_ext, normalized_body, metadata


def profile_photo_content_response(photo: dict[str, Any]) -> Response:
    storage_key = str(photo.get("storageKey") or "").strip().lstrip("/")
    if storage_key.startswith("quarantine/"):
        storage_path = safe_storage_path(PRIVATE_UPLOAD_DIR, storage_key[len("quarantine/"):])
        cache_control = "private, no-store"
    else:
        storage_path = safe_storage_path(UPLOAD_DIR, storage_key) if storage_key else None
        cache_control = "private, max-age=300"
    if storage_path and storage_path.is_file():
        return Response(
            content=storage_path.read_bytes(),
            media_type=str(photo.get("mimeType") or "application/octet-stream"),
            headers={"Cache-Control": cache_control, "X-Content-Type-Options": "nosniff"},
        )
    public_url = str(photo.get("publicUrl") or "").strip()
    if not re.match(r"^https?://", public_url, re.IGNORECASE):
        raise HTTPException(status_code=404, detail="Photo source is unavailable")
    try:
        request = urllib.request.Request(public_url, headers={"User-Agent": "LetsBeParents/1.0", "Accept": "image/*"})
        with urllib.request.urlopen(request, timeout=15) as remote:
            content_type = (remote.headers.get_content_type() or "").lower()
            body = remote.read(MAX_UPLOAD_BYTES + 1)
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="Could not load the profile photo") from exc
    if content_type not in ALLOWED_IMAGE_TYPES or len(body) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=415, detail="Profile photo format is not supported")
    return Response(
        content=body,
        media_type=content_type,
        headers={"Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff"},
    )


def promote_media_file(cursor, media_file_id: int | None) -> str | None:
    if not media_file_id:
        return None
    cursor.execute(
        "SELECT id, storage_key, public_url FROM media_files WHERE id = %s LIMIT 1",
        (media_file_id,),
    )
    media = cursor.fetchone()
    if not media:
        raise HTTPException(status_code=409, detail="Photo media record is unavailable")
    storage_key = str(media.get("storage_key") or "").strip().lstrip("/")
    public_url = str(media.get("public_url") or "").strip()
    if not storage_key.startswith("quarantine/"):
        return public_url or None
    relative_key = storage_key[len("quarantine/"):]
    source = safe_storage_path(PRIVATE_UPLOAD_DIR, relative_key)
    if not source.is_file():
        raise HTTPException(status_code=409, detail="Quarantined photo is unavailable")
    destination = safe_storage_path(UPLOAD_DIR, relative_key)
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    source.unlink(missing_ok=True)
    public_url = f"{UPLOAD_URL_PREFIX.rstrip('/')}/{relative_key.replace(os.sep, '/')}"
    cursor.execute(
        "UPDATE media_files SET storage_key = %s, public_url = %s WHERE id = %s",
        (relative_key.replace(os.sep, "/"), public_url, media_file_id),
    )
    return public_url


def update_photo_moderation_entity(cursor, photo_id: int, status_value: str, data_updates: dict[str, Any]):
    source_key = f"profile-photo-{photo_id}"
    cursor.execute(
        "SELECT id, data FROM app_entities WHERE entity_type = 'moderation_photo' AND source_key = %s LIMIT 1",
        (source_key,),
    )
    entity = cursor.fetchone()
    data = as_dict(entity.get("data") if entity else {})
    data.update(data_updates)
    if entity:
        cursor.execute(
            "UPDATE app_entities SET status = %s, data = %s, updated_at = UTC_TIMESTAMP() WHERE id = %s",
            (status_value, json.dumps(data, ensure_ascii=False), entity["id"]),
        )
    else:
        cursor.execute(
            """
            INSERT INTO app_entities (entity_type, source_key, title, status, data)
            VALUES ('moderation_photo', %s, %s, %s, %s)
            """,
            (source_key, f"Profile photo #{photo_id}", status_value, json.dumps(data, ensure_ascii=False)),
        )


def reset_verification_after_primary_photo_change(cursor, profile_id: int) -> bool:
    cursor.execute(
        """
        SELECT id, status, data
        FROM app_entities
        WHERE entity_type = 'verification'
          AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.profileId')) = %s
          AND status IN ('APPROVED', 'PENDING', 'IN_REVIEW')
        FOR UPDATE
        """,
        (str(profile_id),),
    )
    sessions = cursor.fetchall()
    if not sessions:
        return False
    reset_at = now_utc().isoformat()
    for session in sessions:
        data = as_dict(session.get("data"))
        data.pop("verificationUrl", None)
        data["resetReason"] = "PROFILE_PHOTO_CHANGED"
        data["resetAt"] = reset_at
        cursor.execute(
            "UPDATE app_entities SET status = 'EXPIRED', data = %s, updated_at = UTC_TIMESTAMP() WHERE id = %s",
            (json.dumps(data, ensure_ascii=False), session["id"]),
        )
    cursor.execute(
        "INSERT INTO api_events (event_type, payload) VALUES ('member.verification_reset_photo_changed', %s)",
        (json.dumps({"profileId": profile_id, "resetAt": reset_at}, ensure_ascii=False),),
    )
    send_support_status_message(
        cursor,
        profile_id,
        "Your profile verification was reset because your main photo changed. You can start verification again with the new photo.",
    )
    return True


def apply_profile_photo_moderation(photo_id: int, result: dict[str, Any], actor: str = "google_vision") -> dict[str, Any]:
    result = automatic_photo_decision(result)
    decision = str(result.get("decision") or "REJECTED").upper()
    if decision not in {"APPROVED", "REJECTED"}:
        decision = "REJECTED"
    reason = str(result.get("reason") or decision)[:512]
    with db_cursor() as (conn, cursor):
        cursor.execute(
            """
            SELECT id, profile_id, media_file_id, avatar_media_file_id, position, status,
                   public_url, moderation_status
            FROM profile_photos
            WHERE id = %s
            LIMIT 1
            FOR UPDATE
            """,
            (photo_id,),
        )
        photo = cursor.fetchone()
        if not photo:
            raise HTTPException(status_code=404, detail="Photo not found")
        profile_id = int(photo["profile_id"])
        position = int(photo.get("position") or 0)
        public_url = str(photo.get("public_url") or "")
        avatar_url = None
        lifecycle_status = "PENDING"
        upload_status = "QUARANTINED"
        if decision == "APPROVED":
            public_url = promote_media_file(cursor, int_or_none(photo.get("media_file_id"))) or ""
            cursor.execute(
                """
                UPDATE profile_photos
                SET status = 'REPLACED', updated_at = UTC_TIMESTAMP()
                WHERE profile_id = %s AND position = %s AND status = 'ACTIVE' AND id <> %s
                """,
                (profile_id, position, photo_id),
            )
            lifecycle_status = "ACTIVE"
            upload_status = "COMMITTED"
            if position == 0:
                # The gallery photo and its avatar crop are separate assets. The
                # original is committed first; a supplied crop is promoted only
                # after its own moderation succeeds.
                avatar_url = public_url if not photo.get("avatar_media_file_id") else None
                update_profile_data(
                    cursor,
                    profile_id,
                    {
                        "avatarUrl": avatar_url,
                        "isWizardCompleted": True,
                        "isVerified": False,
                        "verifiedAt": None,
                        "verificationProvider": None,
                    },
                )
                reset_verification_after_primary_photo_change(cursor, profile_id)
        elif decision == "REJECTED":
            lifecycle_status = "REJECTED"
        cursor.execute(
            """
            UPDATE profile_photos
            SET public_url = %s,
                status = %s,
                upload_status = %s,
                moderation_status = %s,
                moderation_reason = %s,
                moderation_data = %s,
                moderated_at = UTC_TIMESTAMP(),
                updated_at = UTC_TIMESTAMP()
            WHERE id = %s
            """,
            (
                public_url,
                lifecycle_status,
                upload_status,
                decision,
                reason,
                json.dumps(result, ensure_ascii=False),
                photo_id,
            ),
        )
        update_photo_moderation_entity(
            cursor,
            photo_id,
            decision,
            {
                "profileId": profile_id,
                "photoId": photo_id,
                "position": position,
                "decision": decision,
                "reason": reason,
                "moderation": result,
                "publicUrl": public_url if decision == "APPROVED" else None,
                "moderatedBy": actor,
                "moderatedAt": now_utc().isoformat(),
            },
        )
        cursor.execute(
            "INSERT INTO api_events (event_type, payload) VALUES ('member.photo_moderated', %s)",
            (json.dumps({"profileId": profile_id, "photoId": photo_id, "decision": decision, "actor": actor}, ensure_ascii=False),),
        )
        conn.commit()
    return {
        "id": photo_id,
        "publicUrl": public_url if decision == "APPROVED" else f"/api/member/photos/{photo_id}/content",
        "position": position,
        "status": lifecycle_status,
        "uploadStatus": upload_status,
        "moderationStatus": decision,
        "moderationReason": reason,
        "avatarUrl": avatar_url,
    }


def apply_avatar_crop_moderation(
    media_file_id: int,
    profile_id: int,
    primary_photo_id: int,
    result: dict[str, Any],
    actor: str = "google_vision",
) -> dict[str, Any]:
    result = automatic_photo_decision(result)
    decision = str(result.get("decision") or "REJECTED").upper()
    if decision not in {"APPROVED", "REJECTED"}:
        decision = "REJECTED"
    reason = str(result.get("reason") or decision)[:512]
    public_url = None
    with db_cursor() as (conn, cursor):
        if decision == "APPROVED":
            public_url = promote_media_file(cursor, media_file_id)
            if not public_url:
                raise HTTPException(status_code=409, detail="Avatar media is unavailable")
            cursor.execute(
                """
                UPDATE profile_photos
                SET avatar_media_file_id = %s, updated_at = UTC_TIMESTAMP()
                WHERE id = %s AND profile_id = %s AND status = 'ACTIVE' AND moderation_status = 'APPROVED'
                """,
                (media_file_id, primary_photo_id, profile_id),
            )
            if cursor.rowcount == 0:
                raise HTTPException(status_code=409, detail="Approved primary photo is unavailable")
            update_profile_data(cursor, profile_id, {"avatarUrl": public_url, "isWizardCompleted": True})
        else:
            # Initial uploads may already point at the proposed crop. Do not let
            # a rejected crop replace the original photo or appear as an avatar.
            cursor.execute(
                """
                UPDATE profile_photos
                SET avatar_media_file_id = NULL, updated_at = UTC_TIMESTAMP()
                WHERE id = %s AND profile_id = %s AND avatar_media_file_id = %s
                """,
                (primary_photo_id, profile_id, media_file_id),
            )
        source_key = f"avatar-crop-{media_file_id}"
        cursor.execute(
            "SELECT id, data FROM app_entities WHERE entity_type = 'moderation_photo' AND source_key = %s LIMIT 1",
            (source_key,),
        )
        entity = cursor.fetchone()
        data = as_dict(entity.get("data") if entity else {})
        data.update(
            {
                "kind": "avatar_crop",
                "profileId": profile_id,
                "profilePhotoId": primary_photo_id,
                "mediaFileId": media_file_id,
                "decision": decision,
                "reason": reason,
                "moderation": result,
                "publicUrl": public_url,
                "moderatedBy": actor,
                "moderatedAt": now_utc().isoformat(),
            }
        )
        if entity:
            cursor.execute(
                "UPDATE app_entities SET status = %s, data = %s, updated_at = UTC_TIMESTAMP() WHERE id = %s",
                (decision, json.dumps(data, ensure_ascii=False), entity["id"]),
            )
        else:
            cursor.execute(
                """
                INSERT INTO app_entities (entity_type, source_key, title, status, data)
                VALUES ('moderation_photo', %s, %s, %s, %s)
                """,
                (source_key, f"Avatar crop #{media_file_id}", decision, json.dumps(data, ensure_ascii=False)),
            )
        cursor.execute(
            "INSERT INTO api_events (event_type, payload) VALUES ('member.avatar_moderated', %s)",
            (json.dumps({"profileId": profile_id, "mediaFileId": media_file_id, "decision": decision, "actor": actor}, ensure_ascii=False),),
        )
        conn.commit()
    return {"status": decision, "reason": reason, "avatarUrl": public_url}


def quarantine_photo_bytes(storage_key: Any) -> bytes | None:
    key = str(storage_key or "").strip()
    if not key:
        return None
    relative = key.removeprefix("quarantine/").lstrip("/")
    candidate = (PRIVATE_UPLOAD_DIR / relative).resolve()
    try:
        candidate.relative_to(PRIVATE_UPLOAD_DIR.resolve())
    except ValueError:
        return None
    try:
        return candidate.read_bytes()
    except OSError:
        return None


def automatically_recheck_legacy_profile_photos() -> None:
    """Finish legacy pending records after manual photo moderation is disabled."""
    with db_cursor() as (_, cursor):
        cursor.execute(
            """
            SELECT pp.id, pp.profile_id, pp.position, pp.avatar_media_file_id,
                   mf.storage_key AS storage_key, amf.storage_key AS avatar_storage_key
            FROM profile_photos pp
            JOIN media_files mf ON mf.id = pp.media_file_id
            LEFT JOIN media_files amf ON amf.id = pp.avatar_media_file_id
            WHERE pp.status = 'PENDING' OR pp.moderation_status = 'MANUAL_REVIEW'
            ORDER BY pp.id ASC
            LIMIT %s
            """,
            (AUTOMATIC_PHOTO_RECHECK_LIMIT,),
        )
        items = cursor.fetchall()

    for item in items:
        photo_id = int(item["id"])
        body = quarantine_photo_bytes(item.get("storage_key"))
        if not body:
            result = {
                "decision": "REJECTED",
                "reason": "AUTOMATIC_REJECTED_SOURCE_UNAVAILABLE",
                "providerConfigured": vision_is_configured(),
            }
        else:
            result = moderate_profile_image(body, require_face=False)
        try:
            photo = apply_profile_photo_moderation(photo_id, result, actor="automatic_recheck")
            avatar_media_file_id = int_or_none(item.get("avatar_media_file_id"))
            if photo.get("moderationStatus") == "APPROVED" and avatar_media_file_id:
                avatar_body = quarantine_photo_bytes(item.get("avatar_storage_key"))
                avatar_result = (
                    moderate_profile_image(avatar_body, require_face=False)
                    if avatar_body
                    else {
                        "decision": "REJECTED",
                        "reason": "AUTOMATIC_REJECTED_AVATAR_SOURCE_UNAVAILABLE",
                        "providerConfigured": vision_is_configured(),
                    }
                )
                apply_avatar_crop_moderation(
                    avatar_media_file_id,
                    int(item["profile_id"]),
                    photo_id,
                    avatar_result,
                    actor="automatic_recheck",
                )
        except Exception:
            logger.exception("Automatic photo recheck failed for photo %s", photo_id)


@app.on_event("startup")
def start_automatic_photo_recheck() -> None:
    Thread(target=automatically_recheck_legacy_profile_photos, name="automatic-photo-recheck", daemon=True).start()


@app.get("/api/member/photos/{photo_id}/content")
def member_photo_content(photo_id: int, user: dict[str, Any] = Depends(require_user)):
    profile_id = require_profile_id(user)
    with db_cursor() as (_, cursor):
        cursor.execute(
            """
            SELECT pp.public_url AS publicUrl, mf.storage_key AS storageKey, mf.mime_type AS mimeType
            FROM profile_photos pp
            JOIN media_files mf ON mf.id = pp.media_file_id
            WHERE pp.id = %s AND pp.profile_id = %s AND pp.status IN ('ACTIVE', 'PENDING', 'REJECTED')
            LIMIT 1
            """,
            (photo_id, profile_id),
        )
        photo = cursor.fetchone()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    return profile_photo_content_response(photo)


@app.get("/api/member/photos/{photo_id}/avatar-content")
def member_photo_avatar_content(photo_id: int, user: dict[str, Any] = Depends(require_user)):
    profile_id = require_profile_id(user)
    with db_cursor() as (_, cursor):
        cursor.execute(
            """
            SELECT amf.public_url AS publicUrl, amf.storage_key AS storageKey, amf.mime_type AS mimeType
            FROM profile_photos pp
            JOIN media_files amf ON amf.id = pp.avatar_media_file_id
            WHERE pp.id = %s AND pp.profile_id = %s AND pp.status IN ('ACTIVE', 'PENDING', 'REJECTED')
            LIMIT 1
            """,
            (photo_id, profile_id),
        )
        avatar = cursor.fetchone()
    if not avatar:
        raise HTTPException(status_code=404, detail="Avatar source is unavailable")

    return profile_photo_content_response(avatar)


@app.post("/api/member/photos")
async def member_upload_photo(
    position: int = Form(0, ge=0, le=MAX_PROFILE_PHOTOS - 1),
    file: UploadFile = File(...),
    avatar: UploadFile | None = File(None),
    user: dict[str, Any] = Depends(require_user),
):
    profile_id = require_profile_id(user)
    if avatar is not None and position != 0:
        raise HTTPException(status_code=422, detail="Avatar crop is only valid for the main photo")
    content_type, ext, body, image_metadata = await read_profile_image(file)
    avatar_content_type = avatar_ext = avatar_body = avatar_metadata = None
    if avatar is not None:
        avatar_content_type, avatar_ext, avatar_body, avatar_metadata = await read_profile_image(avatar)
    with db_cursor() as (_, cursor):
        cursor.execute(
            """
            SELECT COUNT(DISTINCT position) AS total, SUM(position = %s) AS atPosition
            FROM profile_photos
            WHERE profile_id = %s AND status IN ('ACTIVE', 'PENDING')
            """,
            (position, profile_id),
        )
        quota = cursor.fetchone() or {}
    if int(quota.get("total") or 0) >= MAX_PROFILE_PHOTOS and not int(quota.get("atPosition") or 0):
        raise HTTPException(status_code=409, detail=f"A profile can contain at most {MAX_PROFILE_PHOTOS} photos")

    storage_dir = PRIVATE_UPLOAD_DIR / "profiles" / str(profile_id)
    storage_dir.mkdir(parents=True, exist_ok=True)
    storage_name = f"{int(now_utc().timestamp())}-{secrets.token_hex(8)}{ext}"
    storage_path = storage_dir / storage_name
    storage_path.write_bytes(body)
    storage_key = f"profiles/{profile_id}/{storage_name}"
    metadata = {
        "originalName": file.filename,
        "position": position,
        "profileId": profile_id,
        "quarantined": True,
        **image_metadata,
    }
    avatar_storage_key = None
    if avatar_body is not None and avatar_ext is not None:
        avatar_storage_name = f"avatar-{int(now_utc().timestamp())}-{secrets.token_hex(8)}{avatar_ext}"
        (storage_dir / avatar_storage_name).write_bytes(avatar_body)
        avatar_storage_key = f"profiles/{profile_id}/{avatar_storage_name}"
    with db_cursor() as (conn, cursor):
        cursor.execute(
            """
            INSERT INTO media_files (storage_key, public_url, mime_type, bytes, metadata)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (f"quarantine/{storage_key}", None, content_type, len(body), json.dumps(metadata, ensure_ascii=False)),
        )
        media_id = cursor.lastrowid
        avatar_media_id = None
        if avatar_storage_key and avatar_body is not None and avatar_metadata is not None:
            cursor.execute(
                """
                INSERT INTO media_files (storage_key, public_url, mime_type, bytes, metadata)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    f"quarantine/{avatar_storage_key}",
                    None,
                    avatar_content_type,
                    len(avatar_body),
                    json.dumps(
                        {
                            "originalName": avatar.filename,
                            "kind": "avatar-crop",
                            "profileId": profile_id,
                            "quarantined": True,
                            **avatar_metadata,
                        },
                        ensure_ascii=False,
                    ),
                ),
            )
            avatar_media_id = cursor.lastrowid
        cursor.execute(
            """
            UPDATE profile_photos
            SET status = 'REPLACED', updated_at = UTC_TIMESTAMP()
            WHERE profile_id = %s AND position = %s AND status IN ('PENDING', 'REJECTED')
            """,
            (profile_id, position),
        )
        cursor.execute(
            """
            INSERT INTO profile_photos (
              profile_id, media_file_id, public_url, position, status,
              upload_status, moderation_status, moderation_reason, moderation_data,
              quarantine_key, avatar_media_file_id, created_at, updated_at
            )
            VALUES (%s, %s, '', %s, 'PENDING', 'QUARANTINED', 'PENDING', NULL, NULL, %s, %s,
                    UTC_TIMESTAMP(), UTC_TIMESTAMP())
            """,
            (profile_id, media_id, position, storage_key, avatar_media_id),
        )
        photo_id = cursor.lastrowid
        cursor.execute(
            """
            INSERT INTO app_entities (entity_type, source_key, title, status, data)
            VALUES ('moderation_photo', %s, %s, 'PENDING', %s)
            ON DUPLICATE KEY UPDATE status = 'PENDING', data = VALUES(data), updated_at = UTC_TIMESTAMP()
            """,
            (
                f"profile-photo-{photo_id}",
                f"Profile photo #{photo_id}",
                json.dumps(
                    {
                        "profileId": profile_id,
                        "photoId": photo_id,
                        "position": position,
                        "contentUrl": f"/api/admin/profile-photos/{photo_id}/content",
                        "avatarMediaFileId": avatar_media_id,
                        "avatarContentUrl": (
                            f"/api/admin/media/{avatar_media_id}/content" if avatar_media_id else None
                        ),
                        "uploadStatus": "QUARANTINED",
                        "moderationStatus": "PENDING",
                    },
                    ensure_ascii=False,
                ),
            ),
        )
        conn.commit()
    profile_moderation = moderate_profile_image(body, require_face=False)
    photo = apply_profile_photo_moderation(photo_id, profile_moderation)
    avatar_outcome = None
    avatar_moderation = None
    if photo.get("moderationStatus") == "APPROVED" and avatar_body is not None and avatar_media_id:
        avatar_moderation = moderate_profile_image(avatar_body, require_face=False)
        avatar_outcome = apply_avatar_crop_moderation(
            int(avatar_media_id),
            profile_id,
            int(photo_id),
            avatar_moderation,
        )
        photo["avatarUrl"] = avatar_outcome.get("avatarUrl")
    return {
        "ok": True,
        "photo": photo,
        "avatarUrl": photo.get("avatarUrl"),
        "moderation": {
            "status": photo.get("moderationStatus"),
            "reason": photo.get("moderationReason"),
            "providerConfigured": profile_moderation.get("providerConfigured"),
        },
        "avatarModeration": ({
            "status": avatar_outcome.get("status"),
            "reason": avatar_outcome.get("reason"),
            "providerConfigured": avatar_moderation.get("providerConfigured"),
        } if avatar_outcome and avatar_moderation else None),
    }


@app.post("/api/member/avatar")
async def member_upload_avatar(
    file: UploadFile = File(...),
    user: dict[str, Any] = Depends(require_user),
):
    profile_id = require_profile_id(user)
    with db_cursor() as (_, cursor):
        cursor.execute(
            """
            SELECT id
            FROM profile_photos
            WHERE profile_id = %s AND position = 0 AND status = 'ACTIVE' AND moderation_status = 'APPROVED'
            ORDER BY id DESC
            LIMIT 1
            """,
            (profile_id,),
        )
        primary_photo = cursor.fetchone()
    if not primary_photo:
        raise HTTPException(status_code=409, detail="Upload and approve a primary profile photo first")
    content_type, ext, body, image_metadata = await read_profile_image(file)
    storage_dir = PRIVATE_UPLOAD_DIR / "profiles" / str(profile_id)
    storage_dir.mkdir(parents=True, exist_ok=True)
    storage_name = f"avatar-{int(now_utc().timestamp())}-{secrets.token_hex(8)}{ext}"
    storage_path = storage_dir / storage_name
    storage_path.write_bytes(body)
    storage_key = f"profiles/{profile_id}/{storage_name}"
    metadata = {
        "originalName": file.filename,
        "kind": "avatar-crop",
        "profileId": profile_id,
        "primaryPhotoId": primary_photo["id"],
        "quarantined": True,
        **image_metadata,
    }
    with db_cursor() as (conn, cursor):
        cursor.execute(
            """
            INSERT INTO media_files (storage_key, public_url, mime_type, bytes, metadata)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (f"quarantine/{storage_key}", None, content_type, len(body), json.dumps(metadata, ensure_ascii=False)),
        )
        media_file_id = cursor.lastrowid
        cursor.execute(
            """
            INSERT INTO app_entities (entity_type, source_key, title, status, data)
            VALUES ('moderation_photo', %s, %s, 'PENDING', %s)
            """,
            (
                f"avatar-crop-{media_file_id}",
                f"Avatar crop #{media_file_id}",
                json.dumps(
                    {
                        "kind": "avatar_crop",
                        "profileId": profile_id,
                        "profilePhotoId": primary_photo["id"],
                        "mediaFileId": media_file_id,
                        "contentUrl": f"/api/admin/media/{media_file_id}/content",
                        "moderationStatus": "PENDING",
                    },
                    ensure_ascii=False,
                ),
            ),
        )
        conn.commit()
    moderation = moderate_profile_image(body, require_face=False)
    outcome = apply_avatar_crop_moderation(
        media_file_id,
        profile_id,
        int(primary_photo["id"]),
        moderation,
    )
    if outcome["status"] == "REJECTED":
        raise HTTPException(status_code=422, detail="Avatar photo was rejected by moderation")
    return {
        "ok": True,
        "avatarUrl": outcome.get("avatarUrl"),
        "moderation": {
            "status": outcome["status"],
            "reason": outcome["reason"],
            "providerConfigured": moderation.get("providerConfigured"),
        },
    }


@app.delete("/api/member/photos/{photo_id}")
def member_delete_photo(photo_id: int, user: dict[str, Any] = Depends(require_user)):
    profile_id = require_profile_id(user)
    with db_cursor() as (conn, cursor):
        cursor.execute(
            "SELECT position, status FROM profile_photos WHERE id = %s AND profile_id = %s AND status IN ('ACTIVE', 'PENDING', 'REJECTED') LIMIT 1",
            (photo_id, profile_id),
        )
        photo = cursor.fetchone()
        if not photo:
            raise HTTPException(status_code=404, detail="Photo not found")
        deleted_position = int(photo.get("position") or 0)
        cursor.execute(
            """
            UPDATE profile_photos
            SET status = 'DELETED', updated_at = UTC_TIMESTAMP()
            WHERE id = %s AND profile_id = %s AND status IN ('ACTIVE', 'PENDING', 'REJECTED')
            """,
            (photo_id, profile_id),
        )
        if deleted_position == 0 and str(photo.get("status") or "") == "ACTIVE":
            cursor.execute(
                """
                SELECT pp.id,
                       COALESCE(NULLIF(avatar_media.public_url, ''), pp.public_url) AS avatar_url
                FROM profile_photos pp
                LEFT JOIN media_files avatar_media ON avatar_media.id = pp.avatar_media_file_id
                WHERE pp.profile_id = %s AND pp.status = 'ACTIVE' AND pp.moderation_status = 'APPROVED'
                ORDER BY pp.position ASC, pp.id ASC
                LIMIT 1
                """,
                (profile_id,),
            )
            replacement = cursor.fetchone()
            if replacement:
                cursor.execute("UPDATE profile_photos SET position = 0, updated_at = UTC_TIMESTAMP() WHERE id = %s", (replacement["id"],))
                avatar_url = replacement["avatar_url"]
            else:
                avatar_url = None
            update_profile_data(
                cursor,
                profile_id,
                {
                    "avatarUrl": avatar_url,
                    "isWizardCompleted": bool(avatar_url),
                    "isVerified": False,
                    "verifiedAt": None,
                    "verificationProvider": None,
                },
            )
            reset_verification_after_primary_photo_change(cursor, profile_id)
        conn.commit()
    return {"ok": True}


@app.post("/api/member/likes/{profile_identifier}")
def member_like_profile(
    profile_identifier: str,
    background_tasks: BackgroundTasks,
    user: dict[str, Any] = Depends(require_user),
):
    actor_profile_id = require_profile_id(user)
    with db_cursor() as (conn, cursor):
        actor_profile = fetch_profile(cursor, actor_profile_id)
        if not profile_is_verified(actor_profile):
            raise HTTPException(status_code=403, detail="Verify your profile before sending likes")
        target_profile_id = resolve_profile_id(cursor, profile_identifier)
        if target_profile_id == actor_profile_id:
            raise HTTPException(status_code=422, detail="You cannot like your own profile")
        target_profile = fetch_profile(cursor, target_profile_id)
        if not profile_is_visible_in_catalog(target_profile):
            raise HTTPException(status_code=404, detail="Profile not found")
        if has_active_block(cursor, actor_profile_id, target_profile_id):
            raise HTTPException(status_code=403, detail="This profile is not available")
        cursor.execute(
            """
            SELECT id, status
            FROM profile_likes
            WHERE actor_profile_id = %s AND target_profile_id = %s
            LIMIT 1
            """,
            (actor_profile_id, target_profile_id),
        )
        existing_like = cursor.fetchone()
        is_new_like = not existing_like or existing_like.get("status") != "ACTIVE"
        if is_new_like:
            daily_limit = PREMIUM_DAILY_LIKE_LIMIT if profile_is_premium(actor_profile) else FREE_DAILY_LIKE_LIMIT
            used_today = daily_like_count(cursor, actor_profile_id)
            if used_today >= daily_limit:
                raise HTTPException(
                    status_code=429,
                    detail=f"Daily like limit reached ({daily_limit}). Continue tomorrow.",
                )
        cursor.execute(
            """
            INSERT INTO profile_likes (actor_profile_id, target_profile_id, status, created_at, updated_at)
            VALUES (%s, %s, 'ACTIVE', UTC_TIMESTAMP(), UTC_TIMESTAMP())
            ON DUPLICATE KEY UPDATE
              created_at = IF(status = 'ACTIVE', created_at, UTC_TIMESTAMP()),
              status = 'ACTIVE',
              updated_at = UTC_TIMESTAMP()
            """,
            (actor_profile_id, target_profile_id),
        )
        cursor.execute(
            """
            SELECT id
            FROM profile_likes
            WHERE actor_profile_id = %s AND target_profile_id = %s AND status = 'ACTIVE'
            LIMIT 1
            """,
            (target_profile_id, actor_profile_id),
        )
        reverse = cursor.fetchone()
        match_id = None
        conversation_id = None
        if reverse:
            match_id = ensure_match(cursor, actor_profile_id, target_profile_id)
            conversation_id = ensure_conversation(cursor, actor_profile_id, target_profile_id, match_id)
        conn.commit()
    actor_name = str(actor_profile.get("display_name") or user.get("display_name") or "").strip()
    target_name = str(target_profile.get("display_name") or "").strip()
    if is_new_like:
        background_tasks.add_task(send_profile_notification, target_profile_id, "NEW_LIKE", actor_name)
    if is_new_like and reverse:
        background_tasks.add_task(send_profile_notification, target_profile_id, "NEW_MATCH", actor_name)
        background_tasks.add_task(send_profile_notification, actor_profile_id, "NEW_MATCH", target_name)
    return {
        "ok": True,
        "liked": True,
        "created": is_new_like,
        "matched": bool(reverse),
        "matchId": match_id,
        "conversationId": conversation_id,
    }


@app.delete("/api/member/likes/{profile_identifier}")
def member_unlike_profile(profile_identifier: str, user: dict[str, Any] = Depends(require_user)):
    raise HTTPException(status_code=405, detail="Likes are irreversible. Block the profile to remove mutual interaction.")


@app.get("/api/member/likes")
def member_likes(user: dict[str, Any] = Depends(require_user)):
    profile_id = require_profile_id(user)
    with db_cursor() as (_, cursor):
        current_profile = fetch_profile(cursor, profile_id)
        is_premium = profile_is_premium(current_profile)
        block_filter = """
            AND NOT EXISTS (
              SELECT 1
              FROM profile_blocks b
              WHERE b.status = 'ACTIVE'
                AND (
                  (b.blocker_profile_id = %s AND b.blocked_profile_id = p.id)
                  OR (b.blocker_profile_id = p.id AND b.blocked_profile_id = %s)
                )
            )
        """
        cursor.execute(
            f"""
            SELECT COUNT(*) AS cnt, COALESCE(MAX(l.id), 0) AS "readThroughId"
            FROM profile_likes l
            JOIN profiles p ON p.id = l.actor_profile_id
            WHERE l.target_profile_id = %s AND l.status = 'ACTIVE'
              AND p.status = 'ACTIVE'
              {block_filter}
            """,
            (profile_id, profile_id, profile_id),
        )
        likes_snapshot = cursor.fetchone()
        likes_you_count = int(likes_snapshot["cnt"])
        read_through_id = int(likes_snapshot["readThroughId"] or 0)
        likes_you = []
        if is_premium:
            cursor.execute(
                f"""
                SELECT l.id, l.created_at AS "likedAt",
                       p.id AS "profileId", p.display_name AS "displayName", p.role, p.status,
                       p.data ->> 'country' AS country,
                       p.data ->> 'city' AS city,
                       p.data ->> 'avatarUrl' AS "avatarUrl",
                       p.data
                FROM profile_likes l
                JOIN profiles p ON p.id = l.actor_profile_id
                WHERE l.target_profile_id = %s AND l.status = 'ACTIVE'
                  AND p.status = 'ACTIVE'
                  {block_filter}
                ORDER BY l.created_at DESC
                LIMIT 100
                """,
                (profile_id, profile_id, profile_id),
            )
            likes_you = [public_profile_summary({**row, "id": row["profileId"]}) for row in cursor.fetchall()]
        cursor.execute(
            f"""
            SELECT l.id, l.created_at AS "likedAt",
                   p.id AS "profileId", p.display_name AS "displayName", p.role, p.status,
                   p.data ->> 'country' AS country,
                   p.data ->> 'city' AS city,
                   p.data ->> 'avatarUrl' AS "avatarUrl",
                   p.data
            FROM profile_likes l
            JOIN profiles p ON p.id = l.target_profile_id
            WHERE l.actor_profile_id = %s AND l.status = 'ACTIVE'
              AND p.status = 'ACTIVE'
              {block_filter}
            ORDER BY l.created_at DESC
            LIMIT 100
            """,
            (profile_id, profile_id, profile_id),
        )
        my_likes = [
            public_profile_summary({
                **row,
                "id": row["profileId"],
                "likedByViewer": True,
                "likeReadOnly": True,
            })
            for row in cursor.fetchall()
        ]
        cursor.execute(
            f"""
            SELECT m.id AS "matchId", m.created_at AS "matchedAt",
                   p.id AS "profileId", p.display_name AS "displayName", p.role, p.status,
                   p.data ->> 'country' AS country,
                   p.data ->> 'city' AS city,
                   p.data ->> 'avatarUrl' AS "avatarUrl",
                   p.data
            FROM profile_matches m
            JOIN profiles p ON p.id = CASE WHEN m.profile_a_id = %s THEN m.profile_b_id ELSE m.profile_a_id END
            WHERE (m.profile_a_id = %s OR m.profile_b_id = %s) AND m.status = 'ACTIVE'
              AND EXISTS (
                SELECT 1
                FROM profile_likes viewer_like
                WHERE viewer_like.actor_profile_id = %s
                  AND viewer_like.target_profile_id = CASE WHEN m.profile_a_id = %s THEN m.profile_b_id ELSE m.profile_a_id END
                  AND viewer_like.status = 'ACTIVE'
              )
              AND EXISTS (
                SELECT 1
                FROM profile_likes peer_like
                WHERE peer_like.actor_profile_id = CASE WHEN m.profile_a_id = %s THEN m.profile_b_id ELSE m.profile_a_id END
                  AND peer_like.target_profile_id = %s
                  AND peer_like.status = 'ACTIVE'
              )
              AND p.status = 'ACTIVE'
              {block_filter}
            ORDER BY m.created_at DESC
            LIMIT 100
            """,
            (profile_id, profile_id, profile_id, profile_id, profile_id, profile_id, profile_id, profile_id, profile_id),
        )
        matches = [
            public_profile_summary({
                **row,
                "id": row["profileId"],
                "likedByViewer": True,
                "likeReadOnly": True,
            })
            for row in cursor.fetchall()
        ]
    return {
        "likesYou": likes_you,
        "likesYouCount": likes_you_count,
        "likesYouLocked": not is_premium,
        "myLikes": my_likes,
        "matches": matches,
        "readThroughId": read_through_id,
    }


@app.post("/api/member/notifications/likes/read")
def member_mark_likes_read(payload: LikesReadPayload, user: dict[str, Any] = Depends(require_user)):
    profile_id = require_profile_id(user)
    with db_cursor() as (conn, cursor):
        cursor.execute(
            """
            SELECT COALESCE(MAX(id), 0) AS max_like_id
            FROM profile_likes
            WHERE target_profile_id = %s
            """,
            (profile_id,),
        )
        max_like_id = int(cursor.fetchone()["max_like_id"] or 0)
        read_through_id = min(max_like_id, max(0, int(payload.readThroughId or 0)))
        update_profile_data(cursor, profile_id, {"lastLikesViewedId": read_through_id})
        unread_likes = member_unread_like_count(cursor, profile_id, read_through_id)
        conn.commit()
    return {"ok": True, "readThroughId": read_through_id, "counts": {"likesYou": unread_likes}}


@app.get("/api/member/profile-views")
def member_profile_views(user: dict[str, Any] = Depends(require_user)):
    profile_id = require_profile_id(user)
    viewer_expr = """
        COALESCE(
          CAST(NULLIF(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(e.data, '$.viewerProfileId')), ''), 'null') AS UNSIGNED),
          CAST(NULLIF(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(e.data, '$.profileLocalId')), ''), 'null') AS UNSIGNED)
        )
    """
    viewed_expr = """
        COALESCE(
          CAST(NULLIF(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(e.data, '$.viewedProfileId')), ''), 'null') AS UNSIGNED),
          viewed_user.profile_id
        )
    """
    with db_cursor() as (_, cursor):
        current_profile = fetch_profile(cursor, profile_id)
        is_premium = profile_is_premium(current_profile)
        cursor.execute(
            f"""
            SELECT COUNT(*) AS cnt
            FROM app_entities e
            LEFT JOIN handover_source_map viewed_map
              ON viewed_map.source_table = 'User'
             AND viewed_map.source_id = JSON_UNQUOTE(JSON_EXTRACT(e.data, '$.viewedId'))
            LEFT JOIN local_users viewed_user ON viewed_user.id = viewed_map.local_id
            LEFT JOIN profiles p ON p.id = {viewer_expr}
            WHERE e.entity_type = 'profile_view'
              AND LOWER(COALESCE(e.status, 'active')) = 'active'
              AND {viewed_expr} = %s
              AND p.id IS NOT NULL
              AND p.status = 'ACTIVE'
              AND NOT EXISTS (
                SELECT 1 FROM profile_blocks b
                WHERE b.status = 'ACTIVE'
                  AND ((b.blocker_profile_id = %s AND b.blocked_profile_id = p.id)
                    OR (b.blocker_profile_id = p.id AND b.blocked_profile_id = %s))
              )
            """,
            (profile_id, profile_id, profile_id),
        )
        total = int(cursor.fetchone()["cnt"])
        items = []
        if is_premium:
            cursor.execute(
                f"""
                SELECT e.id AS viewId, e.created_at, e.updated_at,
                       JSON_EXTRACT(e.data, '$.viewCount') AS viewCount,
                       JSON_UNQUOTE(JSON_EXTRACT(e.data, '$.lastViewedAt')) AS lastViewedAt,
                       p.id AS profileId, p.display_name AS displayName, p.role, p.status,
                       JSON_UNQUOTE(JSON_EXTRACT(p.data, '$.country')) AS country,
                       JSON_UNQUOTE(JSON_EXTRACT(p.data, '$.city')) AS city,
                       JSON_UNQUOTE(JSON_EXTRACT(p.data, '$.avatarUrl')) AS avatarUrl,
                       p.data
                FROM app_entities e
                LEFT JOIN handover_source_map viewed_map
                  ON viewed_map.source_table = 'User'
                 AND viewed_map.source_id = JSON_UNQUOTE(JSON_EXTRACT(e.data, '$.viewedId'))
                LEFT JOIN local_users viewed_user ON viewed_user.id = viewed_map.local_id
                JOIN profiles p ON p.id = {viewer_expr}
                WHERE e.entity_type = 'profile_view'
                  AND LOWER(COALESCE(e.status, 'active')) = 'active'
                  AND {viewed_expr} = %s
                  AND p.status = 'ACTIVE'
                  AND NOT EXISTS (
                    SELECT 1 FROM profile_blocks b
                    WHERE b.status = 'ACTIVE'
                      AND ((b.blocker_profile_id = %s AND b.blocked_profile_id = p.id)
                        OR (b.blocker_profile_id = p.id AND b.blocked_profile_id = %s))
                  )
                ORDER BY COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.data, '$.lastViewedAt')), e.updated_at, e.created_at) DESC
                LIMIT 100
                """,
                (profile_id, profile_id, profile_id),
            )
            for row in cursor.fetchall():
                item = public_profile_summary({**row, "id": row["profileId"]})
                item["viewId"] = row["viewId"]
                item["viewCount"] = int_or_none(row.get("viewCount")) or 1
                item["lastViewedAt"] = row.get("lastViewedAt") or row.get("updated_at") or row.get("created_at")
                items.append(item)
    return {"items": items, "total": total, "locked": not is_premium}


@app.get("/api/member/favourites")
@app.get("/api/member/favorites")
def member_favourites(user: dict[str, Any] = Depends(require_user)):
    profile_id = require_profile_id(user)
    profile_filter = "CAST(NULLIF(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(e.data, '$.profileLocalId')), ''), 'null') AS UNSIGNED) = %s"
    clinic_expr = """
        COALESCE(
          CAST(NULLIF(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(e.data, '$.clinicLocalId')), ''), 'null') AS UNSIGNED),
          clinic_map.local_id
        )
    """
    lawyer_expr = """
        COALESCE(
          CAST(NULLIF(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(e.data, '$.lawyerLocalId')), ''), 'null') AS UNSIGNED),
          lawyer_map.local_id
        )
    """
    with db_cursor() as (_, cursor):
        cursor.execute(
            f"""
            SELECT e.id AS favouriteId, e.created_at AS favouritedAt,
                   c.id, c.name, c.country, c.city, c.status, c.data
            FROM app_entities e
            LEFT JOIN handover_source_map clinic_map
              ON clinic_map.source_table = 'Clinic'
             AND clinic_map.source_id = JSON_UNQUOTE(JSON_EXTRACT(e.data, '$.clinicId'))
            JOIN clinics c ON c.id = {clinic_expr}
            WHERE e.entity_type = 'favourite_clinic'
              AND LOWER(COALESCE(e.status, 'active')) = 'active'
              AND {profile_filter}
              AND c.status = 'active'
            ORDER BY e.updated_at DESC, e.id DESC
            LIMIT 200
            """,
            (profile_id,),
        )
        clinics = []
        for row in cursor.fetchall():
            item = normalize_row(row)
            item["data"] = public_safe_data(item.get("data"))
            clinics.append(item)
        cursor.execute(
            f"""
            SELECT e.id AS favouriteId, e.created_at AS favouritedAt,
                   l.id, l.name, l.country, l.city, l.status, l.data
            FROM app_entities e
            LEFT JOIN handover_source_map lawyer_map
              ON lawyer_map.source_table = 'Lawyer'
             AND lawyer_map.source_id = JSON_UNQUOTE(JSON_EXTRACT(e.data, '$.lawyerId'))
            JOIN lawyers l ON l.id = {lawyer_expr}
            WHERE e.entity_type = 'favourite_lawyer'
              AND LOWER(COALESCE(e.status, 'active')) = 'active'
              AND {profile_filter}
              AND l.status = 'active'
            ORDER BY e.updated_at DESC, e.id DESC
            LIMIT 200
            """,
            (profile_id,),
        )
        lawyers = []
        for row in cursor.fetchall():
            item = normalize_row(row)
            item["data"] = public_safe_data(item.get("data"))
            lawyers.append(item)
    return {"clinics": clinics, "lawyers": lawyers, "total": len(clinics) + len(lawyers)}


@app.post("/api/member/favourites/clinics/{clinic_identifier}")
@app.post("/api/member/favorites/clinics/{clinic_identifier}")
def member_favourite_clinic(clinic_identifier: str, user: dict[str, Any] = Depends(require_user)):
    profile_id = require_profile_id(user)
    with db_cursor() as (conn, cursor):
        clinic = fetch_clinic(cursor, clinic_identifier)
        data = as_dict(clinic.get("data"))
        payload = {
            "profileLocalId": profile_id,
            "clinicLocalId": int(clinic["id"]),
            "clinicId": data.get("id"),
        }
        cursor.execute(
            """
            INSERT INTO app_entities (entity_type, source_key, title, status, data, created_at, updated_at)
            VALUES ('favourite_clinic', %s, %s, 'active', %s, UTC_TIMESTAMP(), UTC_TIMESTAMP())
            ON DUPLICATE KEY UPDATE status = 'active', data = VALUES(data), updated_at = UTC_TIMESTAMP()
            """,
            (f"local-{profile_id}-clinic-{clinic['id']}", clinic["name"], json.dumps(payload, ensure_ascii=False)),
        )
        conn.commit()
    return {"ok": True, "favourited": True, "clinicId": int(clinic["id"])}


@app.delete("/api/member/favourites/clinics/{clinic_identifier}")
@app.delete("/api/member/favorites/clinics/{clinic_identifier}")
def member_unfavourite_clinic(clinic_identifier: str, user: dict[str, Any] = Depends(require_user)):
    profile_id = require_profile_id(user)
    with db_cursor() as (conn, cursor):
        clinic = fetch_clinic(cursor, clinic_identifier)
        cursor.execute(
            """
            UPDATE app_entities
            SET status = 'archived', updated_at = UTC_TIMESTAMP()
            WHERE entity_type = 'favourite_clinic' AND source_key = %s
            """,
            (f"local-{profile_id}-clinic-{clinic['id']}",),
        )
        conn.commit()
    return {"ok": True, "favourited": False, "clinicId": int(clinic["id"])}


@app.post("/api/member/favourites/lawyers/{lawyer_identifier}")
@app.post("/api/member/favorites/lawyers/{lawyer_identifier}")
def member_favourite_lawyer(lawyer_identifier: str, user: dict[str, Any] = Depends(require_user)):
    profile_id = require_profile_id(user)
    with db_cursor() as (conn, cursor):
        lawyer = fetch_lawyer(cursor, lawyer_identifier)
        data = as_dict(lawyer.get("data"))
        payload = {
            "profileLocalId": profile_id,
            "lawyerLocalId": int(lawyer["id"]),
            "lawyerId": data.get("id"),
        }
        cursor.execute(
            """
            INSERT INTO app_entities (entity_type, source_key, title, status, data, created_at, updated_at)
            VALUES ('favourite_lawyer', %s, %s, 'active', %s, UTC_TIMESTAMP(), UTC_TIMESTAMP())
            ON DUPLICATE KEY UPDATE status = 'active', data = VALUES(data), updated_at = UTC_TIMESTAMP()
            """,
            (f"local-{profile_id}-lawyer-{lawyer['id']}", lawyer["name"], json.dumps(payload, ensure_ascii=False)),
        )
        conn.commit()
    return {"ok": True, "favourited": True, "lawyerId": int(lawyer["id"])}


@app.delete("/api/member/favourites/lawyers/{lawyer_identifier}")
@app.delete("/api/member/favorites/lawyers/{lawyer_identifier}")
def member_unfavourite_lawyer(lawyer_identifier: str, user: dict[str, Any] = Depends(require_user)):
    profile_id = require_profile_id(user)
    with db_cursor() as (conn, cursor):
        lawyer = fetch_lawyer(cursor, lawyer_identifier)
        cursor.execute(
            """
            UPDATE app_entities
            SET status = 'archived', updated_at = UTC_TIMESTAMP()
            WHERE entity_type = 'favourite_lawyer' AND source_key = %s
            """,
            (f"local-{profile_id}-lawyer-{lawyer['id']}",),
        )
        conn.commit()
    return {"ok": True, "favourited": False, "lawyerId": int(lawyer["id"])}


@app.get("/api/member/blocks")
def member_blocks(user: dict[str, Any] = Depends(require_user)):
    profile_id = require_profile_id(user)
    with db_cursor() as (_, cursor):
        cursor.execute(
            """
            SELECT b.id AS blockId, b.reason, b.status AS blockStatus, b.created_at AS blockedAt,
                   p.id AS profileId, p.display_name AS displayName, p.role, p.status,
                   JSON_UNQUOTE(JSON_EXTRACT(p.data, '$.country')) AS country,
                   JSON_UNQUOTE(JSON_EXTRACT(p.data, '$.city')) AS city,
                   JSON_UNQUOTE(JSON_EXTRACT(p.data, '$.avatarUrl')) AS avatarUrl,
                   p.data
            FROM profile_blocks b
            JOIN profiles p ON p.id = b.blocked_profile_id
            WHERE b.blocker_profile_id = %s AND b.status = 'ACTIVE'
            ORDER BY b.updated_at DESC, b.id DESC
            LIMIT 200
            """,
            (profile_id,),
        )
        items = []
        for row in cursor.fetchall():
            item = public_profile_summary({**row, "id": row["profileId"]})
            item["blockId"] = row["blockId"]
            item["reason"] = row["reason"]
            item["blockedAt"] = row["blockedAt"]
            items.append(item)
    return {"items": items, "total": len(items)}


@app.post("/api/member/blocks/{profile_identifier}")
def member_block_profile(profile_identifier: str, payload: MemberBlockPayload, user: dict[str, Any] = Depends(require_user)):
    blocker_profile_id = require_profile_id(user)
    reason = (payload.reason or "").strip() or None
    with db_cursor() as (conn, cursor):
        blocked_profile_id = resolve_profile_id(cursor, profile_identifier)
        if blocked_profile_id == blocker_profile_id:
            raise HTTPException(status_code=422, detail="You cannot block your own profile")
        cursor.execute(
            """
            INSERT INTO profile_blocks (blocker_profile_id, blocked_profile_id, reason, status, created_at, updated_at)
            VALUES (%s, %s, %s, 'ACTIVE', UTC_TIMESTAMP(), UTC_TIMESTAMP())
            ON DUPLICATE KEY UPDATE reason = VALUES(reason), status = 'ACTIVE', updated_at = UTC_TIMESTAMP()
            """,
            (blocker_profile_id, blocked_profile_id, reason),
        )
        low_id, high_id = ordered_pair(blocker_profile_id, blocked_profile_id)
        cursor.execute(
            """
            UPDATE conversations
            SET status = 'BLOCKED', updated_at = UTC_TIMESTAMP()
            WHERE profile_a_id = %s AND profile_b_id = %s AND status = 'ACTIVE'
            """,
            (low_id, high_id),
        )
        cursor.execute(
            """
            UPDATE profile_matches
            SET status = 'DISSOLVED', updated_at = UTC_TIMESTAMP()
            WHERE profile_a_id = %s AND profile_b_id = %s AND status = 'ACTIVE'
            """,
            (low_id, high_id),
        )
        cursor.execute(
            """
            DELETE FROM profile_likes
            WHERE (actor_profile_id = %s AND target_profile_id = %s)
               OR (actor_profile_id = %s AND target_profile_id = %s)
            """,
            (blocker_profile_id, blocked_profile_id, blocked_profile_id, blocker_profile_id),
        )
        cursor.execute(
            """
            INSERT INTO api_events (event_type, payload)
            VALUES ('member.profile_blocked', %s)
            """,
            (json.dumps({"blockerProfileId": blocker_profile_id, "blockedProfileId": blocked_profile_id, "reason": reason}, ensure_ascii=False),),
        )
        conn.commit()
    return {"ok": True, "blocked": True}


@app.delete("/api/member/blocks/{profile_identifier}")
def member_unblock_profile(profile_identifier: str, user: dict[str, Any] = Depends(require_user)):
    blocker_profile_id = require_profile_id(user)
    with db_cursor() as (conn, cursor):
        blocked_profile_id = resolve_profile_id(cursor, profile_identifier)
        cursor.execute(
            """
            UPDATE profile_blocks
            SET status = 'DELETED', updated_at = UTC_TIMESTAMP()
            WHERE blocker_profile_id = %s AND blocked_profile_id = %s
            """,
            (blocker_profile_id, blocked_profile_id),
        )
        conn.commit()
    return {"ok": True, "blocked": False}


@app.post("/api/member/reports/{profile_identifier}")
def member_report_profile(profile_identifier: str, payload: MemberReportPayload, user: dict[str, Any] = Depends(require_user)):
    reporter_profile_id = require_profile_id(user)
    reason = (payload.reason or "").strip() or "Reported from profile"
    details = (payload.details or "").strip() or None
    with db_cursor() as (conn, cursor):
        target_profile_id = resolve_profile_id(cursor, profile_identifier)
        if target_profile_id == reporter_profile_id:
            raise HTTPException(status_code=422, detail="You cannot report your own profile")
        source_key = f"profile-report-{reporter_profile_id}-{target_profile_id}-{int(now_utc().timestamp())}-{secrets.token_hex(3)}"
        data = {
            "reporterProfileId": reporter_profile_id,
            "targetProfileId": target_profile_id,
            "reason": reason,
            "details": details,
        }
        cursor.execute(
            """
            INSERT INTO app_entities (entity_type, source_key, title, status, data)
            VALUES ('moderation_report', %s, %s, 'PENDING', %s)
            """,
            (source_key, f"Profile report #{target_profile_id}", json.dumps(data, ensure_ascii=False)),
        )
        cursor.execute(
            """
            INSERT INTO api_events (event_type, payload)
            VALUES ('member.profile_reported', %s)
            """,
            (json.dumps(data, ensure_ascii=False),),
        )
        conn.commit()
    return {"ok": True, "status": "PENDING"}


@app.post("/api/member/account-deletion")
def member_account_deletion(payload: AccountDeletionPayload, user: dict[str, Any] = Depends(require_user)):
    profile_id = require_profile_id(user)
    reason = (payload.reason or "").strip() or "Prefer not to say"
    details = (payload.details or "").strip() or None
    body = {
        "profileId": profile_id,
        "userId": user["id"],
        "email": user["email"],
        "reason": reason,
        "details": details,
        "requestedAt": now_utc().isoformat(),
        "deleteAfter": (now_utc() + timedelta(days=30)).isoformat(),
        "mode": "scheduled_30_days",
    }
    with db_cursor() as (conn, cursor):
        cursor.execute(
            """
            INSERT INTO app_entities (entity_type, source_key, title, status, data)
            VALUES ('account_deletion_request', %s, %s, 'PENDING', %s)
            ON DUPLICATE KEY UPDATE status = 'PENDING', data = VALUES(data), updated_at = UTC_TIMESTAMP()
            """,
            (f"local-{profile_id}", f"Account deletion request #{profile_id}", json.dumps(body, ensure_ascii=False)),
        )
        cursor.execute(
            """
            INSERT INTO api_events (event_type, payload)
            VALUES ('member.account_deletion_requested', %s)
            """,
            (json.dumps(body, ensure_ascii=False),),
        )
        update_profile_data(cursor, profile_id, {
            "deletionRequestedAt": body["requestedAt"],
            "deletionScheduledFor": body["deleteAfter"],
            "deletionReason": reason,
            "visibleInCatalog": False,
            "isVisibleInCatalog": False,
        })
        send_support_status_message(
            cursor,
            profile_id,
            "Your account deletion request has been received and is pending review.",
        )
        conn.commit()
    return {"ok": True, "status": "PENDING", "message": "Deletion request saved for admin review."}


@app.get("/api/member/conversations")
def member_conversations(user: dict[str, Any] = Depends(require_user)):
    profile_id = require_profile_id(user)
    with db_cursor() as (conn, cursor):
        ensure_support_welcome(cursor, profile_id)
        cursor.execute(
            """
            UPDATE conversation_messages AS m
            SET delivered_at = COALESCE(m.delivered_at, UTC_TIMESTAMP())
            WHERE EXISTS (
                SELECT 1
                FROM conversations AS c
                WHERE c.id = m.conversation_id
                  AND (c.profile_a_id = %s OR c.profile_b_id = %s)
                  AND c.status = 'ACTIVE'
            )
              AND m.sender_profile_id <> %s
              AND m.status = 'ACTIVE'
              AND m.delivered_at IS NULL
            """,
            (profile_id, profile_id, profile_id),
        )
        cursor.execute(
            conversation_scope_sql() + " ORDER BY (p.role = 'SUPPORT') DESC, c.updated_at DESC, c.id DESC LIMIT 100",
            (profile_id, profile_id, profile_id, profile_id, profile_id, profile_id, profile_id, profile_id),
        )
        items = cursor.fetchall()
        conn.commit()
    return {"items": items}


@app.get("/api/member/conversations/{conversation_id}/peer-profile")
def member_conversation_peer_profile(
    conversation_id: int,
    user: dict[str, Any] = Depends(require_user),
):
    """Return the other participant of a conversation owned by the current member."""
    profile_id = require_profile_id(user)
    with db_cursor() as (_, cursor):
        cursor.execute(
            """
            SELECT CASE
                     WHEN profile_a_id = %s THEN profile_b_id
                     WHEN profile_b_id = %s THEN profile_a_id
                     ELSE NULL
                   END AS other_profile_id
            FROM conversations
            WHERE id = %s
              AND status = 'ACTIVE'
              AND (profile_a_id = %s OR profile_b_id = %s)
            LIMIT 1
            """,
            (profile_id, profile_id, conversation_id, profile_id, profile_id),
        )
        row = cursor.fetchone()
    if not row or not row.get("other_profile_id"):
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"profileId": str(row["other_profile_id"])}


@app.post("/api/member/conversations")
def member_create_conversation(payload: ConversationCreatePayload, user: dict[str, Any] = Depends(require_user)):
    profile_id = require_profile_id(user)
    with db_cursor() as (conn, cursor):
        cursor.execute("SELECT id FROM profiles WHERE id = %s LIMIT 1 FOR UPDATE", (profile_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Profile not found")
        profile = fetch_profile(cursor, profile_id)
        target_profile_id = resolve_profile_id(cursor, payload.targetProfileId)
        if target_profile_id == profile_id:
            raise HTTPException(status_code=422, detail="You cannot message your own profile")
        if not profile_is_verified(profile):
            raise HTTPException(status_code=403, detail="Verify your profile before starting new chats")
        target_profile = fetch_profile(cursor, target_profile_id)
        target_role = str(target_profile.get("role") if target_profile else "").upper()
        if target_role == "USER" and not profile_is_visible_in_catalog(target_profile):
            raise HTTPException(status_code=404, detail="Profile not found")
        if target_role not in {"USER", "SUPPORT"}:
            raise HTTPException(status_code=404, detail="Profile not found")
        if has_active_block(cursor, profile_id, target_profile_id):
            raise HTTPException(status_code=403, detail="This conversation is not available")
        low_id, high_id = ordered_pair(profile_id, target_profile_id)
        cursor.execute(
            """
            SELECT id, status, match_id
            FROM conversations
            WHERE profile_a_id = %s AND profile_b_id = %s
            LIMIT 1
            """,
            (low_id, high_id),
        )
        existing = cursor.fetchone()
        match_id = active_match_id(cursor, profile_id, target_profile_id)
        if existing and existing.get("status") == "ACTIVE":
            cursor.execute(
                "DELETE FROM conversation_hidden WHERE conversation_id = %s AND profile_id = %s",
                (int(existing["id"]), profile_id),
            )
            conn.commit()
            return {
                "ok": True,
                "conversationId": int(existing["id"]),
                "existing": True,
                "cold": target_role == "USER" and not bool(match_id),
            }
        is_cold_chat = target_role == "USER" and not bool(match_id)
        if is_cold_chat:
            if not profile_is_premium(profile):
                raise HTTPException(status_code=402, detail="Premium is required to start a chat without a match")
            used_today = daily_cold_chat_count(cursor, profile_id)
            if used_today >= PREMIUM_DAILY_COLD_CHAT_LIMIT:
                raise HTTPException(
                    status_code=429,
                    detail=f"Daily cold chat limit reached ({PREMIUM_DAILY_COLD_CHAT_LIMIT}). Continue tomorrow.",
                )
        conversation_id = ensure_conversation(cursor, profile_id, target_profile_id, match_id)
        if is_cold_chat:
            record_cold_chat_open(cursor, profile_id, target_profile_id, conversation_id)
        conn.commit()
    return {"ok": True, "conversationId": conversation_id, "existing": False, "cold": is_cold_chat}


@app.delete("/api/member/conversations/{conversation_id}")
def member_hide_conversation(conversation_id: int, user: dict[str, Any] = Depends(require_user)):
    profile_id = require_profile_id(user)
    with db_cursor() as (conn, cursor):
        cursor.execute(
            """
            SELECT c.id, p.role AS other_role
            FROM conversations c
            JOIN profiles p ON p.id = CASE WHEN c.profile_a_id = %s THEN c.profile_b_id ELSE c.profile_a_id END
            WHERE c.id = %s
              AND (c.profile_a_id = %s OR c.profile_b_id = %s)
              AND c.status = 'ACTIVE'
            LIMIT 1
            """,
            (profile_id, conversation_id, profile_id, profile_id),
        )
        conversation = cursor.fetchone()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        if str(conversation.get("other_role") or "").upper() == "SUPPORT":
            raise HTTPException(status_code=403, detail="The support conversation cannot be deleted")
        cursor.execute(
            """
            INSERT INTO conversation_hidden (conversation_id, profile_id, hidden_at)
            VALUES (%s, %s, UTC_TIMESTAMP())
            ON DUPLICATE KEY UPDATE hidden_at = VALUES(hidden_at)
            """,
            (conversation_id, profile_id),
        )
        conn.commit()
    return {"ok": True}


@app.get("/api/member/conversations/{conversation_id}/messages")
def member_conversation_messages(conversation_id: int, user: dict[str, Any] = Depends(require_user)):
    profile_id = require_profile_id(user)
    with db_cursor() as (conn, cursor):
        cursor.execute(
            """
            SELECT id
            FROM conversations
            WHERE id = %s AND (profile_a_id = %s OR profile_b_id = %s) AND status = 'ACTIVE'
            LIMIT 1
            """,
            (conversation_id, profile_id, profile_id),
        )
        conversation = cursor.fetchone()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        cursor.execute(
            """
            SELECT profile_a_id, profile_b_id
            FROM conversations
            WHERE id = %s
            LIMIT 1
            """,
            (conversation_id,),
        )
        pair = cursor.fetchone()
        if pair and has_active_block(cursor, int(pair["profile_a_id"]), int(pair["profile_b_id"])):
            raise HTTPException(status_code=403, detail="Conversation is blocked")
        cursor.execute(
            "DELETE FROM conversation_hidden WHERE conversation_id = %s AND profile_id = %s",
            (conversation_id, profile_id),
        )
        cursor.execute(
            """
            UPDATE conversation_messages
            SET delivered_at = COALESCE(delivered_at, UTC_TIMESTAMP()),
                read_at = COALESCE(read_at, UTC_TIMESTAMP())
            WHERE conversation_id = %s AND sender_profile_id <> %s AND read_at IS NULL
            """,
            (conversation_id, profile_id),
        )
        marked_read_count = max(0, int(cursor.rowcount or 0))
        cursor.execute(
            """
            SELECT id, conversation_id AS conversationId, sender_profile_id AS senderProfileId,
                   body, media_url AS mediaUrl, created_at, delivered_at AS deliveredAt,
                   read_at AS readAt, status
            FROM conversation_messages
            WHERE conversation_id = %s AND status = 'ACTIVE'
            ORDER BY created_at ASC, id ASC
            LIMIT 300
            """,
            (conversation_id,),
        )
        messages = cursor.fetchall()
        unread_messages = member_unread_message_count(cursor, profile_id)
        conn.commit()
    return {
        "items": messages,
        "markedReadCount": marked_read_count,
        "counts": {"unreadMessages": unread_messages},
    }


@app.post("/api/member/conversations/{conversation_id}/messages")
def member_send_message(
    conversation_id: int,
    payload: MessageCreatePayload,
    background_tasks: BackgroundTasks,
    user: dict[str, Any] = Depends(require_user),
):
    profile_id = require_profile_id(user)
    body = payload.body.strip()
    if not body:
        raise HTTPException(status_code=422, detail="Message cannot be empty")
    with db_cursor() as (conn, cursor):
        cursor.execute(
            """
            SELECT id
            FROM conversations
            WHERE id = %s AND (profile_a_id = %s OR profile_b_id = %s) AND status = 'ACTIVE'
            LIMIT 1
            """,
            (conversation_id, profile_id, profile_id),
        )
        conversation = cursor.fetchone()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        cursor.execute(
            """
            SELECT profile_a_id, profile_b_id
            FROM conversations
            WHERE id = %s
            LIMIT 1
            """,
            (conversation_id,),
        )
        pair = cursor.fetchone()
        if pair and has_active_block(cursor, int(pair["profile_a_id"]), int(pair["profile_b_id"])):
            raise HTTPException(status_code=403, detail="Conversation is blocked")
        if pair:
            require_verified_conversation_action(cursor, profile_id, pair)
        cursor.execute(
            """
            INSERT INTO conversation_messages (conversation_id, sender_profile_id, body, status, created_at)
            VALUES (%s, %s, %s, 'ACTIVE', UTC_TIMESTAMP())
            """,
            (conversation_id, profile_id, body),
        )
        message_id = cursor.lastrowid
        cursor.execute("UPDATE conversations SET updated_at = UTC_TIMESTAMP() WHERE id = %s", (conversation_id,))
        cursor.execute("DELETE FROM conversation_hidden WHERE conversation_id = %s", (conversation_id,))
        conn.commit()
    recipient_profile_id = int(pair["profile_b_id"] if int(pair["profile_a_id"]) == profile_id else pair["profile_a_id"])
    background_tasks.add_task(
        send_profile_notification,
        recipient_profile_id,
        "NEW_MESSAGE",
        str(user.get("display_name") or "").strip(),
        body,
    )
    return {"ok": True, "message": {"id": message_id, "conversationId": conversation_id, "senderProfileId": profile_id, "body": body}}


@app.post("/api/member/conversations/{conversation_id}/attachments")
async def member_send_attachment(
    conversation_id: int,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user: dict[str, Any] = Depends(require_user),
):
    profile_id = require_profile_id(user)
    with db_cursor() as (_, cursor):
        cursor.execute(
            """
            SELECT id, profile_a_id, profile_b_id
            FROM conversations
            WHERE id = %s AND (profile_a_id = %s OR profile_b_id = %s) AND status = 'ACTIVE'
            LIMIT 1
            """,
            (conversation_id, profile_id, profile_id),
        )
        authorized_conversation = cursor.fetchone()
        if not authorized_conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        if has_active_block(
            cursor,
            int(authorized_conversation["profile_a_id"]),
            int(authorized_conversation["profile_b_id"]),
        ):
            raise HTTPException(status_code=403, detail="Conversation is blocked")
        require_verified_conversation_action(cursor, profile_id, authorized_conversation)
    content_type = (file.content_type or "").split(";")[0].lower()
    ext = ALLOWED_CHAT_ATTACHMENT_TYPES.get(content_type)
    if not ext:
        raise HTTPException(status_code=415, detail="Unsupported attachment type")
    body = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(body) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Attachment is too large")
    if not body:
        raise HTTPException(status_code=422, detail="Attachment is empty")
    original_name = Path(file.filename or f"attachment{ext}").name[:255]
    moderation: dict[str, Any] | None = None
    inspection: dict[str, Any] | None = None
    if content_type.startswith("image/"):
        inspection = inspect_chat_image(body)
        moderation = moderate_profile_image(body, require_face=False)
        if str(moderation.get("decision") or "REJECTED").upper() != "APPROVED":
            raise HTTPException(status_code=422, detail="This image cannot be sent because it did not pass the safety check")
    elif not body.startswith(b"%PDF-"):
        raise HTTPException(status_code=422, detail="The uploaded file is not a valid PDF")

    with db_cursor() as (conn, cursor):
        cursor.execute(
            """
            SELECT id, profile_a_id, profile_b_id
            FROM conversations
            WHERE id = %s AND (profile_a_id = %s OR profile_b_id = %s) AND status = 'ACTIVE'
            LIMIT 1
            """,
            (conversation_id, profile_id, profile_id),
        )
        conversation = cursor.fetchone()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        if has_active_block(cursor, int(conversation["profile_a_id"]), int(conversation["profile_b_id"])):
            raise HTTPException(status_code=403, detail="Conversation is blocked")
        require_verified_conversation_action(cursor, profile_id, conversation)

        storage_dir = UPLOAD_DIR / "chat" / str(conversation_id)
        storage_dir.mkdir(parents=True, exist_ok=True)
        storage_name = f"{int(now_utc().timestamp())}-{secrets.token_hex(8)}{ext}"
        storage_path = storage_dir / storage_name
        storage_path.write_bytes(body)
        storage_key = f"chat/{conversation_id}/{storage_name}"
        public_url = f"{UPLOAD_URL_PREFIX.rstrip('/')}/{storage_key}"
        metadata = {
            "originalName": original_name,
            "conversationId": conversation_id,
            "senderProfileId": profile_id,
            "purpose": "chat_attachment",
            "inspection": inspection,
            "moderation": moderation,
        }
        cursor.execute(
            """
            INSERT INTO media_files (storage_key, public_url, mime_type, bytes, metadata)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (storage_key, public_url, content_type, len(body), json.dumps(metadata, ensure_ascii=False)),
        )
        cursor.execute(
            """
            INSERT INTO conversation_messages (conversation_id, sender_profile_id, body, media_url, status, created_at)
            VALUES (%s, %s, %s, %s, 'ACTIVE', UTC_TIMESTAMP())
            """,
            (conversation_id, profile_id, original_name, public_url),
        )
        message_id = cursor.lastrowid
        cursor.execute("UPDATE conversations SET updated_at = UTC_TIMESTAMP() WHERE id = %s", (conversation_id,))
        cursor.execute("DELETE FROM conversation_hidden WHERE conversation_id = %s", (conversation_id,))
        conn.commit()

    recipient_profile_id = int(
        conversation["profile_b_id"]
        if int(conversation["profile_a_id"]) == profile_id
        else conversation["profile_a_id"]
    )
    background_tasks.add_task(
        send_profile_notification,
        recipient_profile_id,
        "NEW_MESSAGE",
        str(user.get("display_name") or "").strip(),
        original_name,
    )
    return {
        "ok": True,
        "message": {
            "id": message_id,
            "conversationId": conversation_id,
            "senderProfileId": profile_id,
            "body": original_name,
            "mediaUrl": public_url,
        },
    }


def livekit_is_configured() -> bool:
    return bool(LIVEKIT_URL and LIVEKIT_API_KEY and LIVEKIT_API_SECRET)


def livekit_member_token(profile_id: int, display_name: str, room_name: str) -> str:
    if not livekit_is_configured():
        raise HTTPException(status_code=503, detail="Calls are temporarily unavailable")
    issued_at = int(now_utc().timestamp())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "iss": LIVEKIT_API_KEY,
        "sub": f"profile-{profile_id}",
        "name": display_name or f"Member {profile_id}",
        "nbf": issued_at - 5,
        "iat": issued_at,
        "exp": issued_at + 3600,
        "video": {"roomJoin": True, "room": room_name, "canPublish": True, "canSubscribe": True, "canPublishData": True},
    }

    def encode_part(value: dict[str, Any]) -> str:
        raw = json.dumps(value, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")

    unsigned = f"{encode_part(header)}.{encode_part(payload)}"
    signature = hmac.new(LIVEKIT_API_SECRET.encode("utf-8"), unsigned.encode("ascii"), hashlib.sha256).digest()
    return f"{unsigned}.{base64.urlsafe_b64encode(signature).rstrip(b'=').decode('ascii')}"


def member_call_row(cursor, call_id: int, profile_id: int) -> dict[str, Any]:
    cursor.execute(
        """
        SELECT mc.*, caller.display_name AS callerName, callee.display_name AS calleeName,
               JSON_UNQUOTE(JSON_EXTRACT(caller.data, '$.avatarUrl')) AS callerAvatarUrl,
               JSON_UNQUOTE(JSON_EXTRACT(callee.data, '$.avatarUrl')) AS calleeAvatarUrl
        FROM member_calls mc
        JOIN profiles caller ON caller.id = mc.caller_profile_id
        JOIN profiles callee ON callee.id = mc.callee_profile_id
        WHERE mc.id = %s AND (mc.caller_profile_id = %s OR mc.callee_profile_id = %s)
        LIMIT 1
        """,
        (call_id, profile_id, profile_id),
    )
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Call not found")
    return row


def member_call_response(row: dict[str, Any], profile_id: int, include_token: bool = False) -> dict[str, Any]:
    is_caller = int(row["caller_profile_id"]) == profile_id
    result = {
        "id": int(row["id"]),
        "conversationId": int(row["conversation_id"]),
        "callType": str(row["call_type"]),
        "status": str(row["status"]),
        "incoming": not is_caller,
        "peerName": str(row.get("calleeName") if is_caller else row.get("callerName") or ""),
        "peerAvatarUrl": row.get("calleeAvatarUrl") if is_caller else row.get("callerAvatarUrl"),
        "createdAt": row.get("created_at"),
        "acceptedAt": row.get("accepted_at"),
    }
    if include_token:
        own_name = str(row.get("callerName") if is_caller else row.get("calleeName") or "")
        result.update(serverUrl=LIVEKIT_URL, token=livekit_member_token(profile_id, own_name, str(row["room_name"])))
    return result


def finish_member_call(cursor, row: dict[str, Any], final_status: str) -> None:
    if str(row.get("status")) in {"CANCELLED", "DECLINED", "ENDED", "MISSED"}:
        return
    cursor.execute(
        "UPDATE member_calls SET status = %s, ended_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP() WHERE id = %s",
        (final_status, int(row["id"])),
    )
    if row.get("history_message_id"):
        return
    label = "video" if str(row.get("call_type")) == "VIDEO" else "voice"
    body = f"Cancelled {label} call" if final_status in {"CANCELLED", "DECLINED", "MISSED"} else f"{label.title()} call"
    cursor.execute(
        "INSERT INTO conversation_messages (conversation_id, sender_profile_id, body, status, created_at) VALUES (%s, %s, %s, 'ACTIVE', UTC_TIMESTAMP())",
        (int(row["conversation_id"]), int(row["caller_profile_id"]), body),
    )
    cursor.execute("UPDATE member_calls SET history_message_id = %s WHERE id = %s", (cursor.lastrowid, int(row["id"])))
    cursor.execute("UPDATE conversations SET updated_at = UTC_TIMESTAMP() WHERE id = %s", (int(row["conversation_id"]),))


@app.post("/api/member/conversations/{conversation_id}/calls")
def member_start_call(conversation_id: int, payload: CallCreatePayload, user: dict[str, Any] = Depends(require_user)):
    if not livekit_is_configured():
        raise HTTPException(status_code=503, detail="Calls are temporarily unavailable")
    profile_id = require_profile_id(user)
    with db_cursor() as (conn, cursor):
        caller_profile = fetch_profile(cursor, profile_id)
        if not profile_is_premium(caller_profile):
            raise HTTPException(status_code=402, detail="Premium is required for video and audio calls")
        cursor.execute(
            "SELECT id, profile_a_id, profile_b_id FROM conversations WHERE id = %s AND (profile_a_id = %s OR profile_b_id = %s) AND status = 'ACTIVE' LIMIT 1",
            (conversation_id, profile_id, profile_id),
        )
        conversation = cursor.fetchone()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        callee_id = int(conversation["profile_b_id"] if int(conversation["profile_a_id"]) == profile_id else conversation["profile_a_id"])
        if has_active_block(cursor, profile_id, callee_id):
            raise HTTPException(status_code=403, detail="This conversation is not available")
        peer_profile = require_verified_conversation_action(cursor, profile_id, conversation)
        if str(peer_profile.get("role") or "").upper() == "SUPPORT":
            raise HTTPException(status_code=403, detail="Calls are not available in the support conversation")
        if not profile_is_verified(peer_profile):
            raise HTTPException(status_code=409, detail="This member is temporarily unavailable for calls")
        if not profile_is_premium(peer_profile):
            raise HTTPException(status_code=409, detail="This member does not have Premium calls")
        cursor.execute("SELECT * FROM member_calls WHERE caller_profile_id = %s AND status = 'RINGING' ORDER BY id DESC LIMIT 1", (profile_id,))
        previous = cursor.fetchone()
        if previous:
            finish_member_call(cursor, previous, "CANCELLED")
        room_name = f"chat-{conversation_id}-{uuid.uuid4().hex}"
        cursor.execute(
            "INSERT INTO member_calls (conversation_id, caller_profile_id, callee_profile_id, room_name, call_type, status) VALUES (%s, %s, %s, %s, %s, 'RINGING')",
            (conversation_id, profile_id, callee_id, room_name, payload.callType),
        )
        row = member_call_row(cursor, int(cursor.lastrowid), profile_id)
        conn.commit()
    return {"ok": True, "call": member_call_response(row, profile_id, include_token=True)}


@app.get("/api/member/calls/incoming")
def member_incoming_calls(user: dict[str, Any] = Depends(require_user)):
    profile_id = require_profile_id(user)
    if not livekit_is_configured():
        return {"items": []}
    with db_cursor() as (conn, cursor):
        profile = fetch_profile(cursor, profile_id)
        if not profile_is_premium(profile):
            return {"items": []}
        cursor.execute(
            "UPDATE member_calls SET status = 'MISSED', ended_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP() WHERE callee_profile_id = %s AND status = 'RINGING' AND created_at < UTC_TIMESTAMP() - INTERVAL %s SECOND",
            (profile_id, CALL_RING_SECONDS),
        )
        cursor.execute(
            """
            SELECT mc.*, caller.display_name AS callerName, callee.display_name AS calleeName,
                   JSON_UNQUOTE(JSON_EXTRACT(caller.data, '$.avatarUrl')) AS callerAvatarUrl,
                   JSON_UNQUOTE(JSON_EXTRACT(callee.data, '$.avatarUrl')) AS calleeAvatarUrl
            FROM member_calls mc
            JOIN profiles caller ON caller.id = mc.caller_profile_id
            JOIN profiles callee ON callee.id = mc.callee_profile_id
            WHERE mc.callee_profile_id = %s AND mc.status = 'RINGING'
            ORDER BY mc.created_at DESC LIMIT 1
            """,
            (profile_id,),
        )
        rows = cursor.fetchall()
        conn.commit()
    return {"items": [member_call_response(row, profile_id) for row in rows]}


@app.get("/api/member/calls/{call_id}")
def member_call_status(call_id: int, user: dict[str, Any] = Depends(require_user)):
    profile_id = require_profile_id(user)
    with db_cursor() as (_, cursor):
        row = member_call_row(cursor, call_id, profile_id)
    return {"call": member_call_response(row, profile_id)}


@app.post("/api/member/calls/{call_id}/accept")
def member_accept_call(call_id: int, user: dict[str, Any] = Depends(require_user)):
    profile_id = require_profile_id(user)
    with db_cursor() as (conn, cursor):
        profile = fetch_profile(cursor, profile_id)
        if not profile_is_premium(profile):
            raise HTTPException(status_code=402, detail="Premium is required for video and audio calls")
        row = member_call_row(cursor, call_id, profile_id)
        if int(row["callee_profile_id"]) != profile_id:
            raise HTTPException(status_code=403, detail="Only the recipient can accept this call")
        if str(row["status"]) != "RINGING":
            raise HTTPException(status_code=409, detail="This call is no longer available")
        peer_profile = require_verified_conversation_action(
            cursor,
            profile_id,
            {
                "profile_a_id": row["caller_profile_id"],
                "profile_b_id": row["callee_profile_id"],
            },
        )
        if not profile_is_premium(peer_profile):
            raise HTTPException(status_code=409, detail="This member does not have Premium calls")
        cursor.execute("UPDATE member_calls SET status = 'ACCEPTED', accepted_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP() WHERE id = %s", (call_id,))
        row["status"] = "ACCEPTED"
        row["accepted_at"] = now_utc()
        conn.commit()
    return {"ok": True, "call": member_call_response(row, profile_id, include_token=True)}


@app.post("/api/member/calls/{call_id}/decline")
def member_decline_call(call_id: int, user: dict[str, Any] = Depends(require_user)):
    profile_id = require_profile_id(user)
    with db_cursor() as (conn, cursor):
        row = member_call_row(cursor, call_id, profile_id)
        if int(row["callee_profile_id"]) != profile_id:
            raise HTTPException(status_code=403, detail="Only the recipient can decline this call")
        finish_member_call(cursor, row, "DECLINED")
        conn.commit()
    return {"ok": True}


@app.post("/api/member/calls/{call_id}/end")
def member_end_call(call_id: int, user: dict[str, Any] = Depends(require_user)):
    profile_id = require_profile_id(user)
    with db_cursor() as (conn, cursor):
        row = member_call_row(cursor, call_id, profile_id)
        finish_member_call(cursor, row, "CANCELLED" if str(row["status"]) == "RINGING" else "ENDED")
        conn.commit()
    return {"ok": True}


@app.get("/api/member/verification")
def member_verification_status(user: dict[str, Any] = Depends(require_user)):
    profile_id = require_profile_id(user)
    with db_cursor() as (_, cursor):
        profile = fetch_profile(cursor, profile_id)
        cursor.execute(
            """
            SELECT id, moderation_status AS moderationStatus
            FROM profile_photos
            WHERE profile_id = %s
              AND position = 0
              AND status = 'ACTIVE'
              AND upload_status = 'COMMITTED'
            LIMIT 1
            """,
            (profile_id,),
        )
        primary_photo = cursor.fetchone()
        primary_photo_ready = bool(primary_photo) and str(primary_photo.get("moderationStatus") or "").upper() == "APPROVED"
        cursor.execute(
            """
            SELECT id, status, data, created_at, updated_at
            FROM app_entities
            WHERE entity_type = 'verification'
              AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.profileId')) = %s
            ORDER BY updated_at DESC, id DESC
            LIMIT 1
            """,
            (str(profile_id),),
        )
        row = cursor.fetchone()
    profile_data = as_dict(profile.get("data") if profile else {})
    verified = profile_is_verified(profile)
    verified_at = profile_data.get("verifiedAt") or None
    if not row:
        return {
            "status": "APPROVED" if verified else "NOT_STARTED",
            "verifiedAt": verified_at,
            "providerConfigured": didit_is_configured(),
            "photoModerationConfigured": vision_is_configured(),
            "primaryPhoto": bool(primary_photo),
            "primaryPhotoReady": primary_photo_ready,
            "primaryPhotoModerationStatus": primary_photo.get("moderationStatus") if primary_photo else None,
        }
    normalized = normalize_row(row)
    data = as_dict(normalized.get("data"))
    reset_for_photo_change = data.get("resetReason") == "PROFILE_PHOTO_CHANGED"
    current_status = (
        "APPROVED"
        if verified
        else "NOT_STARTED"
        if reset_for_photo_change
        else didit_internal_status(normalized.get("status"))
    )
    result = {
        "id": normalized.get("id"),
        "status": current_status,
        "provider": data.get("provider") or "didit",
        "sessionId": data.get("sessionId"),
        "createdAt": normalized.get("created_at"),
        "updatedAt": normalized.get("updated_at"),
        "verifiedAt": verified_at,
        "providerConfigured": didit_is_configured(),
        "photoModerationConfigured": vision_is_configured(),
        "primaryPhoto": bool(primary_photo),
        "primaryPhotoReady": primary_photo_ready,
        "primaryPhotoModerationStatus": primary_photo.get("moderationStatus") if primary_photo else None,
    }
    if current_status in {"PENDING", "IN_REVIEW"} and data.get("verificationUrl"):
        result["url"] = data.get("verificationUrl")
    return result


@app.post("/api/member/verification")
def member_submit_verification(payload: VerificationPayload, user: dict[str, Any] = Depends(require_user)):
    profile_id = require_profile_id(user)
    if not didit_is_configured():
        raise HTTPException(status_code=503, detail="Profile verification provider is not configured")
    with db_cursor() as (conn, cursor):
        cursor.execute(
            """
            SELECT id, public_url AS publicUrl, moderation_status AS moderationStatus
            FROM profile_photos
            WHERE profile_id = %s
              AND status = 'ACTIVE'
              AND upload_status = 'COMMITTED'
              AND moderation_status = 'APPROVED'
              AND position = 0
            LIMIT 1
            """,
            (profile_id,),
        )
        primary_photo = cursor.fetchone()
        if not primary_photo:
            raise HTTPException(status_code=409, detail="Upload a primary profile photo before verification")
        cursor.execute(
            """
            SELECT status, data
            FROM app_entities
            WHERE entity_type = 'verification'
              AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.profileId')) = %s
              AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.referencePhotoId')) = %s
              AND status IN ('PENDING', 'IN_REVIEW')
            ORDER BY updated_at DESC, id DESC
            LIMIT 1
            """,
            (str(profile_id), str(primary_photo["id"])),
        )
        active_verification = cursor.fetchone()
        if active_verification:
            active_data = as_dict(active_verification.get("data"))
            active_url = str(active_data.get("verificationUrl") or "").strip()
            return {
                "ok": True,
                "status": didit_internal_status(active_verification.get("status")),
                "sessionId": active_data.get("sessionId"),
                "url": active_url or None,
                "existing": True,
            }
    portrait_image = didit_portrait_base64(primary_photo["publicUrl"])
    requested_locale = str(payload.payload.get("locale") or "en").strip().lower()
    language = requested_locale if requested_locale in {"en", "ru", "es"} else "en"
    callback = f"{PUBLIC_APP_URL}/{language}/profile/verification/?didit=complete"
    attempt_id = uuid.uuid4().hex[:12]
    vendor_data = f"profile-{profile_id}-photo-{primary_photo['id']}-attempt-{attempt_id}"
    session = didit_request(
        "session/",
        method="POST",
        payload={
            "workflow_id": DIDIT_WORKFLOW_ID,
            "vendor_data": vendor_data,
            "callback": callback,
            "callback_method": "both",
            "language": language,
            "portrait_image": portrait_image,
            "metadata": {
                "profile_id": str(profile_id),
                "reference_photo_id": str(primary_photo["id"]),
                "purpose": "profile_photo_verification",
            },
        },
    )
    session_id = str(session.get("session_id") or "").strip()
    verification_url = str(session.get("url") or "").strip()
    if not session_id or not verification_url:
        raise HTTPException(status_code=502, detail="Verification provider did not create a usable session")
    internal_status = didit_internal_status(session.get("status"))
    data = {
        "profileId": profile_id,
        "type": payload.verificationType,
        "provider": "didit",
        "sessionId": session_id,
        "workflowId": DIDIT_WORKFLOW_ID,
        "vendorData": vendor_data,
        "verificationUrl": verification_url,
        "providerStatus": session.get("status"),
        "attemptId": attempt_id,
        "referencePhotoId": primary_photo.get("id"),
        "startedAt": now_utc().isoformat(),
    }
    with db_cursor() as (conn, cursor):
        cursor.execute(
            """
            INSERT INTO app_entities (entity_type, source_key, title, status, data)
            VALUES ('verification', %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE status = VALUES(status), data = VALUES(data), updated_at = UTC_TIMESTAMP()
            """,
            (f"didit-{session_id}", f"Verification request #{profile_id}", internal_status, json.dumps(data, ensure_ascii=False)),
        )
        cursor.execute(
            "INSERT INTO api_events (event_type, payload) VALUES ('member.verification_started', %s)",
            (json.dumps({"profileId": profile_id, "provider": "didit", "sessionId": session_id}, ensure_ascii=False),),
        )
        send_support_status_message(
            cursor,
            profile_id,
            "Your profile verification has been submitted and is being reviewed.",
        )
        conn.commit()
    return {"ok": True, "status": internal_status, "sessionId": session_id, "url": verification_url}


@app.post("/api/member/verification/abandon")
def member_abandon_verification(user: dict[str, Any] = Depends(require_user)):
    profile_id = require_profile_id(user)
    with db_cursor() as (conn, cursor):
        cursor.execute(
            """
            SELECT id, data
            FROM app_entities
            WHERE entity_type = 'verification'
              AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.profileId')) = %s
              AND status IN ('PENDING', 'IN_REVIEW')
            ORDER BY updated_at DESC, id DESC
            LIMIT 1
            FOR UPDATE
            """,
            (str(profile_id),),
        )
        verification = cursor.fetchone()
        if not verification:
            return {"ok": True, "status": "NOT_STARTED"}
        data = as_dict(verification.get("data"))
        session_id = str(data.get("sessionId") or "").strip()
        if not session_id:
            raise HTTPException(status_code=409, detail="Verification provider session is unavailable")
        try:
            provider_session_id = str(uuid.UUID(session_id))
        except ValueError as error:
            raise HTTPException(status_code=409, detail="Verification provider session is invalid") from error
        didit_request(
            f"session/{provider_session_id}/delete/",
            method="DELETE",
            allow_not_found=True,
        )
        data.pop("verificationUrl", None)
        data["abandonedAt"] = now_utc().isoformat()
        data["providerDeleted"] = True
        data["providerDeletedAt"] = data["abandonedAt"]
        cursor.execute(
            "UPDATE app_entities SET status = 'ABANDONED', data = %s, updated_at = UTC_TIMESTAMP() WHERE id = %s",
            (json.dumps(data, ensure_ascii=False), verification["id"]),
        )
        cursor.execute(
            "INSERT INTO api_events (event_type, payload) VALUES ('member.verification_abandoned', %s)",
            (json.dumps({"profileId": profile_id, "sessionId": data.get("sessionId")}, ensure_ascii=False),),
        )
        send_support_status_message(
            cursor,
            profile_id,
            "Your profile verification was cancelled.",
        )
        conn.commit()
    return {"ok": True, "status": "ABANDONED"}


@app.post("/api/webhooks/didit")
async def didit_webhook(request: Request):
    if not DIDIT_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Verification webhook is not configured")
    raw_body = await request.body()
    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=400, detail="Invalid webhook payload") from error
    if not isinstance(payload, dict) or not didit_webhook_signature_is_valid(payload, raw_body, request):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")
    session_id = str(payload.get("session_id") or "").strip()
    if not session_id:
        raise HTTPException(status_code=422, detail="Missing verification session id")
    internal_status = didit_internal_status(payload.get("status"))
    with db_cursor() as (conn, cursor):
        cursor.execute(
            "SELECT id, status, data FROM app_entities WHERE entity_type = 'verification' AND source_key = %s LIMIT 1 FOR UPDATE",
            (f"didit-{session_id}",),
        )
        verification = cursor.fetchone()
        if not verification:
            return {"ok": True, "ignored": True}
        previous_status = didit_internal_status(verification.get("status"))
        if didit_internal_status(verification.get("status")) in {"ABANDONED", "EXPIRED"}:
            return {"ok": True, "ignored": True, "status": didit_internal_status(verification.get("status"))}
        data = as_dict(verification.get("data"))
        profile_id = int_or_none(data.get("profileId"))
        if not profile_id:
            raise HTTPException(status_code=409, detail="Verification session is not linked to a profile")
        payload_workflow = str(payload.get("workflow_id") or "").strip()
        expected_workflow = str(data.get("workflowId") or "").strip()
        if payload_workflow and expected_workflow and payload_workflow != expected_workflow:
            raise HTTPException(status_code=409, detail="Verification workflow does not match the session")
        payload_vendor = str(payload.get("vendor_data") or "").strip()
        expected_vendor = str(data.get("vendorData") or "").strip()
        if payload_vendor and expected_vendor and payload_vendor != expected_vendor:
            raise HTTPException(status_code=409, detail="Verification user reference does not match the session")
        if internal_status == "APPROVED":
            reference_photo_id = int_or_none(data.get("referencePhotoId"))
            cursor.execute(
                """
                SELECT id
                FROM profile_photos
                WHERE id = %s AND profile_id = %s AND position = 0
                  AND status = 'ACTIVE' AND upload_status = 'COMMITTED' AND moderation_status = 'APPROVED'
                LIMIT 1
                """,
                (reference_photo_id or 0, profile_id),
            )
            if not cursor.fetchone():
                internal_status = "EXPIRED"
                data["localDecision"] = "REFERENCE_PHOTO_CHANGED"
        data["providerStatus"] = payload.get("status")
        data["webhookType"] = payload.get("webhook_type")
        data["decision"] = didit_safe_decision(payload.get("decision") or {})
        data["resolvedAt"] = now_utc().isoformat()
        if internal_status not in {"PENDING", "IN_REVIEW"}:
            data.pop("verificationUrl", None)
        cursor.execute(
            "UPDATE app_entities SET status = %s, data = %s, updated_at = UTC_TIMESTAMP() WHERE id = %s",
            (internal_status, json.dumps(data, ensure_ascii=False), verification["id"]),
        )
        if internal_status == "APPROVED":
            update_profile_data(
                cursor,
                profile_id,
                {"isVerified": True, "verifiedAt": now_utc().isoformat(), "verificationProvider": "didit"},
            )
        elif internal_status in {"DECLINED", "ABANDONED", "EXPIRED"}:
            update_profile_data(
                cursor,
                profile_id,
                {"isVerified": False, "verifiedAt": None, "verificationProvider": None},
            )
        cursor.execute(
            "INSERT INTO api_events (event_type, payload) VALUES ('member.verification_updated', %s)",
            (json.dumps({"profileId": profile_id, "provider": "didit", "sessionId": session_id, "status": internal_status}, ensure_ascii=False),),
        )
        if internal_status != previous_status and internal_status not in {"PENDING", "IN_REVIEW"}:
            verification_messages = {
                "APPROVED": "Your profile verification has been approved.",
                "DECLINED": "Your profile verification was not approved. Please review your main photo and try again.",
                "EXPIRED": "Your profile verification session expired. You can start verification again.",
                "ABANDONED": "Your profile verification was cancelled.",
            }
            send_support_status_message(
                cursor,
                profile_id,
                verification_messages.get(internal_status, f"Your profile verification status changed to {internal_status.lower()}.")
            )
        conn.commit()
    return {"ok": True, "status": internal_status}


@app.get("/api/member/subscription")
def member_subscription_status(user: dict[str, Any] = Depends(require_user)):
    profile_id = require_profile_id(user)
    with db_cursor() as (_, cursor):
        profile = fetch_profile(cursor, profile_id)
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        if not profile_is_verified(profile):
            # The public UI must not reveal plans or prices before verification.
            # Returning this access state (rather than an error) lets it render the
            # verified-profile gate without briefly exposing premium controls.
            return {
                "isVerified": False,
                "isPremium": False,
                "status": "VERIFICATION_REQUIRED",
                "request": None,
            }
        cursor.execute(
            """
            SELECT id, status, data, created_at, updated_at
            FROM app_entities
            WHERE entity_type = 'subscription'
              AND CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$.profileId')) AS CHAR) = CAST(%s AS CHAR)
            ORDER BY id DESC
            LIMIT 1
            """,
            (profile_id,),
        )
        subscription = cursor.fetchone()
    data = as_dict(subscription.get("data") if subscription else {})
    is_premium = profile_is_premium(profile)
    status = "ACTIVE" if is_premium else str(subscription.get("status") if subscription else "NOT_STARTED").upper()
    return {
        "isVerified": profile_is_verified(profile),
        "isPremium": is_premium,
        "status": status,
        "request": {
            "id": subscription.get("id"),
            "plan": data.get("plan"),
            "createdAt": subscription.get("created_at"),
            "updatedAt": subscription.get("updated_at"),
        } if subscription else None,
    }


@app.post("/api/member/subscription-intent")
def member_subscription_intent(payload: SubscriptionIntentPayload, user: dict[str, Any] = Depends(require_user)):
    profile_id = require_profile_id(user)
    plan = normalize_subscription_plan(payload.plan)
    with db_cursor() as (conn, cursor):
        cursor.execute(
            "SELECT id, display_name, email, status, data FROM profiles WHERE id = %s LIMIT 1 FOR UPDATE",
            (profile_id,),
        )
        profile = cursor.fetchone()
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        if not profile_is_verified(profile):
            raise HTTPException(status_code=403, detail="Profile verification is required before Premium")
        if profile_is_premium(profile):
            return {"ok": True, "status": "ACTIVE", "message": "Premium is already active."}
        cursor.execute(
            """
            SELECT id, data, created_at, updated_at
            FROM app_entities
            WHERE entity_type = 'subscription'
              AND status = 'PENDING'
              AND CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$.profileId')) AS CHAR) = CAST(%s AS CHAR)
            ORDER BY id DESC
            LIMIT 1
            FOR UPDATE
            """,
            (profile_id,),
        )
        pending = cursor.fetchone()
        if pending:
            return {
                "ok": True,
                "status": "PENDING",
                "requestId": pending["id"],
                "message": "Your subscription request is already under review.",
            }
        requested_at = now_utc().strftime("%Y-%m-%dT%H:%M:%SZ")
        subscription_data = {
            "profileId": profile_id,
            "profileName": profile.get("display_name") or "No profile",
            "email": profile.get("email") or "",
            "plan": plan,
            "source": "MEMBER_REQUEST",
            "requestedAt": requested_at,
            "requestPayload": payload.payload,
        }
        cursor.execute(
            """
            INSERT INTO app_entities (entity_type, source_key, title, status, data)
            VALUES ('subscription', %s, %s, 'PENDING', %s)
            """,
            (
                f"member-subscription-{profile_id}-{secrets.token_hex(6)}",
                f"Premium request: {profile.get('display_name') or profile_id}",
                json.dumps(subscription_data, ensure_ascii=False),
            ),
        )
        request_id = cursor.lastrowid
        event = {"profileId": profile_id, "requestId": request_id, "plan": plan, "source": "MEMBER_REQUEST"}
        cursor.execute(
            "INSERT INTO api_events (event_type, payload) VALUES ('payment.subscription_intent', %s)",
            (json.dumps(event, ensure_ascii=False),),
        )
        send_support_status_message(
            cursor,
            profile_id,
            "Your Premium subscription request has been received and is pending review.",
        )
        conn.commit()
    return {
        "ok": True,
        "status": "PENDING",
        "requestId": request_id,
        "message": "Your subscription request was saved for manual review.",
    }


@app.get("/api/meta")
def meta():
    tables = [
        "pages",
        "assets",
        "screenshot_sections",
        "app_entities",
        "content_pages",
        "articles",
        "profiles",
        "clinics",
        "lawyers",
        "media_files",
        "profile_photos",
        "profile_likes",
        "profile_matches",
        "profile_blocks",
        "conversations",
        "conversation_messages",
        "local_users",
        "firebase_identities",
        "auth_sessions",
        "admin_audit_log",
        "api_events",
    ]
    counts = {}
    with db_cursor() as (conn, cursor):
        for table in tables:
            try:
                counts[table] = fetch_count(cursor, table)
            except psycopg.Error:
                # PostgreSQL marks a transaction as failed after a missing
                # legacy table. Roll it back before collecting the remaining
                # optional counters.
                conn.rollback()
                counts[table] = None
        for entity_type in ["subscription", "subscription_event", "profile_view", "favourite_clinic", "favourite_lawyer"]:
            cursor.execute("SELECT COUNT(*) AS cnt FROM app_entities WHERE entity_type = %s", (entity_type,))
            counts[f"app_entities.{entity_type}"] = int(cursor.fetchone()["cnt"])
    return {"counts": counts}


@app.get("/api/pages")
def pages(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    q: str | None = Query(None, min_length=1, max_length=200),
):
    params: list[Any] = []
    where = ""
    if q:
        where = "WHERE title LIKE %s OR path LIKE %s OR source_url LIKE %s"
        like = f"%{q}%"
        params.extend([like, like, like])
    params.extend([limit, offset])
    with db_cursor() as (_, cursor):
        cursor.execute(
            f"""
            SELECT id, source_url, final_url, path, title, html_file, created_at
            FROM pages
            {where}
            ORDER BY id ASC
            LIMIT %s OFFSET %s
            """,
            params,
        )
        items = [normalize_row(row) for row in cursor.fetchall()]
    return {"items": items, "limit": limit, "offset": offset}


@app.get("/api/pages/{page_id}")
def page_detail(page_id: int):
    with db_cursor() as (_, cursor):
        cursor.execute(
            """
            SELECT id, source_url, final_url, path, title, html_file, created_at
            FROM pages
            WHERE id = %s
            """,
            (page_id,),
        )
        row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Page not found")
    return normalize_row(row)


@app.get("/api/entities/{entity_type}")
def entities(
    entity_type: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _admin: str = Depends(require_admin),
):
    with db_cursor() as (_, cursor):
        cursor.execute(
            """
            SELECT id, entity_type, source_key, title, status, locale, slug, data,
                   created_at, updated_at
            FROM app_entities
            WHERE entity_type = %s
            ORDER BY id ASC
            LIMIT %s OFFSET %s
            """,
            (entity_type, limit, offset),
        )
        items = [normalize_row(row) for row in cursor.fetchall()]
    return {"items": items, "limit": limit, "offset": offset}


@app.post("/api/admin/login")
def admin_login(payload: AdminLoginPayload, response: Response):
    if not ADMIN_API_PASSWORD:
        raise HTTPException(status_code=503, detail="Admin API password is not configured")
    email = payload.email.strip()
    if not has_valid_admin_credentials(email, payload.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin credentials")
    dynamic = dynamic_admin_account(email)
    if dynamic:
        data = {key: value for key, value in dynamic.items() if key not in {"id", "source_key", "title", "status", "created_at", "updated_at", "password_hash"}}
        data["lastLoginAt"] = now_utc().isoformat()
        with db_cursor() as (conn, cursor):
            cursor.execute("UPDATE app_entities SET data = %s, updated_at = UTC_TIMESTAMP() WHERE id = %s", (json.dumps(data, ensure_ascii=False), dynamic["id"]))
            conn.commit()
    response.set_cookie(
        key=ADMIN_SESSION_COOKIE,
        value=sign_admin_session(email),
        max_age=ADMIN_SESSION_HOURS * 60 * 60,
        httponly=True,
        secure=True,
        samesite="strict",
        path="/admin",
    )
    return {"ok": True, "email": email}


@app.post("/api/admin/logout")
def admin_logout(response: Response):
    response.delete_cookie(
        key=ADMIN_SESSION_COOKIE,
        path="/admin",
        secure=True,
        httponly=True,
        samesite="strict",
    )
    return {"ok": True}


@app.get("/api/admin/session")
def admin_session(admin: str = Depends(require_admin)):
    account = dynamic_admin_account(admin)
    return {"ok": True, "email": admin, "role": account.get("role", "ADMIN") if account else "ADMIN", "permissions": account.get("permissions", []) if account else ["*"]}


@app.get("/api/admin/accounts")
def admin_accounts(admin: str = Depends(require_admin)):
    items: list[dict[str, Any]] = []
    configured = [ADMIN_API_USER, ADMIN_TEST_USER]
    for email in configured:
        if email and email not in {item.get("email") for item in items}:
            items.append({"email": email, "role": "ADMIN", "permissions": ["*"], "status": "ACTIVE", "configured": True})
    with db_cursor() as (_, cursor):
        cursor.execute("SELECT id, source_key, status, data, created_at, updated_at FROM app_entities WHERE entity_type = 'admin_account' ORDER BY created_at ASC, id ASC")
        rows = cursor.fetchall()
    for row in rows:
        data = row.get("data")
        if isinstance(data, str):
            try: data = json.loads(data)
            except json.JSONDecodeError: data = {}
        data = data if isinstance(data, dict) else {}
        items.append({"id": row.get("id"), "email": data.get("email") or row.get("source_key"), "role": data.get("role") or "STAFF", "permissions": data.get("permissions") or [], "status": str(row.get("status") or "ACTIVE").upper(), "lastLoginAt": data.get("lastLoginAt"), "createdAt": row.get("created_at")})
    return {"items": items, "total": len(items), "limit": len(items), "offset": 0, "current": admin}


@app.post("/api/admin/accounts")
def admin_create_account(payload: AdminAccountCreatePayload, actor: str = Depends(require_admin)):
    actor_account = dynamic_admin_account(actor)
    if actor_account and str(actor_account.get("role") or "STAFF").upper() != "ADMIN":
        raise HTTPException(status_code=403, detail="Only administrators can create admin accounts")
    email = payload.email.strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(status_code=422, detail="Enter a valid email address")
    if not re.search(r"[A-Z]", payload.password) or not re.search(r"\d", payload.password):
        raise HTTPException(status_code=422, detail="Password must contain an uppercase letter and a number")
    allowed = {"dashboard", "users", "subscriptions", "verifications", "clinics", "lawyers", "articles", "support", "moderation-photos", "moderation-reports", "livekit", "monitoring", "storage", "static-pages", "marketing", "settings"}
    permissions = sorted(set(payload.permissions) & allowed) if payload.role == "STAFF" else ["*"]
    with db_cursor() as (conn, cursor):
        cursor.execute("SELECT id FROM app_entities WHERE entity_type = 'admin_account' AND LOWER(source_key) = %s LIMIT 1", (email,))
        if cursor.fetchone() or is_configured_admin_user(email):
            raise HTTPException(status_code=409, detail="An admin account with this email already exists")
        data = {"email": email, "passwordHash": hash_password(payload.password), "role": payload.role, "permissions": permissions}
        cursor.execute("INSERT INTO app_entities (entity_type, source_key, title, status, data, created_at, updated_at) VALUES ('admin_account', %s, %s, 'ACTIVE', %s, UTC_TIMESTAMP(), UTC_TIMESTAMP()) RETURNING id", (email, email, json.dumps(data, ensure_ascii=False)))
        account_id = cursor.fetchone()["id"]
        audit(conn, actor, "create_admin_account", "admin_account", account_id, {"email": email, "role": payload.role, "permissions": permissions})
        conn.commit()
    return {"ok": True, "id": account_id, "email": email, "role": payload.role, "permissions": permissions}


@app.patch("/api/admin/accounts/{account_id}")
def admin_update_account(account_id: int, payload: AdminAccountUpdatePayload, actor: str = Depends(require_admin)):
    actor_account = dynamic_admin_account(actor)
    if actor_account and str(actor_account.get("role") or "STAFF").upper() != "ADMIN":
        raise HTTPException(status_code=403, detail="Only administrators can manage admin accounts")
    allowed = {"dashboard", "users", "subscriptions", "verifications", "clinics", "lawyers", "articles", "support", "moderation-photos", "moderation-reports", "livekit", "monitoring", "storage", "static-pages", "marketing", "settings"}
    permissions = sorted(set(payload.permissions) & allowed) if payload.role == "STAFF" else ["*"]
    with db_cursor() as (conn, cursor):
        cursor.execute("SELECT id, source_key, status, data FROM app_entities WHERE id = %s AND entity_type = 'admin_account' LIMIT 1", (account_id,))
        row = cursor.fetchone()
        if not row: raise HTTPException(status_code=404, detail="Admin account not found")
        data = row.get("data")
        if isinstance(data, str):
            try: data = json.loads(data)
            except json.JSONDecodeError: data = {}
        data = data if isinstance(data, dict) else {}
        data.update({"role": payload.role, "permissions": permissions})
        if payload.password:
            if len(payload.password) < 8 or not re.search(r"[A-Z]", payload.password) or not re.search(r"\d", payload.password):
                raise HTTPException(status_code=422, detail="Password must be at least 8 characters and contain an uppercase letter and a number")
            data["passwordHash"] = hash_password(payload.password)
        cursor.execute("UPDATE app_entities SET data = %s, updated_at = UTC_TIMESTAMP() WHERE id = %s", (json.dumps(data, ensure_ascii=False), account_id))
        audit(conn, actor, "update_admin_account", "admin_account", account_id, {"role": payload.role, "permissions": permissions, "passwordChanged": bool(payload.password)})
        conn.commit()
    return {"ok": True, "id": account_id, "email": data.get("email") or row.get("source_key"), "role": payload.role, "permissions": permissions}


@app.post("/api/admin/notifications/test")
def admin_test_notification(
    payload: AdminNotificationTestPayload,
    admin: str = Depends(require_admin),
):
    result = send_profile_notification(
        payload.profileId,
        payload.notificationType,
        payload.actorName,
        payload.message,
        force=not payload.respectPreference,
    )
    with db_cursor() as (conn, _):
        audit(
            conn,
            admin,
            "test_notification",
            "profiles",
            payload.profileId,
            {
                "notificationType": payload.notificationType,
                "respectPreference": payload.respectPreference,
                "status": result.get("status"),
            },
        )
        conn.commit()
    if not result.get("ok"):
        raise HTTPException(status_code=503, detail=result.get("status") or "Notification delivery failed")
    return result


@app.get("/api/admin/stats")
def admin_stats(_admin: str = Depends(require_admin)):
    profile_dashboard: dict[str, Any] = {
        "totalProfiles": 0,
        "withoutProfile": 0,
        "avgCompleteness": 0,
        "verified": 0,
        "unverified": 0,
        "visible": 0,
        "hidden": 0,
        "verifications": {"approved": 0, "pending": 0, "declined": 0, "abandoned": 0, "expired": 0},
        "profileTypes": [],
        "totalDonors": 0,
        "spermDonors": 0,
        "eggDonors": 0,
        "spermDonorPercent": 0,
        "eggDonorPercent": 0,
        "lookingFor": [],
    }
    engagement_dashboard: dict[str, Any] = {
        "totalLikes": 0, "likesToday": 0, "totalMatches": 0, "matchesToday": 0,
        "activeMatches": 0, "matchRate": 0, "daily": [], "likeFlow": {"headers": [], "rows": [], "total": 0}, "likeFlowByRange": {},
        "pendingPhotos": 0, "pendingReports": 0,
    }
    subscriptions_dashboard: dict[str, Any] = {"active": 0, "premiumUsers": 0, "conversionRate": 0, "plans": []}
    partners_dashboard: dict[str, Any] = {"totalPartners": 0, "verifiedPartners": 0, "clinics": 0, "activeClinics": 0, "lawyers": 0, "activeLawyers": 0, "newPartners7d": 0, "newPartners30d": 0}
    devices_dashboard: dict[str, Any] = {"countries": [], "devices": [], "browsers": [], "platforms": {}, "comparison": []}
    funnel_dashboard: dict[str, Any] = {"rows": []}
    tables = {
        "raw": "app_entities",
        "profiles": "profiles",
        "clinics": "clinics",
        "lawyers": "lawyers",
        "articles": "articles",
        "content_pages": "content_pages",
        "media_files": "media_files",
        "api_events": "api_events",
        "profile_likes": "profile_likes",
        "profile_matches": "profile_matches",
        "profile_blocks": "profile_blocks",
        "conversations": "conversations",
        "conversation_messages": "conversation_messages",
        "profile_photos": "profile_photos",
        "verifications": "app_entities",
        "subscriptions": "app_entities",
        "subscription_events": "app_entities",
        "profile_views": "app_entities",
        "favourite_clinics": "app_entities",
        "favourite_lawyers": "app_entities",
    }
    with db_cursor() as (_, cursor):
        warnings: list[str] = []

        def scalar(name: str, query: str, params: tuple[Any, ...] | None = None) -> int:
            try:
                cursor.execute(query, params or ())
                row = cursor.fetchone() or {}
                return int(row.get("cnt") or 0)
            except psycopg.Error as error:
                logger.warning("Admin stats query %s failed: %s", name, error)
                warnings.append(name)
                return 0

        counts = {}
        for name, table in tables.items():
            if name in {"verifications", "subscriptions", "subscription_events", "profile_views", "favourite_clinics", "favourite_lawyers"}:
                entity_type = {
                    "verifications": "verification",
                    "subscriptions": "subscription",
                    "subscription_events": "subscription_event",
                    "profile_views": "profile_view",
                    "favourite_clinics": "favourite_clinic",
                    "favourite_lawyers": "favourite_lawyer",
                }[name]
                counts[name] = scalar(name, "SELECT COUNT(*) AS cnt FROM app_entities WHERE entity_type = %s", (entity_type,))
            else:
                counts[name] = scalar(name, f"SELECT COUNT(*) AS cnt FROM `{table}`")

        try:
            cursor.execute(
                """
                SELECT entity_type, COUNT(*) AS cnt
                FROM app_entities
                GROUP BY entity_type
                ORDER BY entity_type ASC
                """
            )
            entity_counts = cursor.fetchall()
        except psycopg.Error as error:
            logger.warning("Admin stats entity counts failed: %s", error)
            warnings.append("entity_counts")
            entity_counts = []

        scalar_queries = {
            "registrations_30d": "SELECT COUNT(*) AS cnt FROM profiles WHERE created_at >= UTC_TIMESTAMP() - INTERVAL 30 DAY",
            "registrations_1d": "SELECT COUNT(*) AS cnt FROM profiles WHERE created_at >= UTC_TIMESTAMP() - INTERVAL 1 DAY",
            "registrations_7d": "SELECT COUNT(*) AS cnt FROM profiles WHERE created_at >= UTC_TIMESTAMP() - INTERVAL 7 DAY",
            "active_users": "SELECT COUNT(*) AS cnt FROM profiles WHERE LOWER(status) NOT IN ('banned', 'deleted', 'archived', 'inactive')",
            "banned_users": "SELECT COUNT(*) AS cnt FROM profiles WHERE LOWER(status) = 'banned'",
            "dau": "SELECT COUNT(DISTINCT user_id) AS cnt FROM auth_sessions WHERE last_seen_at >= UTC_TIMESTAMP() - INTERVAL 1 DAY",
            "wau": "SELECT COUNT(DISTINCT user_id) AS cnt FROM auth_sessions WHERE last_seen_at >= UTC_TIMESTAMP() - INTERVAL 7 DAY",
            "mau": "SELECT COUNT(DISTINCT user_id) AS cnt FROM auth_sessions WHERE last_seen_at >= UTC_TIMESTAMP() - INTERVAL 30 DAY",
            "deletion_feedback_30d": "SELECT COUNT(*) AS cnt FROM app_entities WHERE entity_type = 'deletion_feedback' AND created_at >= UTC_TIMESTAMP() - INTERVAL 30 DAY",
            "partner_accounts": "SELECT COUNT(*) AS cnt FROM profiles WHERE role = 'PARTNER'",
            "pending_verifications": "SELECT COUNT(*) AS cnt FROM app_entities WHERE entity_type = 'verification' AND status = 'PENDING'",
            "unanswered_support": "SELECT COUNT(DISTINCT c.id) AS cnt FROM conversations c JOIN profiles a ON a.id = c.profile_a_id JOIN profiles b ON b.id = c.profile_b_id WHERE (a.role = 'SUPPORT' OR b.role = 'SUPPORT') AND EXISTS (SELECT 1 FROM conversation_messages um WHERE um.conversation_id = c.id AND um.sender_profile_id <> CASE WHEN a.role = 'SUPPORT' THEN a.id ELSE b.id END AND um.read_at IS NULL AND um.status = 'ACTIVE')",
            "pending_photo_moderation": "SELECT COUNT(*) AS cnt FROM app_entities WHERE entity_type = 'moderation_photo' AND status = 'PENDING'",
            "pending_reports": "SELECT COUNT(*) AS cnt FROM app_entities WHERE entity_type = 'moderation_report' AND status = 'PENDING'",
            "active_subscriptions": "SELECT COUNT(*) AS cnt FROM app_entities WHERE entity_type = 'subscription' AND status = 'ACTIVE'",
            "manual_subscriptions": "SELECT COUNT(*) AS cnt FROM app_entities WHERE entity_type = 'subscription' AND status = 'ACTIVE' AND UPPER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.source')), '')) IN ('MANUAL', 'MANUAL_REVIEW')",
            "manual_subscriptions_30d": "SELECT COUNT(*) AS cnt FROM app_entities WHERE entity_type = 'subscription' AND UPPER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.source')), '')) IN ('MANUAL', 'MANUAL_REVIEW') AND created_at >= UTC_TIMESTAMP() - INTERVAL 30 DAY",
            "app_store_subscriptions": "SELECT COUNT(*) AS cnt FROM app_entities WHERE entity_type = 'subscription' AND status = 'ACTIVE' AND UPPER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.source')), '')) IN ('APP_STORE', 'APP STORE', 'IOS')",
            "play_store_subscriptions": "SELECT COUNT(*) AS cnt FROM app_entities WHERE entity_type = 'subscription' AND status = 'ACTIVE' AND UPPER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.source')), '')) IN ('PLAY_STORE', 'PLAY STORE', 'ANDROID')",
        }
        for name, query in scalar_queries.items():
            counts[name] = scalar(name, query)

        def daily_series(name: str, table: str, where: str = "") -> list[dict[str, Any]]:
            try:
                cursor.execute(
                    f"""
                    SELECT CAST(DATE(created_at) AS CHAR) AS day, COUNT(*) AS cnt
                    FROM `{table}`
                    WHERE created_at >= CURRENT_DATE - INTERVAL '400 days'
                    {where}
                    GROUP BY CAST(DATE(created_at) AS CHAR)
                    ORDER BY CAST(DATE(created_at) AS CHAR) ASC
                    """
                )
                return [
                    {"date": row["day"], "count": int(row["cnt"] or 0)}
                    for row in cursor.fetchall()
                ]
            except psycopg.Error as error:
                logger.warning("Admin stats series %s failed: %s", name, error)
                warnings.append(name)
                return []

        registrations_daily = daily_series("registrations_daily", "profiles")
        deletions_daily = daily_series(
            "deletions_daily",
            "app_entities",
            "AND entity_type = 'deletion_feedback'",
        )
        try:
            cursor.execute(
                """
                SELECT COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(data, '$.reason')), ''), 'OTHER') AS reason,
                       SUM(COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$.count')) AS UNSIGNED), 0)) AS cnt
                FROM app_entities
                WHERE entity_type = 'deletion_feedback'
                GROUP BY COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(data, '$.reason')), ''), 'OTHER')
                ORDER BY cnt DESC, reason ASC
                LIMIT 5
                """
            )
            deletion_reasons = [
                {"reason": str(row.get("reason") or "OTHER"), "count": int(row.get("cnt") or 0)}
                for row in cursor.fetchall()
            ]
            deletion_total = sum(item["count"] for item in deletion_reasons)
        except psycopg.Error as error:
            logger.warning("Admin stats deletion reasons failed: %s", error)
            warnings.append("deletion_reasons")
            deletion_reasons = []
            deletion_total = 0

        try:
            profile_filter = "role = 'USER'"
            profile_type_value = "UPPER(REPLACE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.profileType')), ' ', '_'))"
            cursor.execute(
                f"""
                SELECT
                    COUNT(*) AS total_profiles,
                    SUM(CASE WHEN COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.profileType')), '') = '' THEN 1 ELSE 0 END) AS without_profile,
                    SUM(CASE WHEN COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.isVerified')), 'false') = 'true' OR NULLIF(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(data, '$.verifiedAt')), ''), 'null') IS NOT NULL THEN 1 ELSE 0 END) AS verified,
                    SUM(CASE WHEN status = 'ACTIVE'
                              AND {catalog_completion_sql()}
                              AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.visibleInCatalog')), JSON_UNQUOTE(JSON_EXTRACT(data, '$.isVisibleInCatalog')), 'true') <> 'false'
                             THEN 1 ELSE 0 END) AS visible,
                    AVG((
                      (CASE WHEN COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.profileType')), '') <> '' THEN 1 ELSE 0 END) +
                      (CASE WHEN COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.avatarUrl')), '') <> '' THEN 1 ELSE 0 END) +
                      (CASE WHEN COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.dateOfBirth')), '') <> '' THEN 1 ELSE 0 END) +
                      (CASE WHEN COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.country')), '') <> '' THEN 1 ELSE 0 END) +
                      (CASE WHEN COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.city')), '') <> '' THEN 1 ELSE 0 END) +
                      (CASE WHEN COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.about')), '') <> '' OR COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.bio')), '') <> '' THEN 1 ELSE 0 END) +
                      (CASE WHEN COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.lookingFor')), '[]') <> '[]' THEN 1 ELSE 0 END)
                    ) / 7) AS completeness
                FROM profiles
                WHERE {profile_filter}
                """
            )
            profile_summary = cursor.fetchone() or {}
            total_profiles = int(profile_summary.get("total_profiles") or 0)
            verified_profiles = int(profile_summary.get("verified") or 0)
            visible_profiles = int(profile_summary.get("visible") or 0)
            profile_dashboard.update({
                "totalProfiles": total_profiles,
                "withoutProfile": int(profile_summary.get("without_profile") or 0),
                "avgCompleteness": int(round(float(profile_summary.get("completeness") or 0) * 100)),
                "verified": verified_profiles,
                "unverified": max(0, total_profiles - verified_profiles),
                "visible": visible_profiles,
                "hidden": max(0, total_profiles - visible_profiles),
            })

            cursor.execute(
                """
                SELECT UPPER(status) AS status, COUNT(*) AS cnt
                FROM app_entities
                WHERE entity_type = 'verification'
                GROUP BY UPPER(status)
                """
            )
            verification_counts = {str(row.get("status") or "").upper(): int(row.get("cnt") or 0) for row in cursor.fetchall()}
            profile_dashboard["verifications"] = {
                "approved": verification_counts.get("APPROVED", 0),
                "pending": verification_counts.get("PENDING", 0),
                "declined": verification_counts.get("DECLINED", 0),
                "abandoned": verification_counts.get("ABANDONED", 0),
                "expired": verification_counts.get("EXPIRED", 0),
            }

            profile_type_labels = {
                "SINGLE_WOMAN": "Single Woman",
                "SINGLE_MAN": "Single Man",
                "LESBIAN_COUPLE": "Lesbian Couple",
                "HETERO_COUPLE": "Hetero Couple",
                "GAY_COUPLE": "Gay Couple",
            }
            placeholders = ", ".join(["%s"] * len(profile_type_labels))
            cursor.execute(
                f"""
                SELECT {profile_type_value} AS profile_type, COUNT(*) AS cnt
                FROM profiles
                WHERE {profile_filter} AND {profile_type_value} IN ({placeholders})
                GROUP BY {profile_type_value}
                """,
                tuple(profile_type_labels.keys()),
            )
            profile_type_counts = {str(row.get("profile_type") or ""): int(row.get("cnt") or 0) for row in cursor.fetchall()}
            profile_dashboard["profileTypes"] = [
                {"label": label, "count": profile_type_counts.get(key, 0)}
                for key, label in profile_type_labels.items()
            ]

            donor_conditions = {
                "sperm": "(JSON_CONTAINS(JSON_EXTRACT(data, '$.donorType'), JSON_QUOTE('SPERM')) = 1 OR JSON_CONTAINS(JSON_EXTRACT(data, '$.donorType'), JSON_QUOTE('SPERM_DONOR')) = 1)",
                "egg": "(JSON_CONTAINS(JSON_EXTRACT(data, '$.donorType'), JSON_QUOTE('EGG')) = 1 OR JSON_CONTAINS(JSON_EXTRACT(data, '$.donorType'), JSON_QUOTE('EGG_DONOR')) = 1)",
            }
            cursor.execute(
                f"""
                SELECT
                    SUM(CASE WHEN {donor_conditions['sperm']} THEN 1 ELSE 0 END) AS sperm,
                    SUM(CASE WHEN {donor_conditions['egg']} THEN 1 ELSE 0 END) AS egg,
                    SUM(CASE WHEN {donor_conditions['sperm']} OR {donor_conditions['egg']} THEN 1 ELSE 0 END) AS total
                FROM profiles
                WHERE {profile_filter}
                """
            )
            donor_counts = cursor.fetchone() or {}
            sperm_donors = int(donor_counts.get("sperm") or 0)
            egg_donors = int(donor_counts.get("egg") or 0)
            total_donors = int(donor_counts.get("total") or 0)
            profile_dashboard.update({
                "totalDonors": total_donors,
                "spermDonors": sperm_donors,
                "eggDonors": egg_donors,
                "spermDonorPercent": round(sperm_donors / total_donors * 100, 1) if total_donors else 0,
                "eggDonorPercent": round(egg_donors / total_donors * 100, 1) if total_donors else 0,
            })

            looking_labels = {
                "SPERM_DONOR": "Sperm Donor",
                "CO_PARENTING_PARTNER": "Co-Parenting Partner",
                "EGG_DONOR": "Egg Donor",
            }
            looking_selects = ",\n".join(
                f"SUM(CASE WHEN JSON_CONTAINS(JSON_EXTRACT(data, '$.lookingFor'), JSON_QUOTE('{key}')) = 1 THEN 1 ELSE 0 END) AS `{key}`"
                for key in looking_labels
            )
            looking_any = " OR ".join(
                f"JSON_CONTAINS(JSON_EXTRACT(data, '$.lookingFor'), JSON_QUOTE('{key}')) = 1"
                for key in looking_labels
            )
            cursor.execute(
                f"""
                SELECT {looking_selects},
                    SUM(CASE WHEN {looking_any} THEN 1 ELSE 0 END) AS total
                FROM profiles
                WHERE {profile_filter}
                """
            )
            looking_counts = cursor.fetchone() or {}
            profile_dashboard["lookingFor"] = [
                {"label": label, "count": int(looking_counts.get(key) or 0)}
                for key, label in looking_labels.items()
            ]
        except psycopg.Error as error:
            logger.warning("Admin profile dashboard stats failed: %s", error)
            warnings.append("profile_dashboard")

        try:
            engagement_dashboard.update({
                "totalLikes": scalar("engagement_total_likes", "SELECT COUNT(*) AS cnt FROM profile_likes WHERE status = 'ACTIVE'"),
                "likesToday": scalar("engagement_likes_today", "SELECT COUNT(*) AS cnt FROM profile_likes WHERE status = 'ACTIVE' AND created_at >= UTC_DATE()"),
                "totalMatches": scalar("engagement_total_matches", "SELECT COUNT(*) AS cnt FROM profile_matches"),
                "matchesToday": scalar("engagement_matches_today", "SELECT COUNT(*) AS cnt FROM profile_matches WHERE created_at >= UTC_DATE()"),
                "activeMatches": scalar("engagement_active_matches", "SELECT COUNT(*) AS cnt FROM profile_matches WHERE status = 'ACTIVE'"),
                "pendingPhotos": scalar("engagement_pending_photos", "SELECT COUNT(*) AS cnt FROM app_entities WHERE entity_type = 'moderation_photo' AND status = 'PENDING'"),
                "pendingReports": scalar("engagement_pending_reports", "SELECT COUNT(*) AS cnt FROM app_entities WHERE entity_type = 'moderation_report' AND status = 'PENDING'"),
            })
            cursor.execute(
                """
                SELECT COUNT(DISTINCT p.id) AS matched_profiles
                FROM profiles p
                JOIN profile_matches m ON m.profile_a_id = p.id OR m.profile_b_id = p.id
                WHERE p.role = 'USER'
                """
            )
            matched_profiles = int((cursor.fetchone() or {}).get("matched_profiles") or 0)
            engagement_dashboard["matchRate"] = round(matched_profiles / max(1, int(profile_dashboard["totalProfiles"])) * 100)
            cursor.execute(
                """
                SELECT CAST(day AS CHAR) AS day, SUM(likes) AS likes, SUM(matches) AS matches, SUM(messages) AS messages
                FROM (
                    SELECT DATE(created_at) AS day, COUNT(*) AS likes, 0 AS matches, 0 AS messages
                    FROM profile_likes WHERE created_at >= CURRENT_DATE - INTERVAL '90 days' GROUP BY DATE(created_at)
                    UNION ALL
                    SELECT DATE(created_at) AS day, 0 AS likes, COUNT(*) AS matches, 0 AS messages
                    FROM profile_matches WHERE created_at >= CURRENT_DATE - INTERVAL '90 days' GROUP BY DATE(created_at)
                    UNION ALL
                    SELECT DATE(created_at) AS day, 0 AS likes, 0 AS matches, COUNT(*) AS messages
                    FROM conversation_messages WHERE created_at >= CURRENT_DATE - INTERVAL '90 days' GROUP BY DATE(created_at)
                ) AS engagement_days
                GROUP BY day ORDER BY day ASC
                """
            )
            engagement_dashboard["daily"] = [
                {"date": str(row.get("day") or ""), "likes": int(row.get("likes") or 0), "matches": int(row.get("matches") or 0), "messages": int(row.get("messages") or 0)}
                for row in cursor.fetchall()
            ]
            flow_labels = ["S.Woman", "S.Woman+D", "S.Man", "S.Man+D", "Hetero", "Hetero+D", "Lesbian", "Lesbian+D", "Gay", "Gay+D"]
            profile_flow_category = """
                CONCAT(
                  CASE UPPER(REPLACE(JSON_UNQUOTE(JSON_EXTRACT({alias}.data, '$.profileType')), ' ', '_'))
                    WHEN 'SINGLE_WOMAN' THEN 'S.Woman'
                    WHEN 'SINGLE_MAN' THEN 'S.Man'
                    WHEN 'HETERO_COUPLE' THEN 'Hetero'
                    WHEN 'LESBIAN_COUPLE' THEN 'Lesbian'
                    WHEN 'GAY_COUPLE' THEN 'Gay'
                    ELSE 'Unknown'
                  END,
                  CASE WHEN COALESCE(JSON_LENGTH(JSON_EXTRACT({alias}.data, '$.donorType')), 0) > 0 THEN '+D' ELSE '' END
                )
            """
            like_flow_by_range: dict[str, dict[str, Any]] = {}
            for flow_days in (7, 30, 90):
                cursor.execute(
                    f"""
                    SELECT {profile_flow_category.format(alias='sender')} AS sender_type,
                           {profile_flow_category.format(alias='receiver')} AS receiver_type,
                           COUNT(*) AS cnt
                    FROM profile_likes likes
                    JOIN profiles sender ON sender.id = likes.actor_profile_id
                    JOIN profiles receiver ON receiver.id = likes.target_profile_id
                    WHERE likes.status = 'ACTIVE' AND likes.created_at >= UTC_TIMESTAMP() - INTERVAL {flow_days} DAY
                    GROUP BY sender_type, receiver_type
                    """
                )
                flow_counts = {(str(row.get("sender_type") or ""), str(row.get("receiver_type") or "")): int(row.get("cnt") or 0) for row in cursor.fetchall()}
                like_flow_by_range[str(flow_days)] = {
                    "headers": flow_labels,
                    "rows": [{"label": sender, "values": [flow_counts.get((sender, receiver), 0) for receiver in flow_labels]} for sender in flow_labels],
                    "total": sum(flow_counts.values()),
                }
            engagement_dashboard["likeFlowByRange"] = like_flow_by_range
            engagement_dashboard["likeFlow"] = like_flow_by_range["30"]
        except psycopg.Error as error:
            logger.warning("Admin engagement dashboard stats failed: %s", error)
            warnings.append("engagement_dashboard")

        try:
            subscriptions_dashboard["active"] = scalar("dashboard_active_subscriptions", "SELECT COUNT(*) AS cnt FROM app_entities WHERE entity_type = 'subscription' AND status = 'ACTIVE'")
            subscriptions_dashboard["premiumUsers"] = scalar("dashboard_premium_users", "SELECT COUNT(*) AS cnt FROM profiles WHERE role = 'USER' AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.isPremium')), 'false') = 'true'")
            subscriptions_dashboard["conversionRate"] = round(subscriptions_dashboard["premiumUsers"] / max(1, int(profile_dashboard["totalProfiles"])) * 100, 1)
            cursor.execute(
                """
                SELECT COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(data, '$.plan')), ''), 'Premium Monthly') AS plan, COUNT(*) AS cnt
                FROM app_entities
                WHERE entity_type = 'subscription' AND status = 'ACTIVE'
                GROUP BY COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(data, '$.plan')), ''), 'Premium Monthly')
                ORDER BY cnt DESC, plan ASC
                """
            )
            subscriptions_dashboard["plans"] = [{"label": str(row.get("plan") or "Premium Monthly").replace("_", " ").title(), "count": int(row.get("cnt") or 0)} for row in cursor.fetchall()]
        except psycopg.Error as error:
            logger.warning("Admin subscriptions dashboard stats failed: %s", error)
            warnings.append("subscriptions_dashboard")

        try:
            partners_dashboard.update({
                "totalPartners": scalar("dashboard_total_partners", "SELECT COUNT(*) AS cnt FROM profiles WHERE role = 'PARTNER'"),
                "verifiedPartners": scalar("dashboard_verified_partners", "SELECT COUNT(*) AS cnt FROM profiles WHERE role = 'PARTNER' AND (COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.isVerified')), 'false') = 'true' OR NULLIF(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(data, '$.verifiedAt')), ''), 'null') IS NOT NULL)"),
                "clinics": scalar("dashboard_clinics", "SELECT COUNT(*) AS cnt FROM clinics"),
                "activeClinics": scalar("dashboard_active_clinics", "SELECT COUNT(*) AS cnt FROM clinics WHERE LOWER(status) = 'active'"),
                "lawyers": scalar("dashboard_lawyers", "SELECT COUNT(*) AS cnt FROM lawyers"),
                "activeLawyers": scalar("dashboard_active_lawyers", "SELECT COUNT(*) AS cnt FROM lawyers WHERE LOWER(status) = 'active'"),
                "newPartners7d": scalar("dashboard_partners_7d", "SELECT COUNT(*) AS cnt FROM profiles WHERE role = 'PARTNER' AND created_at >= UTC_TIMESTAMP() - INTERVAL 7 DAY"),
                "newPartners30d": scalar("dashboard_partners_30d", "SELECT COUNT(*) AS cnt FROM profiles WHERE role = 'PARTNER' AND created_at >= UTC_TIMESTAMP() - INTERVAL 30 DAY"),
            })
        except psycopg.Error as error:
            logger.warning("Admin partners dashboard stats failed: %s", error)
            warnings.append("partners_dashboard")

        try:
            cursor.execute(
                """
                SELECT NULLIF(JSON_UNQUOTE(JSON_EXTRACT(data, '$.country')), '') AS label, COUNT(*) AS cnt
                FROM profiles
                WHERE role = 'USER' AND NULLIF(JSON_UNQUOTE(JSON_EXTRACT(data, '$.country')), '') IS NOT NULL
                GROUP BY NULLIF(JSON_UNQUOTE(JSON_EXTRACT(data, '$.country')), '')
                ORDER BY cnt DESC, label ASC LIMIT 5
                """
            )
            devices_dashboard["countries"] = [{"label": str(row.get("label") or "Unknown"), "count": int(row.get("cnt") or 0)} for row in cursor.fetchall()]

            cursor.execute(
                """
                SELECT id,
                    COALESCE(
                        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(data, '$.registrationSource')), ''),
                        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(data, '$.source')), ''),
                        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(data, '$.platform')), ''),
                        'Unknown'
                    ) AS registration_source,
                    COALESCE(
                        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(data, '$.browser')), ''),
                        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(data, '$.browserName')), ''),
                        'Unknown'
                    ) AS browser,
                    COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.isPremium')), 'false') = 'true' AS is_premium,
                    (
                        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.isVerified')), 'false') = 'true'
                        OR NULLIF(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(data, '$.verifiedAt')), ''), 'null') IS NOT NULL
                    ) AS is_verified
                FROM profiles
                WHERE role = 'USER'
                """
            )
            profile_telemetry = cursor.fetchall()

            def platform_for_source(value: Any) -> str:
                source = str(value or "").upper().replace("-", "_").replace(" ", "_")
                if any(token in source for token in ("IOS", "IPHONE", "IPAD", "APP_STORE", "APPLE")):
                    return "iOS"
                if any(token in source for token in ("ANDROID", "PLAY_STORE", "GOOGLE_PLAY")):
                    return "Android"
                if source in {"WEB", "WEB_APP", "LOCAL_SIGNUP", "FIREBASE_AUTH", "BROWSER"}:
                    return "Web"
                return "Unknown"

            platform_names = ("iOS", "Android", "Web", "Unknown")
            platform_stats: dict[str, dict[str, Any]] = {
                name: {"users": 0, "premium": 0, "verified": 0, "profile_ids": []}
                for name in platform_names
            }
            browser_counts: dict[str, int] = {}
            for profile in profile_telemetry:
                platform = platform_for_source(profile.get("registration_source"))
                stats = platform_stats[platform]
                stats["users"] += 1
                stats["premium"] += int(bool(profile.get("is_premium")))
                stats["verified"] += int(bool(profile.get("is_verified")))
                stats["profile_ids"].append(int(profile["id"]))
                browser = str(profile.get("browser") or "Unknown").strip() or "Unknown"
                browser_counts[browser] = browser_counts.get(browser, 0) + 1

            device_counts = {
                "mobile": platform_stats["iOS"]["users"] + platform_stats["Android"]["users"],
                "desktop": platform_stats["Web"]["users"],
                "unknown": platform_stats["Unknown"]["users"],
            }
            devices_dashboard["devices"] = [
                {"label": label, "count": count}
                for label, count in device_counts.items()
                if count > 0
            ]
            devices_dashboard["browsers"] = [
                {"label": label, "count": count}
                for label, count in sorted(browser_counts.items(), key=lambda item: (-item[1], item[0]))[:5]
            ]
            devices_dashboard["platforms"] = {
                name: int(platform_stats[name]["users"])
                for name in platform_names
            }

            cursor.execute("SELECT actor_profile_id AS profile_id, COUNT(*) AS cnt FROM profile_likes GROUP BY actor_profile_id")
            likes_by_profile = {int(row["profile_id"]): int(row.get("cnt") or 0) for row in cursor.fetchall()}
            cursor.execute("SELECT sender_profile_id AS profile_id, COUNT(*) AS cnt FROM conversation_messages GROUP BY sender_profile_id")
            messages_by_profile = {int(row["profile_id"]): int(row.get("cnt") or 0) for row in cursor.fetchall()}

            def median(values: list[int]) -> float:
                if not values:
                    return 0
                ordered = sorted(values)
                midpoint = len(ordered) // 2
                if len(ordered) % 2:
                    return float(ordered[midpoint])
                return (ordered[midpoint - 1] + ordered[midpoint]) / 2

            comparison = []
            for platform in platform_names:
                stats = platform_stats[platform]
                users = int(stats["users"])
                profile_ids = stats["profile_ids"]
                likes = [likes_by_profile.get(profile_id, 0) for profile_id in profile_ids]
                messages = [messages_by_profile.get(profile_id, 0) for profile_id in profile_ids]
                comparison.append({
                    "platform": platform,
                    "users": users,
                    "deleted30d": 0,
                    "premium": round(int(stats["premium"]) / users * 100, 1) if users else 0,
                    "verified": round(int(stats["verified"]) / users * 100, 1) if users else 0,
                    "likesAvg": round(sum(likes) / users, 1) if users else 0,
                    "likesMedian": median(likes),
                    "messagesAvg": round(sum(messages) / users, 1) if users else 0,
                    "messagesMedian": median(messages),
                })
            devices_dashboard["comparison"] = comparison
        except psycopg.Error as error:
            logger.warning("Admin devices dashboard stats failed: %s", error)
            warnings.append("devices_dashboard")

        try:
            cursor.execute(
                """
                SELECT TO_CHAR(date_trunc('week', created_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS week_start,
                    COUNT(*) AS registered,
                    SUM(CASE WHEN COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.isWizardCompleted')), 'false') = 'true' THEN 1 ELSE 0 END) AS wizard_done,
                    SUM(CASE WHEN COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.isVerified')), 'false') = 'true' OR NULLIF(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(data, '$.verifiedAt')), ''), 'null') IS NOT NULL THEN 1 ELSE 0 END) AS verified,
                    SUM(CASE WHEN EXISTS (SELECT 1 FROM profile_likes l WHERE l.actor_profile_id = profiles.id) THEN 1 ELSE 0 END) AS has_like,
                    SUM(CASE WHEN EXISTS (SELECT 1 FROM profile_matches m WHERE m.profile_a_id = profiles.id OR m.profile_b_id = profiles.id) THEN 1 ELSE 0 END) AS has_match,
                    SUM(CASE WHEN EXISTS (SELECT 1 FROM conversation_messages cm WHERE cm.sender_profile_id = profiles.id) THEN 1 ELSE 0 END) AS has_message
                FROM profiles
                WHERE role = 'USER' AND created_at >= CURRENT_DATE - INTERVAL '8 weeks'
                GROUP BY TO_CHAR(date_trunc('week', created_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD')
                ORDER BY week_start ASC
                """
            )
            funnel_dashboard["rows"] = [
                {"week": str(row.get("week_start") or ""), "registered": int(row.get("registered") or 0), "wizard": int(row.get("wizard_done") or 0), "verified": int(row.get("verified") or 0), "likes": int(row.get("has_like") or 0), "matches": int(row.get("has_match") or 0), "messages": int(row.get("has_message") or 0)}
                for row in cursor.fetchall()
            ]
        except psycopg.Error as error:
            logger.warning("Admin funnel dashboard stats failed: %s", error)
            warnings.append("funnel_dashboard")
    return {
        "counts": counts,
        "entityCounts": entity_counts,
        "series": {
            "registrationsDaily": registrations_daily,
            "deletionsDaily": deletions_daily,
        },
        "dashboard": {
            "quickQuit": {"quick": 0, "total": deletion_total, "pct": 0},
            "deletionReasons": deletion_reasons,
            "profiles": profile_dashboard,
            "engagement": engagement_dashboard,
            "subscriptions": subscriptions_dashboard,
            "partners": partners_dashboard,
            "devices": devices_dashboard,
            "funnel": funnel_dashboard,
        },
        "warnings": warnings,
    }


@app.get("/api/admin/operations")
def admin_operations(_admin: str = Depends(require_admin)):
    with db_cursor() as (_, cursor):
        cursor.execute("SELECT 1 AS ok")
        database_ok = bool(cursor.fetchone()["ok"])
    storage_root = UPLOAD_DIR if UPLOAD_DIR.exists() else UPLOAD_DIR.parent
    quarantine_root = PRIVATE_UPLOAD_DIR if PRIVATE_UPLOAD_DIR.exists() else PRIVATE_UPLOAD_DIR.parent
    storage = shutil.disk_usage(storage_root)
    quarantine = shutil.disk_usage(quarantine_root)
    return {
        "database": "ok" if database_ok else "error",
        "time": now_utc().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "storage": {
            "uploadsPath": str(storage_root),
            "uploadsFree": storage.free,
            "uploadsTotal": storage.total,
            "quarantinePath": str(quarantine_root),
            "quarantineFree": quarantine.free,
            "quarantineTotal": quarantine.total,
        },
        "integrations": {
            "firebaseProject": FIREBASE_PROJECT_ID or None,
            "visionConfigured": vision_is_configured(),
            "diditConfigured": didit_is_configured(),
            "emailConfigured": bool(SMTP_HOST and SMTP_FROM_EMAIL),
        },
    }


@app.get("/api/admin/profiles")
def admin_profiles(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    q: str | None = Query(None, min_length=1, max_length=200),
    _admin: str = Depends(require_admin),
):
    params: list[Any] = []
    where = ""
    if q:
        where = "WHERE display_name LIKE %s OR email LIKE %s OR JSON_UNQUOTE(JSON_EXTRACT(data, '$.id')) LIKE %s"
        like = f"%{q}%"
        params.extend([like, like, like])
    params.extend([limit, offset])
    with db_cursor() as (_, cursor):
        cursor.execute(
            f"""
            SELECT id, role, display_name, email, status, created_at, updated_at, data
            FROM profiles
            {where}
            ORDER BY id ASC
            LIMIT %s OFFSET %s
            """,
            params,
        )
        items = [normalize_row(row) for row in cursor.fetchall()]
    return {"items": items, "limit": limit, "offset": offset}


def recompute_profile_premium(cursor, profile_id: int) -> bool:
    cursor.execute(
        """
        SELECT COUNT(*) AS cnt
        FROM app_entities
        WHERE entity_type = 'subscription'
          AND status = 'ACTIVE'
          AND CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$.profileId')) AS CHAR) = CAST(%s AS CHAR)
          AND (
            JSON_UNQUOTE(JSON_EXTRACT(data, '$.expiresAt')) IS NULL
            OR JSON_UNQUOTE(JSON_EXTRACT(data, '$.expiresAt')) = ''
            OR JSON_UNQUOTE(JSON_EXTRACT(data, '$.expiresAt')) > TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
          )
        """,
        (profile_id,),
    )
    is_premium = int(cursor.fetchone()["cnt"] or 0) > 0
    cursor.execute(
            "UPDATE profiles SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{isPremium}', to_jsonb(%s::boolean), true), updated_at = UTC_TIMESTAMP() WHERE id = %s",
        (1 if is_premium else 0, profile_id),
    )
    return is_premium


def admin_detail_person(row: dict[str, Any] | None) -> dict[str, Any] | None:
    """Small, stable profile projection used by the admin detail tabs."""
    if not row:
        return None
    data = as_dict(row.get("profile_data") if "profile_data" in row else row.get("data"))
    return {
        "id": row.get("profile_id", row.get("id")),
        "displayName": row.get("display_name") or data.get("displayName") or "No profile",
        "email": row.get("email") or data.get("email") or "",
        "status": row.get("profile_status", row.get("status")) or "",
        "profileType": data.get("profileType") or data.get("userType") or "",
        "country": data.get("country") or "",
        "city": data.get("city") or "",
        "avatarUrl": data.get("avatarUrl") or "",
    }


def admin_profile_device_history(profile: dict[str, Any], session_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return only persisted device records and profile snapshots, never placeholders."""
    data = as_dict(profile.get("data"))
    devices: list[dict[str, Any]] = []
    seen: set[str] = set()
    for key, label, fallback_date in (
        ("registrationDevice", "Registration device", profile.get("created_at")),
        ("lastSessionDevice", "Last session device", profile.get("updated_at")),
        ("device", "Saved device", profile.get("created_at")),
        ("lastDevice", "Last known device", profile.get("updated_at")),
    ):
        item = as_dict(data.get(key))
        if not item:
            continue
        fingerprint = json.dumps(item, sort_keys=True, default=str)
        if fingerprint in seen:
            continue
        seen.add(fingerprint)
        devices.append({"kind": label, "created_at": item.get("date") or item.get("createdAt") or fallback_date, "data": item})
    for row in session_rows:
        item = as_dict(row.get("data"))
        if item:
            devices.append({"kind": "Sign-in session", "created_at": item.get("signedInAt") or row.get("created_at"), "data": item})
    return devices


def admin_detail_rows(cursor, query: str, params: tuple[Any, ...]) -> list[dict[str, Any]]:
    cursor.execute(query, params)
    return [normalize_row(row) for row in cursor.fetchall()]


@app.get("/api/admin/users/{profile_id}/overview")
def admin_user_overview(profile_id: str, _admin: str = Depends(require_admin)):
    """One complete, internally consistent data source for the admin profile tabs."""
    with db_cursor() as (_, cursor):
        profile_id = resolve_admin_profile_id(cursor, profile_id)
        cursor.execute(
            "SELECT id, role, display_name, email, status, created_at, updated_at, data FROM profiles WHERE id = %s LIMIT 1",
            (profile_id,),
        )
        profile = cursor.fetchone()
        if not profile:
            raise HTTPException(status_code=404, detail="User not found")
        profile_data = as_dict(profile.get("data"))
        source_user_id = str(profile_data.get("userId") or profile_data.get("id") or "")
        profile_ref = str(profile_id)

        cursor.execute(
            "SELECT id, public_url, position, status, moderation_status, created_at, updated_at FROM profile_photos WHERE profile_id = %s ORDER BY position ASC, id ASC",
            (profile_id,),
        )
        photos = [normalize_row(row) for row in cursor.fetchall()]

        verification_rows = admin_detail_rows(
            cursor,
            """
            SELECT id, entity_type, title, status, source_key, data, created_at, updated_at
            FROM app_entities
            WHERE entity_type = 'verification'
              AND (data->>'profileId' = %s OR data->>'profileLocalId' = %s OR data->'user'->>'id' = %s)
            ORDER BY created_at DESC, id DESC
            """,
            (profile_ref, profile_ref, source_user_id),
        )

        sent_likes = admin_detail_rows(
            cursor,
            """
            SELECT l.id, l.status, l.created_at, l.updated_at,
                   p.id AS profile_id, p.display_name, p.email, p.status AS profile_status, p.data AS profile_data
            FROM profile_likes l JOIN profiles p ON p.id = l.target_profile_id
            WHERE l.actor_profile_id = %s
            ORDER BY l.created_at DESC, l.id DESC
            """,
            (profile_id,),
        )
        received_likes = admin_detail_rows(
            cursor,
            """
            SELECT l.id, l.status, l.created_at, l.updated_at,
                   p.id AS profile_id, p.display_name, p.email, p.status AS profile_status, p.data AS profile_data
            FROM profile_likes l JOIN profiles p ON p.id = l.actor_profile_id
            WHERE l.target_profile_id = %s
            ORDER BY l.created_at DESC, l.id DESC
            """,
            (profile_id,),
        )
        matches = admin_detail_rows(
            cursor,
            """
            SELECT m.id, m.status, m.created_at, m.updated_at,
                   p.id AS profile_id, p.display_name, p.email, p.status AS profile_status, p.data AS profile_data
            FROM profile_matches m
            JOIN profiles p ON p.id = CASE WHEN m.profile_a_id = %s THEN m.profile_b_id ELSE m.profile_a_id END
            WHERE m.profile_a_id = %s OR m.profile_b_id = %s
            ORDER BY m.updated_at DESC, m.id DESC
            """,
            (profile_id, profile_id, profile_id),
        )
        blocked = admin_detail_rows(
            cursor,
            """
            SELECT b.id, b.status, b.reason, b.created_at, b.updated_at,
                   p.id AS profile_id, p.display_name, p.email, p.status AS profile_status, p.data AS profile_data
            FROM profile_blocks b JOIN profiles p ON p.id = b.blocked_profile_id
            WHERE b.blocker_profile_id = %s
            ORDER BY b.created_at DESC, b.id DESC
            """,
            (profile_id,),
        )
        blocked_by = admin_detail_rows(
            cursor,
            """
            SELECT b.id, b.status, b.reason, b.created_at, b.updated_at,
                   p.id AS profile_id, p.display_name, p.email, p.status AS profile_status, p.data AS profile_data
            FROM profile_blocks b JOIN profiles p ON p.id = b.blocker_profile_id
            WHERE b.blocked_profile_id = %s
            ORDER BY b.created_at DESC, b.id DESC
            """,
            (profile_id,),
        )

        conversations = admin_detail_rows(
            cursor,
            """
            SELECT c.id, c.status, c.created_at, c.updated_at,
                   p.id AS profile_id, p.display_name, p.email, p.status AS profile_status, p.data AS profile_data,
                   COUNT(cm.id) AS message_count, MAX(cm.created_at) AS last_message_at
            FROM conversations c
            JOIN profiles p ON p.id = CASE WHEN c.profile_a_id = %s THEN c.profile_b_id ELSE c.profile_a_id END
            LEFT JOIN conversation_messages cm ON cm.conversation_id = c.id
            WHERE (c.profile_a_id = %s OR c.profile_b_id = %s) AND p.role <> 'SUPPORT'
            GROUP BY c.id, c.status, c.created_at, c.updated_at, p.id, p.display_name, p.email, p.status, p.data
            ORDER BY MAX(cm.created_at) DESC NULLS LAST, c.updated_at DESC, c.id DESC
            """,
            (profile_id, profile_id, profile_id),
        )
        messages = admin_detail_rows(
            cursor,
            """
            SELECT cm.id, cm.conversation_id, cm.sender_profile_id, cm.body, cm.media_url, cm.status,
                   cm.read_at, cm.delivered_at, cm.created_at,
                   s.display_name AS sender_name, s.email AS sender_email,
                   p.id AS profile_id, p.display_name, p.email, p.status AS profile_status, p.data AS profile_data
            FROM conversation_messages cm
            JOIN conversations c ON c.id = cm.conversation_id
            LEFT JOIN profiles s ON s.id = cm.sender_profile_id
            JOIN profiles p ON p.id = CASE WHEN c.profile_a_id = %s THEN c.profile_b_id ELSE c.profile_a_id END
            WHERE (c.profile_a_id = %s OR c.profile_b_id = %s) AND p.role <> 'SUPPORT'
            ORDER BY cm.created_at DESC, cm.id DESC
            """,
            (profile_id, profile_id, profile_id),
        )
        support_messages = admin_detail_rows(
            cursor,
            """
            SELECT cm.id, cm.conversation_id, cm.sender_profile_id, cm.body, cm.media_url, cm.status,
                   cm.read_at, cm.delivered_at, cm.created_at,
                   s.display_name AS sender_name, s.email AS sender_email, s.role AS sender_role
            FROM conversation_messages cm
            JOIN conversations c ON c.id = cm.conversation_id
            JOIN profiles peer ON peer.id = CASE WHEN c.profile_a_id = %s THEN c.profile_b_id ELSE c.profile_a_id END
            LEFT JOIN profiles s ON s.id = cm.sender_profile_id
            WHERE (c.profile_a_id = %s OR c.profile_b_id = %s) AND peer.role = 'SUPPORT'
            ORDER BY cm.created_at DESC, cm.id DESC
            """,
            (profile_id, profile_id, profile_id),
        )

        subscriptions = admin_detail_rows(
            cursor,
            """
            SELECT id, entity_type, title, status, source_key, data, created_at, updated_at
            FROM app_entities
            WHERE entity_type = 'subscription'
              AND (data->>'profileId' = %s OR data->>'profileLocalId' = %s OR data->'user'->>'id' = %s)
            ORDER BY created_at DESC, id DESC
            """,
            (profile_ref, profile_ref, source_user_id),
        )
        subscription_ids = {str(as_dict(row.get("data")).get("id") or row.get("source_key") or "") for row in subscriptions}
        subscription_ids.discard("")
        subscription_events: list[dict[str, Any]] = []
        if subscription_ids:
            cursor.execute("SELECT id, entity_type, title, status, source_key, data, created_at, updated_at FROM app_entities WHERE entity_type = 'subscription_event' ORDER BY created_at DESC, id DESC")
            for row in cursor.fetchall():
                normalized = normalize_row(row)
                if str(as_dict(normalized.get("data")).get("subscriptionId") or "") in subscription_ids:
                    subscription_events.append(normalized)
        subscriptions.extend(subscription_events)

        liked_clinics = admin_detail_rows(
            cursor,
            """
            SELECT e.id, e.status, e.created_at, e.updated_at, e.data, e.title,
                   c.id AS clinic_id, c.name AS clinic_name, c.country AS clinic_country, c.city AS clinic_city
            FROM app_entities e
            LEFT JOIN clinics c ON c.id::text = e.data->>'clinicLocalId'
            WHERE e.entity_type = 'favourite_clinic' AND e.data->>'profileLocalId' = %s
            ORDER BY e.updated_at DESC, e.id DESC
            """,
            (profile_ref,),
        )
        visitors = admin_detail_rows(
            cursor,
            """
            SELECT e.id, e.status, e.created_at, e.updated_at, e.data,
                   p.id AS profile_id, p.display_name, p.email, p.status AS profile_status, p.data AS profile_data
            FROM app_entities e
            LEFT JOIN profiles p ON (
                p.id::text = e.data->>'viewerProfileId'
                OR p.id::text = e.data->>'profileLocalId'
                OR p.data->>'userId' = e.data->>'viewerId'
            )
            WHERE e.entity_type = 'profile_view'
              AND (e.data->>'viewedProfileId' = %s OR e.data->>'viewedId' = %s)
            ORDER BY COALESCE(e.data->>'lastViewedAt', e.updated_at::text, e.created_at::text) DESC, e.id DESC
            """,
            (profile_ref, source_user_id),
        )
        device_sessions = admin_detail_rows(
            cursor,
            """
            SELECT id, data, created_at, updated_at
            FROM app_entities
            WHERE entity_type = 'device_session' AND data->>'profileId' = %s
            ORDER BY created_at DESC, id DESC
            """,
            (profile_ref,),
        )

        cursor.execute(
            """
            SELECT COUNT(*) AS cnt FROM app_entities
            WHERE entity_type = 'moderation_report'
              AND (data->>'targetProfileId' = %s OR data->>'reportedProfileId' = %s)
            """,
            (profile_ref, profile_ref),
        )
        reports = int(cursor.fetchone()["cnt"] or 0)

    for item in sent_likes + received_likes + matches + blocked + blocked_by + visitors:
        item["profile"] = admin_detail_person(item)
        item.pop("profile_data", None)
    for item in messages:
        item["profile"] = admin_detail_person(item)
        item.pop("profile_data", None)
    counts = {
        "photos": len(photos), "verifications": len(verification_rows), "sentLikes": len(sent_likes),
        "receivedLikes": len(received_likes), "matches": len(matches), "subscriptions": len(subscriptions),
        "likedClinics": len(liked_clinics), "visitors": len(visitors), "blocked": len(blocked),
        "blockedBy": len(blocked_by), "messages": len(messages), "supportMessages": len(support_messages),
        "conversations": len(conversations), "reports": reports,
    }
    return {
        "profile": normalize_row(profile), "counts": counts, "photos": photos,
        "devices": admin_profile_device_history(profile, device_sessions), "verifications": verification_rows,
        "supportMessages": support_messages, "conversations": conversations, "messages": messages,
        "sentLikes": sent_likes, "receivedLikes": received_likes, "matches": matches,
        "subscriptions": subscriptions, "likedClinics": liked_clinics, "visitors": visitors,
        "blocked": blocked, "blockedBy": blocked_by,
    }


@app.get("/api/admin/users/{profile_id}/tabs/{tab_name}")
def admin_user_tab(profile_id: str, tab_name: str, _admin: str = Depends(require_admin)):
    """Return the records for one profile detail tab with its matching count.

    The React admin loads profile metadata once and requests tab data independently,
    so changing a tab does not reload the surrounding profile page.
    """
    tab_keys = {
        "devices": "devices", "verification": "verifications", "support": "supportMessages",
        "messages": "messages", "photos": "photos", "sent-likes": "sentLikes",
        "received-likes": "receivedLikes", "matches": "matches", "subscriptions": "subscriptions",
        "clinics": "likedClinics", "visitors": "visitors", "blocked": "blocked",
        "blocked-by": "blockedBy",
    }
    data_key = tab_keys.get(tab_name)
    if not data_key:
        raise HTTPException(status_code=404, detail="Unknown user detail tab")
    overview = admin_user_overview(profile_id, _admin)
    items = overview.get(data_key, [])
    return {"items": items if isinstance(items, list) else [], "total": len(items) if isinstance(items, list) else 0}


@app.post("/api/admin/users/{profile_id}/amplitude")
def admin_open_user_in_amplitude(profile_id: str, actor: str = Depends(require_admin)):
    """Upsert a privacy-minimised user profile event and open Amplitude User Profiles.

    The ingestion key lives only in server configuration. Email, phone number,
    and message content are deliberately excluded from Amplitude properties.
    """
    if not AMPLITUDE_API_KEY:
        raise HTTPException(status_code=503, detail="Amplitude is not configured")
    with db_cursor() as (conn, cursor):
        profile_id = resolve_admin_profile_id(cursor, profile_id)
        cursor.execute(
            "SELECT id, role, display_name, status, data FROM profiles WHERE id = %s LIMIT 1",
            (profile_id,),
        )
        profile = cursor.fetchone()
        if not profile:
            raise HTTPException(status_code=404, detail="User not found")
        data = as_dict(profile.get("data"))
        user_properties = {
            "profile_id": str(profile["id"]),
            "profile_role": str(profile.get("role") or "USER"),
            "profile_type": str(data.get("profileType") or data.get("userType") or ""),
            "account_status": str(profile.get("status") or ""),
            "is_premium": bool(data.get("isPremium")),
            "is_verified": bool(data.get("isVerified") or data.get("verified")),
            "country": str(data.get("country") or ""),
        }
        event = {
            "user_id": str(profile["id"]),
            "event_type": "Admin Profile Opened",
            "time": int(now_utc().timestamp() * 1000),
            "event_properties": {"opened_by_admin": True},
            "user_properties": user_properties,
        }
        request = urllib.request.Request(
            "https://api2.amplitude.com/2/httpapi",
            data=json.dumps({"api_key": AMPLITUDE_API_KEY, "events": [event]}).encode("utf-8"),
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                if response.status < 200 or response.status >= 300:
                    raise HTTPException(status_code=502, detail="Amplitude rejected the profile event")
        except urllib.error.HTTPError as error:
            raise HTTPException(status_code=502, detail="Amplitude rejected the profile event") from error
        except (urllib.error.URLError, TimeoutError) as error:
            raise HTTPException(status_code=502, detail="Amplitude is unavailable") from error
        audit(conn, actor, "open_in_amplitude", "profiles", profile_id, {"amplitudeUserId": str(profile_id)})
        conn.commit()
    return {
        "ok": True,
        "userId": str(profile_id),
        "url": AMPLITUDE_USER_PROFILE_URL_TEMPLATE.replace("{user_id}", urllib.parse.quote(str(profile_id), safe="")),
    }


def fetch_admin_clinic(cursor, identifier: str | int) -> dict[str, Any]:
    raw = str(identifier).strip()
    lookup_parts = ["JSON_UNQUOTE(JSON_EXTRACT(data, '$.id')) = %s", "JSON_UNQUOTE(JSON_EXTRACT(data, '$.slug')) = %s"]
    lookup_params: list[Any] = [raw, raw]
    if raw.isdigit():
        lookup_parts.insert(0, "id = %s")
        lookup_params.insert(0, int(raw))
    cursor.execute(
        f"SELECT id, name, country, city, status, data, created_at, updated_at FROM clinics WHERE {' OR '.join(lookup_parts)} LIMIT 1",
        lookup_params,
    )
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Clinic not found")
    return row


def normalize_admin_clinic(row: dict[str, Any]) -> dict[str, Any]:
    clinic = normalize_partner_clinic(row)
    data = as_dict(row.get("data"))
    partner = data.get("partner") if isinstance(data.get("partner"), dict) else {}
    clinic["partnerName"] = data.get("partnerName") or partner.get("name") or partner.get("displayName") or "-"
    return clinic


@app.get("/api/admin/clinics/{clinic_identifier}/overview")
def admin_clinic_overview(clinic_identifier: str, _admin: str = Depends(require_admin)):
    with db_cursor() as (_, cursor):
        row = fetch_admin_clinic(cursor, clinic_identifier)
        clinic = normalize_admin_clinic(row)
        source_id = str(clinic.get("id") or "")
        cursor.execute(
            """
            SELECT e.id, e.created_at, e.updated_at, e.data,
                   p.id AS profileLocalId, p.display_name AS profileName, p.email AS profileEmail,
                   p.status AS profileStatus, p.data AS profileData
            FROM app_entities e
            LEFT JOIN profiles p ON p.id = CAST(NULLIF(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(e.data, '$.profileLocalId')), ''), 'null') AS UNSIGNED)
            WHERE e.entity_type = 'favourite_clinic'
              AND (JSON_UNQUOTE(JSON_EXTRACT(e.data, '$.clinicId')) = %s
                   OR CAST(NULLIF(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(e.data, '$.clinicLocalId')), ''), 'null') AS UNSIGNED) = %s)
            ORDER BY COALESCE(e.updated_at, e.created_at) DESC, e.id DESC
            LIMIT 100
            """,
            (source_id, int(row["id"])),
        )
        visitors = []
        for visitor in cursor.fetchall():
            visitor_data = as_dict(visitor.get("data"))
            profile_data = as_dict(visitor.get("profileData"))
            visitors.append({
                "id": visitor.get("id"), "profileName": visitor.get("profileName") or "Member",
                "profileEmail": visitor.get("profileEmail") or "-", "avatarUrl": profile_data.get("avatarUrl") or profile_data.get("avatar") or "",
                "verified": bool(profile_data.get("isVerified") or profile_data.get("verified")),
                "premium": bool(profile_data.get("isPremium") or profile_data.get("premium")),
                "viewCount": int(visitor_data.get("viewCount") or 1), "createdAt": visitor.get("created_at"), "updatedAt": visitor.get("updated_at"),
            })
    service_labels = {
        "ivf": "IVF", "icsi_ivf": "ICSI IVF", "egg_donation_ivf": "Egg donation IVF", "sperm_donations_ivf": "Sperm donation IVF", "genetic_testing_ivf": "Genetic testing IVF", "own_egg_sperm_ivf": "Own egg / sperm IVF", "embryo_donations_ivf": "Embryo donation IVF",
        "freezing": "Fertility freezing", "egg_freezing": "Egg freezing", "sperm_freezing": "Sperm freezing", "embryo_freezing": "Embryo freezing",
        "iui_intrauterine": "Iui Intrauterine", "ici_intracervical": "Ici Intracervical", "iutpi_tuboperitoneal": "Iutpi Tuboperitoneal", "iti_intratubal": "Iti Intratubal",
        "women_over_46": "Women Over 46", "hiv_positive_female": "Hiv Positive Female", "hiv_positive_male": "Hiv Positive Male", "hepatitis_bc_male": "Hepatitis Bc Male", "hepatitis_bc_female": "Hepatitis Bc Female",
    }
    group_labels = {"ivf_treatments": "IVF Treatments", "fertility_preservation": "Fertility Preservation", "artificial_insemination": "Artificial Insemination", "special_situations": "Special Situations"}
    groups = {group_labels.get(key, key.replace("_", " ").title()): [{"slug": slug, "label": service_labels.get(slug, slug.replace("_", " ").title())} for slug in values] for key, values in CLINIC_SERVICE_GROUPS.items()}
    return {"clinic": clinic, "visitors": visitors, "visitorCount": len(visitors), "serviceGroups": groups}


@app.patch("/api/admin/clinics/{clinic_identifier}")
def admin_update_clinic(clinic_identifier: str, payload: AdminPatchPayload, actor: str = Depends(require_admin)):
    allowed = {"name", "slug", "logoUrl", "location", "country", "region", "city", "latitude", "longitude", "establishedYear", "hours", "website", "phone", "email", "hospitalAffiliations", "credentials", "honorsAwards", "aboutHtml", "languages", "services", "isActive", "chatEnabled"}
    values = {key: value for key, value in payload.values.items() if key in allowed}
    with db_cursor() as (conn, cursor):
        row = fetch_admin_clinic(cursor, clinic_identifier)
        data = as_dict(row.get("data"))
        data.update(values)
        if "services" in values:
            data["servicesCount"] = len(values["services"]) if isinstance(values["services"], list) else 0
        if "languages" in values:
            data["languagesCount"] = len(values["languages"]) if isinstance(values["languages"], list) else 0
        if "languages" in data and not isinstance(data["languages"], list):
            data["languages"] = []
        if "services" in data and not isinstance(data["services"], list):
            data["services"] = []
        active = bool(data.get("isActive", str(row.get("status") or "").lower() == "active"))
        status = "active" if active else "inactive"
        cursor.execute(
            "UPDATE clinics SET name = %s, country = %s, city = %s, status = %s, data = %s, updated_at = UTC_TIMESTAMP() WHERE id = %s",
            (data.get("name") or row.get("name"), data.get("country") or row.get("country"), data.get("city") or row.get("city"), status, json.dumps(data, ensure_ascii=False), row["id"]),
        )
        audit(conn, actor, "update_clinic", "clinics", row["id"], {"fields": list(values)})
        conn.commit()
        updated = fetch_admin_clinic(cursor, row["id"])
    return {"clinic": normalize_admin_clinic(updated), "visitors": [], "visitorCount": 0, "serviceGroups": {}}


@app.post("/api/admin/clinics/{clinic_identifier}/logo")
async def admin_upload_clinic_logo(
    clinic_identifier: str,
    file: UploadFile = File(...),
    actor: str = Depends(require_admin),
):
    content_type = (file.content_type or "").split(";")[0].lower()
    ext = ALLOWED_IMAGE_TYPES.get(content_type)
    if not ext:
        raise HTTPException(status_code=415, detail="Only JPEG, PNG and WebP images are supported")
    body = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(body) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Logo file is too large")
    if not body:
        raise HTTPException(status_code=422, detail="Logo file is empty")
    with db_cursor() as (conn, cursor):
        row = fetch_admin_clinic(cursor, clinic_identifier)
        storage_dir = UPLOAD_DIR / "clinics" / str(row["id"])
        storage_dir.mkdir(parents=True, exist_ok=True)
        storage_name = f"logo-{int(now_utc().timestamp())}-{secrets.token_hex(6)}{ext}"
        storage_path = storage_dir / storage_name
        storage_path.write_bytes(body)
        storage_key = f"clinics/{row['id']}/{storage_name}"
        public_url = f"{UPLOAD_URL_PREFIX.rstrip('/')}/{storage_key}"
        metadata = {"originalName": file.filename, "clinicId": row["id"], "purpose": "admin_clinic_logo"}
        cursor.execute(
            """
            INSERT INTO media_files (storage_key, public_url, mime_type, bytes, metadata)
            VALUES (%s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE public_url = VALUES(public_url), mime_type = VALUES(mime_type), bytes = VALUES(bytes), metadata = VALUES(metadata)
            """,
            (storage_key, public_url, content_type, len(body), json.dumps(metadata, ensure_ascii=False)),
        )
        data = as_dict(row.get("data"))
        data["logoUrl"] = public_url
        cursor.execute("UPDATE clinics SET data = %s, updated_at = UTC_TIMESTAMP() WHERE id = %s", (json.dumps(data, ensure_ascii=False), row["id"]))
        audit(conn, actor, "admin_upload_clinic_logo", "clinics", row["id"], {"publicUrl": public_url})
        conn.commit()
    return {"ok": True, "publicUrl": public_url}


@app.delete("/api/admin/clinics/{clinic_identifier}")
def admin_delete_clinic(clinic_identifier: str, actor: str = Depends(require_admin)):
    with db_cursor() as (conn, cursor):
        row = fetch_admin_clinic(cursor, clinic_identifier)
        cursor.execute("DELETE FROM clinics WHERE id = %s", (row["id"],))
        audit(conn, actor, "permanently_delete_clinic", "clinics", row["id"], {"name": row.get("name")})
        conn.commit()
    return {"ok": True}


@app.post("/api/admin/subscriptions/grant")
def admin_grant_subscription(payload: AdminSubscriptionGrantPayload, actor: str = Depends(require_admin)):
    reference = payload.profileRef.strip()
    expires_at = (now_utc() + timedelta(days=payload.days)).strftime("%Y-%m-%dT%H:%M:%SZ")
    with db_cursor() as (conn, cursor):
        if reference.isdigit():
            cursor.execute("SELECT id, display_name, email, status, data FROM profiles WHERE id = %s LIMIT 1 FOR UPDATE", (int(reference),))
        else:
            cursor.execute(
                """
                SELECT id, display_name, email, status, data
                FROM profiles
                WHERE email = %s OR JSON_UNQUOTE(JSON_EXTRACT(data, '$.id')) = %s
                LIMIT 1 FOR UPDATE
                """,
                (reference.lower(), reference),
            )
        profile = cursor.fetchone()
        if not profile:
            raise HTTPException(status_code=404, detail="User not found")
        if not profile_is_verified(profile):
            raise HTTPException(status_code=409, detail="Verify the profile before granting Premium")
        subscription_data = {
            "profileId": int(profile["id"]),
            "profileName": profile.get("display_name") or "No profile",
            "email": profile.get("email") or "",
            "plan": payload.plan,
            "source": "MANUAL_REVIEW",
            "activeAt": now_utc().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "expiresAt": expires_at,
            "reviewedBy": actor,
        }
        cursor.execute(
            """
            SELECT id, data
            FROM app_entities
            WHERE entity_type = 'subscription'
              AND status = 'PENDING'
              AND CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$.profileId')) AS CHAR) = CAST(%s AS CHAR)
            ORDER BY id DESC
            LIMIT 1
            FOR UPDATE
            """,
            (profile["id"],),
        )
        pending = cursor.fetchone()
        if pending:
            pending_data = as_dict(pending.get("data"))
            pending_data.update(subscription_data)
            cursor.execute(
                "UPDATE app_entities SET title = %s, status = 'ACTIVE', data = %s, updated_at = UTC_TIMESTAMP() WHERE id = %s",
                (
                    f"Premium: {profile.get('display_name') or profile['id']}",
                    json.dumps(pending_data, ensure_ascii=False),
                    pending["id"],
                ),
            )
            subscription_id = int(pending["id"])
            subscription_data = pending_data
        else:
            cursor.execute(
                "INSERT INTO app_entities (entity_type, source_key, title, status, data) VALUES ('subscription', %s, %s, 'ACTIVE', %s)",
                (f"manual-subscription-{profile['id']}-{secrets.token_hex(4)}", f"Manual premium: {profile.get('display_name') or profile['id']}", json.dumps(subscription_data, ensure_ascii=False)),
            )
            subscription_id = cursor.lastrowid
        is_premium = recompute_profile_premium(cursor, int(profile["id"]))
        send_support_status_message(
            cursor,
            int(profile["id"]),
            "Your Premium subscription is active.",
        )
        audit(conn, actor, "grant_premium", "subscription", subscription_id, subscription_data)
        conn.commit()
    return {"ok": True, "subscriptionId": subscription_id, "profile": normalize_row(profile), "isPremium": is_premium}


@app.post("/api/admin/subscriptions/{subscription_id}/review")
def admin_review_subscription(subscription_id: int, payload: AdminSubscriptionReviewPayload, actor: str = Depends(require_admin)):
    with db_cursor() as (conn, cursor):
        cursor.execute(
            "SELECT id, status, data FROM app_entities WHERE id = %s AND entity_type = 'subscription' LIMIT 1 FOR UPDATE",
            (subscription_id,),
        )
        subscription = cursor.fetchone()
        if not subscription:
            raise HTTPException(status_code=404, detail="Subscription request not found")
        if str(subscription.get("status") or "").upper() != "PENDING":
            raise HTTPException(status_code=409, detail="Only pending subscription requests can be reviewed")
        data = as_dict(subscription.get("data"))
        profile_id = int_or_none(data.get("profileId"))
        if not profile_id:
            raise HTTPException(status_code=409, detail="Subscription request is not linked to a profile")
        cursor.execute(
            "SELECT id, display_name, email, status, data FROM profiles WHERE id = %s LIMIT 1 FOR UPDATE",
            (profile_id,),
        )
        profile = cursor.fetchone()
        if not profile:
            raise HTTPException(status_code=404, detail="User not found")
        reviewed_at = now_utc().strftime("%Y-%m-%dT%H:%M:%SZ")
        data.update({"reviewedAt": reviewed_at, "reviewedBy": actor})
        if payload.status == "DECLINED":
            data["reviewStatus"] = "DECLINED"
            cursor.execute(
                "UPDATE app_entities SET status = 'DECLINED', data = %s, updated_at = UTC_TIMESTAMP() WHERE id = %s",
                (json.dumps(data, ensure_ascii=False), subscription_id),
            )
            send_support_status_message(
                cursor,
                profile_id,
                "Your Premium subscription request was declined.",
            )
            audit(conn, actor, "decline_premium", "subscription", subscription_id, {"profileId": profile_id})
            conn.commit()
            return {"ok": True, "id": subscription_id, "status": "DECLINED", "isPremium": profile_is_premium(profile)}
        if not profile_is_verified(profile):
            raise HTTPException(status_code=409, detail="Verify the profile before approving Premium")
        plan = normalize_subscription_plan(str(data.get("plan") or ""))
        days = payload.days or subscription_plan_days(plan)
        data.update({
            "plan": plan,
            "source": "MANUAL_REVIEW",
            "reviewStatus": "APPROVED",
            "activeAt": reviewed_at,
            "expiresAt": (now_utc() + timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        })
        cursor.execute(
            "UPDATE app_entities SET status = 'ACTIVE', data = %s, updated_at = UTC_TIMESTAMP() WHERE id = %s",
            (json.dumps(data, ensure_ascii=False), subscription_id),
        )
        is_premium = recompute_profile_premium(cursor, profile_id)
        send_support_status_message(
            cursor,
            profile_id,
            "Your Premium subscription is active.",
        )
        audit(conn, actor, "approve_premium", "subscription", subscription_id, {"profileId": profile_id, "plan": plan, "days": days})
        conn.commit()
    return {"ok": True, "id": subscription_id, "status": "ACTIVE", "isPremium": is_premium}


@app.post("/api/admin/subscriptions/{subscription_id}/revoke")
def admin_revoke_subscription(subscription_id: int, actor: str = Depends(require_admin)):
    with db_cursor() as (conn, cursor):
        cursor.execute("SELECT id, data FROM app_entities WHERE id = %s AND entity_type = 'subscription' LIMIT 1", (subscription_id,))
        subscription = cursor.fetchone()
        if not subscription:
            raise HTTPException(status_code=404, detail="Subscription not found")
        data = subscription.get("data") or {}
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except json.JSONDecodeError:
                data = {}
        profile_id = int_or_none(data.get("profileId"))
        cursor.execute("UPDATE app_entities SET status = 'CANCELLED', updated_at = UTC_TIMESTAMP() WHERE id = %s", (subscription_id,))
        is_premium = recompute_profile_premium(cursor, profile_id) if profile_id else False
        if profile_id:
            send_support_status_message(
                cursor,
                profile_id,
                "Your Premium subscription has been cancelled.",
            )
        audit(conn, actor, "revoke_premium", "subscription", subscription_id, {"profileId": profile_id})
        conn.commit()
    return {"ok": True, "id": subscription_id, "isPremium": is_premium}


def support_profile(cursor) -> dict[str, Any]:
    cursor.execute("SELECT id, display_name FROM profiles WHERE role = 'SUPPORT' AND status = 'ACTIVE' ORDER BY id ASC LIMIT 1")
    profile = cursor.fetchone()
    if not profile:
        raise HTTPException(status_code=409, detail="Support profile is not configured")
    return profile


@app.get("/api/admin/support")
def admin_support_list(
    q: str | None = Query(None, min_length=1, max_length=200),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    unanswered: bool = Query(False),
    _admin: str = Depends(require_admin),
):
    where = ["(a.role = 'SUPPORT' OR b.role = 'SUPPORT')"]
    params: list[Any] = []
    if q:
        where.append("(a.display_name LIKE %s OR b.display_name LIKE %s OR a.email LIKE %s OR b.email LIKE %s)")
        like = f"%{q}%"
        params.extend([like, like, like, like])
    if unanswered:
        where.append("EXISTS (SELECT 1 FROM conversation_messages um WHERE um.conversation_id = c.id AND um.sender_profile_id <> CASE WHEN a.role = 'SUPPORT' THEN a.id ELSE b.id END AND um.read_at IS NULL AND um.status = 'ACTIVE')")
    where_sql = "WHERE " + " AND ".join(where)
    with db_cursor() as (_, cursor):
        cursor.execute(f"SELECT COUNT(*) AS cnt FROM conversations c JOIN profiles a ON a.id = c.profile_a_id JOIN profiles b ON b.id = c.profile_b_id {where_sql}", params)
        total = int(cursor.fetchone()["cnt"] or 0)
        cursor.execute(
            f"""
            SELECT
              c.id, c.status, c.created_at, c.updated_at,
              CASE WHEN a.role = 'SUPPORT' THEN b.id ELSE a.id END AS userId,
              CASE WHEN a.role = 'SUPPORT' THEN b.display_name ELSE a.display_name END AS userName,
              CASE WHEN a.role = 'SUPPORT' THEN b.email ELSE a.email END AS email,
              (SELECT body FROM conversation_messages lm WHERE lm.conversation_id = c.id ORDER BY lm.created_at DESC, lm.id DESC LIMIT 1) AS lastMessage,
              (SELECT created_at FROM conversation_messages lm WHERE lm.conversation_id = c.id ORDER BY lm.created_at DESC, lm.id DESC LIMIT 1) AS lastMessageAt,
              (SELECT COUNT(*) FROM conversation_messages um WHERE um.conversation_id = c.id AND um.sender_profile_id <> CASE WHEN a.role = 'SUPPORT' THEN a.id ELSE b.id END AND um.read_at IS NULL AND um.status = 'ACTIVE') AS unreadCount
            FROM conversations c
            JOIN profiles a ON a.id = c.profile_a_id
            JOIN profiles b ON b.id = c.profile_b_id
            {where_sql}
            ORDER BY COALESCE(
              (SELECT created_at FROM conversation_messages lm
               WHERE lm.conversation_id = c.id
               ORDER BY lm.created_at DESC, lm.id DESC
               LIMIT 1),
              c.updated_at
            ) DESC, c.id DESC
            LIMIT %s OFFSET %s
            """,
            [*params, limit, offset],
        )
        items = [normalize_row(row) for row in cursor.fetchall()]
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@app.get("/api/admin/support/{conversation_id}")
def admin_support_conversation(conversation_id: int, _admin: str = Depends(require_admin)):
    with db_cursor() as (conn, cursor):
        cursor.execute(
            """
            SELECT c.id, c.status, c.profile_a_id, c.profile_b_id,
                   a.role AS profileARole, b.role AS profileBRole,
                   CASE WHEN a.role = 'SUPPORT' THEN b.id ELSE a.id END AS userId,
                   CASE WHEN a.role = 'SUPPORT' THEN b.display_name ELSE a.display_name END AS userName,
                   CASE WHEN a.role = 'SUPPORT' THEN b.email ELSE a.email END AS email
            FROM conversations c
            JOIN profiles a ON a.id = c.profile_a_id
            JOIN profiles b ON b.id = c.profile_b_id
            WHERE c.id = %s AND (a.role = 'SUPPORT' OR b.role = 'SUPPORT')
            LIMIT 1
            """,
            (conversation_id,),
        )
        conversation = cursor.fetchone()
        if not conversation:
            raise HTTPException(status_code=404, detail="Support conversation not found")
        support = support_profile(cursor)
        cursor.execute(
            """
            SELECT m.id, m.body, m.media_url, m.status, m.read_at, m.created_at,
                   m.sender_profile_id, p.display_name AS senderName, p.role AS senderRole
            FROM conversation_messages m
            JOIN profiles p ON p.id = m.sender_profile_id
            WHERE m.conversation_id = %s
            ORDER BY m.created_at ASC, m.id ASC
            """,
            (conversation_id,),
        )
        messages = [normalize_row(row) for row in cursor.fetchall()]
        cursor.execute("UPDATE conversation_messages SET read_at = COALESCE(read_at, UTC_TIMESTAMP()) WHERE conversation_id = %s AND sender_profile_id <> %s AND status = 'ACTIVE'", (conversation_id, support["id"]))
        conn.commit()
    return {"conversation": normalize_row(conversation), "supportProfile": normalize_row(support), "messages": messages}


@app.post("/api/admin/support/{conversation_id}/messages")
def admin_send_support_message(conversation_id: int, payload: AdminSupportMessagePayload, actor: str = Depends(require_admin)):
    with db_cursor() as (conn, cursor):
        support = support_profile(cursor)
        cursor.execute("SELECT id, status FROM conversations WHERE id = %s AND (profile_a_id = %s OR profile_b_id = %s) LIMIT 1", (conversation_id, support["id"], support["id"]))
        conversation = cursor.fetchone()
        if not conversation:
            raise HTTPException(status_code=404, detail="Support conversation not found")
        if str(conversation.get("status") or "").upper() != "ACTIVE":
            raise HTTPException(status_code=409, detail="Support conversation is not active")
        cursor.execute("INSERT INTO conversation_messages (conversation_id, sender_profile_id, body, status, created_at) VALUES (%s, %s, %s, 'ACTIVE', UTC_TIMESTAMP())", (conversation_id, support["id"], payload.body.strip()))
        message_id = cursor.lastrowid
        cursor.execute("UPDATE conversations SET updated_at = UTC_TIMESTAMP() WHERE id = %s", (conversation_id,))
        audit(conn, actor, "send_support_message", "conversation", conversation_id, {"messageId": message_id})
        conn.commit()
    return {"ok": True, "messageId": message_id}


ADMIN_TABLE_VIEWS: dict[str, dict[str, Any]] = {
    "users": {
        "table": "profiles",
        "select": """
            id, role, display_name, email, status, created_at, updated_at, data,
            JSON_UNQUOTE(JSON_EXTRACT(data, '$.id')) AS sourceId,
            JSON_UNQUOTE(JSON_EXTRACT(data, '$.profileType')) AS profileType,
            JSON_UNQUOTE(JSON_EXTRACT(data, '$.country')) AS country,
            JSON_UNQUOTE(JSON_EXTRACT(data, '$.city')) AS city,
            COALESCE(
                JSON_UNQUOTE(JSON_EXTRACT(data, '$.registrationSource')),
                JSON_UNQUOTE(JSON_EXTRACT(data, '$.source')),
                JSON_UNQUOTE(JSON_EXTRACT(data, '$.platform')),
                'Web App'
            ) AS source,
            (SELECT public_url FROM profile_photos pph
             WHERE pph.profile_id = profiles.id
               AND pph.status = 'ACTIVE'
               AND pph.moderation_status = 'APPROVED'
             ORDER BY pph.position ASC, pph.id ASC LIMIT 1) AS avatarUrl,
            EXISTS(
                SELECT 1 FROM local_users lu
                JOIN auth_sessions aus ON aus.user_id = lu.id
                WHERE lu.profile_id = profiles.id
                  AND aus.revoked_at IS NULL
                  AND aus.last_seen_at >= UTC_TIMESTAMP() - INTERVAL 5 MINUTE
            ) AS isOnline,
            COALESCE(
                JSON_UNQUOTE(JSON_EXTRACT(data, '$.locationMismatchType')),
                JSON_UNQUOTE(JSON_EXTRACT(data, '$.locationMismatch')),
                ''
            ) AS locationMismatch,
            (SELECT COUNT(*) FROM profile_blocks b
             WHERE b.blocker_profile_id = profiles.id AND COALESCE(b.status, 'ACTIVE') = 'ACTIVE') AS blocksCount,
            (SELECT COUNT(*) FROM app_entities r
             WHERE r.entity_type = 'moderation_report'
               AND CAST(COALESCE(
                 JSON_UNQUOTE(JSON_EXTRACT(r.data, '$.targetProfileId')),
                 JSON_UNQUOTE(JSON_EXTRACT(r.data, '$.reportedProfileId'))
               ) AS CHAR) = CAST(profiles.id AS CHAR)) AS reportsCount,
            (SELECT v.status FROM app_entities v
             WHERE v.entity_type = 'verification'
               AND CAST(JSON_UNQUOTE(JSON_EXTRACT(v.data, '$.profileId')) AS CHAR) = CAST(profiles.id AS CHAR)
             ORDER BY v.id DESC LIMIT 1) AS verificationStatus
        """,
        "search": [
            "display_name",
            "email",
            "JSON_UNQUOTE(JSON_EXTRACT(data, '$.id'))",
            "JSON_UNQUOTE(JSON_EXTRACT(data, '$.city'))",
        ],
        "filters": {
            "role": "role",
            "status": "status",
            "profileType": "JSON_UNQUOTE(JSON_EXTRACT(data, '$.profileType'))",
            "country": "JSON_UNQUOTE(JSON_EXTRACT(data, '$.country'))",
            "city": "JSON_UNQUOTE(JSON_EXTRACT(data, '$.city'))",
        },
        "order": "id DESC",
    },
    "profiles": {
        "table": "profiles",
        "select": """
            id, role, display_name, email, status, created_at, updated_at, data,
            JSON_UNQUOTE(JSON_EXTRACT(data, '$.id')) AS sourceId,
            JSON_UNQUOTE(JSON_EXTRACT(data, '$.profileType')) AS profileType,
            JSON_UNQUOTE(JSON_EXTRACT(data, '$.country')) AS country,
            JSON_UNQUOTE(JSON_EXTRACT(data, '$.city')) AS city,
            COALESCE(
                JSON_UNQUOTE(JSON_EXTRACT(data, '$.registrationSource')),
                JSON_UNQUOTE(JSON_EXTRACT(data, '$.source')),
                JSON_UNQUOTE(JSON_EXTRACT(data, '$.platform')),
                'Web App'
            ) AS source,
            (SELECT public_url FROM profile_photos pph
             WHERE pph.profile_id = profiles.id
               AND pph.status = 'ACTIVE'
               AND pph.moderation_status = 'APPROVED'
             ORDER BY pph.position ASC, pph.id ASC LIMIT 1) AS avatarUrl,
            EXISTS(
                SELECT 1 FROM local_users lu
                JOIN auth_sessions aus ON aus.user_id = lu.id
                WHERE lu.profile_id = profiles.id
                  AND aus.revoked_at IS NULL
                  AND aus.last_seen_at >= UTC_TIMESTAMP() - INTERVAL 5 MINUTE
            ) AS isOnline,
            COALESCE(
                JSON_UNQUOTE(JSON_EXTRACT(data, '$.locationMismatchType')),
                JSON_UNQUOTE(JSON_EXTRACT(data, '$.locationMismatch')),
                ''
            ) AS locationMismatch,
            (SELECT COUNT(*) FROM profile_blocks b
             WHERE b.blocker_profile_id = profiles.id AND COALESCE(b.status, 'ACTIVE') = 'ACTIVE') AS blocksCount,
            (SELECT COUNT(*) FROM app_entities r
             WHERE r.entity_type = 'moderation_report'
               AND CAST(COALESCE(
                 JSON_UNQUOTE(JSON_EXTRACT(r.data, '$.targetProfileId')),
                 JSON_UNQUOTE(JSON_EXTRACT(r.data, '$.reportedProfileId'))
               ) AS CHAR) = CAST(profiles.id AS CHAR)) AS reportsCount,
            (SELECT v.status FROM app_entities v
             WHERE v.entity_type = 'verification'
               AND CAST(JSON_UNQUOTE(JSON_EXTRACT(v.data, '$.profileId')) AS CHAR) = CAST(profiles.id AS CHAR)
             ORDER BY v.id DESC LIMIT 1) AS verificationStatus
        """,
        "search": [
            "display_name",
            "email",
            "JSON_UNQUOTE(JSON_EXTRACT(data, '$.id'))",
            "JSON_UNQUOTE(JSON_EXTRACT(data, '$.city'))",
        ],
        "filters": {
            "role": "role",
            "status": "status",
            "profileType": "JSON_UNQUOTE(JSON_EXTRACT(data, '$.profileType'))",
            "country": "JSON_UNQUOTE(JSON_EXTRACT(data, '$.country'))",
            "city": "JSON_UNQUOTE(JSON_EXTRACT(data, '$.city'))",
        },
        "order": "id DESC",
    },
    "clinics": {
        "table": "clinics",
        "select": """
            id, name, country, city, status, created_at, updated_at, data,
            JSON_UNQUOTE(JSON_EXTRACT(data, '$.slug')) AS slug,
            JSON_UNQUOTE(JSON_EXTRACT(data, '$.logoUrl')) AS logoUrl,
            JSON_EXTRACT(data, '$.servicesCount') AS servicesCount,
            JSON_UNQUOTE(JSON_EXTRACT(data, '$.partner.name')) AS partnerName
        """,
        "search": ["name", "country", "city", "JSON_UNQUOTE(JSON_EXTRACT(data, '$.slug'))"],
        "filters": {"status": "status", "country": "country", "city": "city"},
        "boolean_filters": {
            "hasWebsite": "JSON_UNQUOTE(JSON_EXTRACT(data, '$.website'))",
            "hasLogo": "JSON_UNQUOTE(JSON_EXTRACT(data, '$.logoUrl'))",
        },
        "order": "name ASC, id ASC",
    },
    "lawyers": {
        "table": "lawyers",
        "select": """
            id, name, country, city, status, created_at, updated_at, data,
            JSON_UNQUOTE(JSON_EXTRACT(data, '$.slug')) AS slug,
            JSON_UNQUOTE(JSON_EXTRACT(data, '$.photoUrl')) AS photoUrl,
            JSON_EXTRACT(data, '$.practiceAreasCount') AS practiceAreasCount
        """,
        "search": ["name", "country", "city", "JSON_UNQUOTE(JSON_EXTRACT(data, '$.slug'))"],
        "filters": {"status": "status", "country": "country", "city": "city"},
        "order": "name ASC, id ASC",
    },
    "articles": {
        "table": "articles",
        "select": "id, locale, slug, title, excerpt, body_html, cover_url, status, published_at, created_at, updated_at, meta AS data",
        "search": ["title", "slug", "excerpt"],
        "filters": {"status": "status", "locale": "locale"},
        "order": "COALESCE(published_at, created_at) DESC, id DESC",
    },
    "static-pages": {
        "table": "content_pages",
        "select": "id, locale, slug, title, body_html, status, published_at, created_at, updated_at, meta AS data",
        "search": ["title", "slug", "body_html"],
        "filters": {"status": "status", "locale": "locale"},
        "order": "id ASC",
    },
    "profile-likes": {
        "table": "profile_likes",
        "select": """
            id, actor_profile_id, target_profile_id, status, created_at, updated_at,
            (SELECT display_name FROM profiles p WHERE p.id = profile_likes.actor_profile_id) AS actorName,
            (SELECT display_name FROM profiles p WHERE p.id = profile_likes.target_profile_id) AS targetName
        """,
        "search": [
            "CAST(actor_profile_id AS CHAR)",
            "CAST(target_profile_id AS CHAR)",
            "(SELECT display_name FROM profiles p WHERE p.id = profile_likes.actor_profile_id)",
            "(SELECT display_name FROM profiles p WHERE p.id = profile_likes.target_profile_id)",
        ],
        "filters": {"status": "status"},
        "order": "updated_at DESC, id DESC",
    },
    "profile-matches": {
        "table": "profile_matches",
        "select": """
            id, profile_a_id, profile_b_id, status, created_at, updated_at,
            (SELECT display_name FROM profiles p WHERE p.id = profile_matches.profile_a_id) AS profileA,
            (SELECT display_name FROM profiles p WHERE p.id = profile_matches.profile_b_id) AS profileB
        """,
        "search": [
            "CAST(profile_a_id AS CHAR)",
            "CAST(profile_b_id AS CHAR)",
            "(SELECT display_name FROM profiles p WHERE p.id = profile_matches.profile_a_id)",
            "(SELECT display_name FROM profiles p WHERE p.id = profile_matches.profile_b_id)",
        ],
        "filters": {"status": "status"},
        "order": "updated_at DESC, id DESC",
    },
    "conversations": {
        "table": "conversations",
        "select": """
            id, match_id, profile_a_id, profile_b_id, status, created_at, updated_at,
            (SELECT display_name FROM profiles p WHERE p.id = conversations.profile_a_id) AS profileA,
            (SELECT display_name FROM profiles p WHERE p.id = conversations.profile_b_id) AS profileB
        """,
        "search": [
            "CAST(profile_a_id AS CHAR)",
            "CAST(profile_b_id AS CHAR)",
            "(SELECT display_name FROM profiles p WHERE p.id = conversations.profile_a_id)",
            "(SELECT display_name FROM profiles p WHERE p.id = conversations.profile_b_id)",
        ],
        "filters": {"status": "status"},
        "order": "updated_at DESC, id DESC",
    },
    "conversation-messages": {
        "table": "conversation_messages",
        "select": """
            id, conversation_id, sender_profile_id, body, status, created_at, read_at,
            (SELECT display_name FROM profiles p WHERE p.id = conversation_messages.sender_profile_id) AS senderName
        """,
        "search": [
            "body",
            "CAST(conversation_id AS CHAR)",
            "CAST(sender_profile_id AS CHAR)",
            "(SELECT display_name FROM profiles p WHERE p.id = conversation_messages.sender_profile_id)",
        ],
        "filters": {"status": "status"},
        "order": "created_at DESC, id DESC",
    },
    "profile-photos": {
        "table": "profile_photos",
        "select": """
            id, profile_id, public_url, position, status,
            upload_status, moderation_status, moderation_reason, moderation_data,
            created_at, updated_at,
            (SELECT display_name FROM profiles p WHERE p.id = profile_photos.profile_id) AS profileName
        """,
        "search": [
            "public_url",
            "CAST(profile_id AS CHAR)",
            "(SELECT display_name FROM profiles p WHERE p.id = profile_photos.profile_id)",
        ],
        "filters": {"status": "status"},
        "order": "updated_at DESC, id DESC",
    },
    "profile-blocks": {
        "table": "profile_blocks",
        "select": """
            id, blocker_profile_id, blocked_profile_id, reason, status, created_at, updated_at,
            (SELECT display_name FROM profiles p WHERE p.id = profile_blocks.blocker_profile_id) AS blockerName,
            (SELECT display_name FROM profiles p WHERE p.id = profile_blocks.blocked_profile_id) AS blockedName
        """,
        "search": [
            "reason",
            "CAST(blocker_profile_id AS CHAR)",
            "CAST(blocked_profile_id AS CHAR)",
            "(SELECT display_name FROM profiles p WHERE p.id = profile_blocks.blocker_profile_id)",
            "(SELECT display_name FROM profiles p WHERE p.id = profile_blocks.blocked_profile_id)",
        ],
        "filters": {"status": "status"},
        "order": "updated_at DESC, id DESC",
    },
    "events": {
        "table": "api_events",
        "select": "id, event_type, payload, created_at, payload AS data",
        "search": ["event_type", "CAST(payload AS CHAR)"],
        "filters": {},
        "order": "created_at DESC, id DESC",
    },
}

ADMIN_ENTITY_VIEWS: dict[str, str] = {
    "verifications": "verification",
    "subscriptions": "subscription",
    "subscription-events": "subscription_event",
    "profile-views": "profile_view",
    "favourite-clinics": "favourite_clinic",
    "favourite-lawyers": "favourite_lawyer",
    "favorite-clinics": "favourite_clinic",
    "favorite-lawyers": "favourite_lawyer",
    "deletion-feedback": "deletion_feedback",
    "categories": "category",
    "settings": "setting",
    "settings-modules": "setting_module",
    "settings-api-keys": "settings_api_key_status",
    "settings-audit-log": "settings_audit_log",
    "settings-moderation": "setting",
    "settings-ranking": "setting",
    "settings-app-stores": "setting",
    "marketing": "marketing",
    "moderation-photos": "moderation_photo",
    "moderation-reports": "moderation_report",
    "account-deletion": "account_deletion_request",
    "support": "support_chat",
    "livekit": "livekit_room",
}


def build_list_where(
    definition: dict[str, Any],
    q: str | None,
    status_filter: str | None,
    country: str | None,
    city: str | None,
    role: str | None,
    locale: str | None,
    profile_type: str | None = None,
    group: str | None = None,
    has_website: str | None = None,
    has_logo: str | None = None,
    mismatch: str | None = None,
    is_donor: str | None = None,
    seeks_co_parent: str | None = None,
    is_online: str | None = None,
) -> tuple[str, list[Any]]:
    where_parts: list[str] = []
    params: list[Any] = []
    if q:
        search_parts = [f"{column} LIKE %s" for column in definition.get("search", [])]
        if search_parts:
            where_parts.append("(" + " OR ".join(search_parts) + ")")
            params.extend([f"%{q}%"] * len(search_parts))
    filters = definition.get("filters", {})
    filter_values = {
        "status": status_filter,
        "country": country,
        "city": city,
        "role": role,
        "locale": locale,
        "profileType": profile_type,
    }
    for key, value in filter_values.items():
        if value and key in filters:
            where_parts.append(f"{filters[key]} = %s")
            params.append(value)
    if group and definition.get("table") == "app_entities":
        where_parts.append("JSON_UNQUOTE(JSON_EXTRACT(data, '$.group')) = %s")
        params.append(group)
    for key, value in {"hasWebsite": has_website, "hasLogo": has_logo}.items():
        if value and key in definition.get("boolean_filters", {}):
            expr = definition["boolean_filters"][key]
            if str(value).lower() in {"1", "true", "yes", "has"}:
                where_parts.append(f"({expr} IS NOT NULL AND {expr} <> '')")
            elif str(value).lower() in {"0", "false", "no", "missing"}:
                where_parts.append(f"({expr} IS NULL OR {expr} = '')")
    mismatch_value = str(mismatch or "").lower()
    if mismatch_value in {"any", "hard"} and "profileType" in filters:
        mismatch_expression = (
            "LOWER(COALESCE("
            "JSON_UNQUOTE(JSON_EXTRACT(data, '$.locationMismatchType')), "
            "JSON_UNQUOTE(JSON_EXTRACT(data, '$.locationMismatch')), "
            "JSON_UNQUOTE(JSON_EXTRACT(data, '$.locationRisk')), ''))"
        )
        if mismatch_value == "hard":
            where_parts.append(f"{mismatch_expression} = 'hard'")
        else:
            where_parts.append(f"{mismatch_expression} IN ('hard', 'soft', 'true', '1')")
    if definition.get("table") == "profiles":
        if is_donor and str(is_donor).lower() in {"1", "true", "yes"}:
            where_parts.append("JSON_UNQUOTE(JSON_EXTRACT(data, '$.donorType')) IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.donorType')) <> ''")
        if seeks_co_parent and str(seeks_co_parent).lower() in {"1", "true", "yes"}:
            where_parts.append("JSON_CONTAINS(COALESCE(JSON_EXTRACT(data, '$.lookingFor'), JSON_ARRAY()), JSON_QUOTE('CO_PARENTING_PARTNER'))")
        if is_online and str(is_online).lower() in {"1", "true", "yes"}:
            where_parts.append("JSON_UNQUOTE(JSON_EXTRACT(data, '$.isOnline')) IN ('true', '1')")
    return ("WHERE " + " AND ".join(where_parts)) if where_parts else "", params


@app.get("/api/admin/list/{view}")
def admin_list(
    view: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    q: str | None = Query(None, min_length=1, max_length=200),
    status_filter: str | None = Query(None, alias="status", min_length=1, max_length=80),
    country: str | None = Query(None, min_length=1, max_length=128),
    city: str | None = Query(None, min_length=1, max_length=128),
    role: str | None = Query(None, min_length=1, max_length=80),
    locale: str | None = Query(None, min_length=1, max_length=16),
    profile_type: str | None = Query(None, alias="profileType", min_length=1, max_length=120),
    group: str | None = Query(None, min_length=1, max_length=80),
    has_website: str | None = Query(None, alias="hasWebsite", min_length=1, max_length=16),
    has_logo: str | None = Query(None, alias="hasLogo", min_length=1, max_length=16),
    mismatch: str | None = Query(None, min_length=1, max_length=16),
    is_donor: str | None = Query(None, alias="isDonor", min_length=1, max_length=16),
    seeks_co_parent: str | None = Query(None, alias="seeksCoParent", min_length=1, max_length=16),
    is_online: str | None = Query(None, alias="isOnline", min_length=1, max_length=16),
    order_by: str | None = Query(None, alias="orderBy", min_length=1, max_length=80),
    plan: str | None = Query(None, min_length=1, max_length=80),
    source: str | None = Query(None, min_length=1, max_length=80),
    _admin: str = Depends(require_admin),
):
    if view in ADMIN_TABLE_VIEWS:
        definition = ADMIN_TABLE_VIEWS[view]
        where, params = build_list_where(
            definition,
            q,
            status_filter,
            country,
            city,
            role,
            locale,
            profile_type,
            None,
            has_website,
            has_logo,
            mismatch,
            is_donor,
            seeks_co_parent,
            is_online,
        )
        table = definition["table"]
        order = definition["order"]
        if view in {"users", "profiles"}:
            order = {
                "newest": "id DESC",
                "oldest": "id ASC",
                "name": "display_name ASC, id DESC",
                "updated": "updated_at DESC, id DESC",
            }.get(str(order_by or "").lower(), order)
        with db_cursor() as (_, cursor):
            cursor.execute(f"SELECT COUNT(*) AS cnt FROM `{table}` {where}", params)
            total = int(cursor.fetchone()["cnt"])
            cursor.execute(
                f"""
                SELECT {definition["select"]}
                FROM `{table}`
                {where}
                ORDER BY {order}
                LIMIT %s OFFSET %s
                """,
                [*params, limit, offset],
            )
            items = [normalize_row(row) for row in cursor.fetchall()]
        return {"items": items, "total": total, "limit": limit, "offset": offset, "view": view}

    entity_type = ADMIN_ENTITY_VIEWS.get(view)
    if not entity_type:
        raise HTTPException(status_code=404, detail="Admin view not found")

    where_parts = ["entity_type = %s"]
    params = [entity_type]
    if q:
        where_parts.append("(title LIKE %s OR source_key LIKE %s OR status LIKE %s OR CAST(data AS CHAR) LIKE %s)")
        like = f"%{q}%"
        params.extend([like, like, like, like])
    if status_filter:
        where_parts.append("status = %s")
        params.append(status_filter)
    if group and entity_type == "setting":
        where_parts.append("JSON_UNQUOTE(JSON_EXTRACT(data, '$.group')) = %s")
        params.append(group)
    if entity_type == "subscription" and plan:
        where_parts.append("UPPER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.plan')), '')) = %s")
        params.append(plan.upper())
    if entity_type == "subscription" and source:
        where_parts.append("UPPER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.source')), '')) = %s")
        params.append(source.upper())
    where = "WHERE " + " AND ".join(where_parts)
    with db_cursor() as (_, cursor):
        cursor.execute(f"SELECT COUNT(*) AS cnt FROM app_entities {where}", params)
        total = int(cursor.fetchone()["cnt"])
        cursor.execute(
            f"""
            SELECT id, entity_type, source_key, title, status, locale, slug, data, created_at, updated_at
            FROM app_entities
            {where}
            ORDER BY id DESC
            LIMIT %s OFFSET %s
            """,
            [*params, limit, offset],
        )
        items = [normalize_row(row) for row in cursor.fetchall()]
        if entity_type == "subscription" and items:
            profile_ids = sorted({
                profile_id
                for item in items
                if (profile_id := int_or_none(as_dict(item.get("data")).get("profileId")))
            })
            if profile_ids:
                placeholders = ", ".join(["%s"] * len(profile_ids))
                cursor.execute(
                    f"""
                    SELECT p.id, p.display_name, p.email, p.status,
                           COALESCE(
                             (SELECT public_url FROM profile_photos pph
                              WHERE pph.profile_id = p.id
                                AND pph.status = 'ACTIVE'
                                AND pph.moderation_status = 'APPROVED'
                              ORDER BY pph.position ASC, pph.id ASC LIMIT 1),
                             JSON_UNQUOTE(JSON_EXTRACT(p.data, '$.avatarUrl'))
                           ) AS avatarUrl,
                           (SELECT v.status FROM app_entities v
                            WHERE v.entity_type = 'verification'
                              AND CAST(JSON_UNQUOTE(JSON_EXTRACT(v.data, '$.profileId')) AS CHAR) = CAST(p.id AS CHAR)
                            ORDER BY v.id DESC LIMIT 1) AS verificationStatus
                    FROM profiles p
                    WHERE p.id IN ({placeholders})
                    """,
                    profile_ids,
                )
                profiles_by_id = {int(row["id"]): row for row in cursor.fetchall()}
                for item in items:
                    profile_id = int_or_none(as_dict(item.get("data")).get("profileId"))
                    profile = profiles_by_id.get(profile_id or -1)
                    if not profile:
                        continue
                    item.update({
                        "profileName": profile.get("display_name"),
                        "profileEmail": profile.get("email"),
                        "profileStatus": profile.get("status"),
                        "avatarUrl": profile.get("avatarUrl"),
                        "verificationStatus": profile.get("verificationStatus"),
                    })
        if entity_type == "verification" and items:
            # Verification records have been written by several generations of
            # the application.  Normalise the user and score fields here so the
            # admin table is a user-facing audit trail instead of exposing the
            # implementation-specific entity title / raw provider payload.
            profile_ids: set[int] = set()
            profile_emails: set[str] = set()
            for item in items:
                data = as_dict(item.get("data"))
                payload_user = as_dict(data.get("user"))
                payload_profile = as_dict(data.get("profile"))
                for candidate in (data.get("profileId"), payload_user.get("profileId"), payload_profile.get("profileId")):
                    if (profile_id := int_or_none(candidate)):
                        profile_ids.add(profile_id)
                for candidate in (data.get("email"), payload_user.get("email"), payload_profile.get("email")):
                    if candidate and str(candidate).strip():
                        profile_emails.add(str(candidate).strip().lower())

            profile_rows: list[dict[str, Any]] = []
            profile_conditions: list[str] = []
            profile_params: list[Any] = []
            if profile_ids:
                placeholders = ", ".join(["%s"] * len(profile_ids))
                profile_conditions.append(f"p.id IN ({placeholders})")
                profile_params.extend(sorted(profile_ids))
            if profile_emails:
                placeholders = ", ".join(["%s"] * len(profile_emails))
                profile_conditions.append(f"LOWER(p.email) IN ({placeholders})")
                profile_params.extend(sorted(profile_emails))
            if profile_conditions:
                cursor.execute(
                    f"""
                    SELECT p.id, p.display_name, p.email, p.status, p.data,
                           COALESCE(
                             (SELECT public_url FROM profile_photos pph
                              WHERE pph.profile_id = p.id
                                AND pph.status = 'ACTIVE'
                                AND pph.moderation_status = 'APPROVED'
                              ORDER BY pph.position ASC, pph.id ASC LIMIT 1),
                             JSON_UNQUOTE(JSON_EXTRACT(p.data, '$.avatarUrl'))
                           ) AS avatarUrl
                    FROM profiles p
                    WHERE {' OR '.join(profile_conditions)}
                    """,
                    profile_params,
                )
                profile_rows = cursor.fetchall()

            profiles_by_id = {int(row["id"]): row for row in profile_rows}
            profiles_by_email = {
                str(row.get("email") or "").strip().lower(): row
                for row in profile_rows
                if str(row.get("email") or "").strip()
            }

            def verification_score(value: Any) -> float | None:
                try:
                    score = float(value)
                except (TypeError, ValueError):
                    return None
                return score * 100 if 0 <= score <= 1 else score

            for item in items:
                data = as_dict(item.get("data"))
                payload_user = as_dict(data.get("user"))
                payload_profile = as_dict(data.get("profile"))
                decision = as_dict(data.get("decision"))
                profile_id = next(
                    (
                        value
                        for candidate in (data.get("profileId"), payload_user.get("profileId"), payload_profile.get("profileId"))
                        if (value := int_or_none(candidate))
                    ),
                    None,
                )
                email = next(
                    (
                        str(candidate).strip()
                        for candidate in (data.get("email"), payload_user.get("email"), payload_profile.get("email"))
                        if candidate and str(candidate).strip()
                    ),
                    "",
                )
                profile = profiles_by_id.get(profile_id or -1) or profiles_by_email.get(email.lower())
                profile_data = as_dict(profile.get("data")) if profile else {}
                liveness_checks = decision.get("liveness_checks") or decision.get("livenessChecks") or []
                face_matches = decision.get("face_matches") or decision.get("faceMatches") or []
                liveness = data.get("livenessScore", data.get("liveness"))
                face_match = data.get("faceMatchScore", data.get("faceMatch"))
                if liveness is None and isinstance(liveness_checks, list) and liveness_checks:
                    liveness = as_dict(liveness_checks[0]).get("score")
                if face_match is None and isinstance(face_matches, list) and face_matches:
                    face_match = as_dict(face_matches[0]).get("score")
                item.update({
                    "profileId": profile.get("id") if profile else profile_id,
                    "profileName": (
                        profile.get("display_name") if profile else None
                    ) or payload_profile.get("displayName") or payload_user.get("displayName") or data.get("profileName") or data.get("displayName") or item.get("title") or "No profile",
                    "profileEmail": (profile.get("email") if profile else None) or email or "-",
                    "profileStatus": (profile.get("status") if profile else None) or payload_user.get("status") or "",
                    "avatarUrl": (profile.get("avatarUrl") if profile else None) or payload_profile.get("photoUrl") or payload_user.get("avatarUrl") or "",
                    "isPremium": bool((profile_data or {}).get("isPremium") or payload_user.get("isPremium") or data.get("isPremium")),
                    "verificationStatus": item.get("status"),
                    "liveness": verification_score(liveness),
                    "faceMatch": verification_score(face_match),
                    "completed_at": data.get("completedAt") or data.get("completed_at") or data.get("resolvedAt") or data.get("verifiedAt") or decision.get("completed_at") or item.get("updated_at"),
                    "created_at": data.get("createdAt") or data.get("startedAt") or item.get("created_at"),
                })
    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
        "view": view,
        "entityType": entity_type,
    }


@app.get("/api/admin/profile-photos/{photo_id}/content")
def admin_profile_photo_content(photo_id: int, _admin: str = Depends(require_admin)):
    with db_cursor() as (_, cursor):
        cursor.execute(
            """
            SELECT pp.public_url AS publicUrl, mf.storage_key AS storageKey, mf.mime_type AS mimeType
            FROM profile_photos pp
            JOIN media_files mf ON mf.id = pp.media_file_id
            WHERE pp.id = %s
            LIMIT 1
            """,
            (photo_id,),
        )
        photo = cursor.fetchone()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    return profile_photo_content_response(photo)


@app.get("/api/admin/media/{media_file_id}/content")
def admin_media_content(media_file_id: int, _admin: str = Depends(require_admin)):
    with db_cursor() as (_, cursor):
        cursor.execute(
            """
            SELECT public_url AS publicUrl, storage_key AS storageKey, mime_type AS mimeType
            FROM media_files
            WHERE id = %s
            LIMIT 1
            """,
            (media_file_id,),
        )
        media = cursor.fetchone()
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    return profile_photo_content_response(media)


@app.get("/api/admin/filter-options")
def admin_filter_options(_admin: str = Depends(require_admin)):
    with db_cursor() as (_, cursor):
        cursor.execute("SELECT role AS value, COUNT(*) AS count FROM profiles GROUP BY role ORDER BY count DESC")
        roles = cursor.fetchall()
        cursor.execute("SELECT status AS value, COUNT(*) AS count FROM profiles GROUP BY status ORDER BY count DESC")
        profile_statuses = cursor.fetchall()
        cursor.execute(
            """
            SELECT JSON_UNQUOTE(JSON_EXTRACT(data, '$.profileType')) AS value, COUNT(*) AS count
            FROM profiles
            WHERE JSON_UNQUOTE(JSON_EXTRACT(data, '$.profileType')) IS NOT NULL
              AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.profileType')) <> ''
            GROUP BY value
            ORDER BY count DESC
            """
        )
        profile_types = cursor.fetchall()
        cursor.execute(
            """
            SELECT JSON_UNQUOTE(JSON_EXTRACT(data, '$.country')) AS value, COUNT(*) AS count
            FROM profiles
            WHERE JSON_UNQUOTE(JSON_EXTRACT(data, '$.country')) IS NOT NULL
              AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.country')) <> ''
            GROUP BY value
            ORDER BY count DESC
            LIMIT 250
            """
        )
        user_countries = cursor.fetchall()
        cursor.execute("SELECT country AS value, COUNT(*) AS count FROM clinics WHERE country IS NOT NULL AND country <> '' GROUP BY country ORDER BY count DESC LIMIT 250")
        clinic_countries = cursor.fetchall()
        cursor.execute("SELECT country AS value, COUNT(*) AS count FROM lawyers WHERE country IS NOT NULL AND country <> '' GROUP BY country ORDER BY count DESC LIMIT 250")
        lawyer_countries = cursor.fetchall()
        cursor.execute("SELECT status AS value, COUNT(*) AS count FROM clinics GROUP BY status ORDER BY count DESC")
        clinic_statuses = cursor.fetchall()
        cursor.execute("SELECT status AS value, COUNT(*) AS count FROM lawyers GROUP BY status ORDER BY count DESC")
        lawyer_statuses = cursor.fetchall()
        cursor.execute("SELECT status AS value, COUNT(*) AS count FROM app_entities GROUP BY status ORDER BY count DESC LIMIT 100")
        entity_statuses = cursor.fetchall()
        cursor.execute(
            """
            SELECT JSON_UNQUOTE(JSON_EXTRACT(data, '$.group')) AS value, COUNT(*) AS count
            FROM app_entities
            WHERE entity_type = 'setting'
              AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.group')) IS NOT NULL
            GROUP BY value
            ORDER BY value ASC
            """
        )
        settings_groups = cursor.fetchall()
    return {
        "roles": roles,
        "profileStatuses": profile_statuses,
        "profileTypes": profile_types,
        "userCountries": user_countries,
        "clinicCountries": clinic_countries,
        "lawyerCountries": lawyer_countries,
        "clinicStatuses": clinic_statuses,
        "lawyerStatuses": lawyer_statuses,
        "entityStatuses": entity_statuses,
        "settingsGroups": settings_groups,
    }


ADMIN_MUTATION_TABLES: dict[str, dict[str, Any]] = {
    "users": {
        "table": "profiles",
        "fields": {"display_name", "role", "status", "data"},
        "archive": {"status": "DELETED"},
    },
    "profiles": {
        "table": "profiles",
        "fields": {"display_name", "role", "status", "data"},
        "archive": {"status": "DELETED"},
    },
    "clinics": {
        "table": "clinics",
        "fields": {"name", "country", "city", "status", "data"},
        "archive": {"status": "inactive"},
    },
    "lawyers": {
        "table": "lawyers",
        "fields": {"name", "country", "city", "status", "data"},
        "archive": {"status": "inactive"},
    },
    "articles": {
        "table": "articles",
        "fields": {"locale", "slug", "title", "excerpt", "body_html", "cover_url", "status", "meta", "published_at"},
        "archive": {"status": "ARCHIVED"},
    },
    "static-pages": {
        "table": "content_pages",
        "fields": {"locale", "slug", "title", "body_html", "meta", "status", "published_at"},
        "archive": {"status": "ARCHIVED"},
    },
}


def clean_mutation_values(view: str, values: dict[str, Any]) -> dict[str, Any]:
    allowed = ADMIN_MUTATION_TABLES[view]["fields"]
    cleaned: dict[str, Any] = {}
    for key, value in values.items():
        if key not in allowed:
            continue
        if key in {"data", "meta"}:
            cleaned[key] = json.dumps(value if value is not None else {}, ensure_ascii=False)
        elif key == "published_at" and value:
            try:
                cleaned[key] = database_datetime(datetime.fromisoformat(str(value).replace("Z", "+00:00")))
            except ValueError:
                cleaned[key] = value
        else:
            cleaned[key] = value
    return cleaned


def permanently_delete_profile(cursor, profile_id: int) -> dict[str, Any]:
    """Remove a member profile and the records owned by it in one transaction."""
    cursor.execute("SELECT id, role, email FROM profiles WHERE id = %s FOR UPDATE", (profile_id,))
    profile = cursor.fetchone()
    if not profile:
        raise HTTPException(status_code=404, detail="Item not found")
    if str(profile.get("role") or "").upper() in {"ADMIN", "SUPPORT"}:
        raise HTTPException(status_code=422, detail="Administrative and support accounts cannot be permanently deleted here")

    cursor.execute(
        "SELECT media_file_id FROM profile_photos WHERE profile_id = %s",
        (profile_id,),
    )
    media_file_ids = [int(row["media_file_id"]) for row in cursor.fetchall() if row.get("media_file_id")]

    # Conversations have child rows, so remove them before the conversation itself.
    cursor.execute("DELETE FROM member_calls WHERE caller_profile_id = %s OR callee_profile_id = %s", (profile_id, profile_id))
    cursor.execute(
        """
        DELETE FROM conversation_hidden
        WHERE profile_id = %s
           OR conversation_id IN (
             SELECT id FROM conversations WHERE profile_a_id = %s OR profile_b_id = %s
           )
        """,
        (profile_id, profile_id, profile_id),
    )
    cursor.execute(
        """
        DELETE FROM conversation_messages
        WHERE sender_profile_id = %s
           OR conversation_id IN (
             SELECT id FROM conversations WHERE profile_a_id = %s OR profile_b_id = %s
           )
        """,
        (profile_id, profile_id, profile_id),
    )
    cursor.execute("DELETE FROM conversations WHERE profile_a_id = %s OR profile_b_id = %s", (profile_id, profile_id))
    cursor.execute("DELETE FROM profile_matches WHERE profile_a_id = %s OR profile_b_id = %s", (profile_id, profile_id))
    cursor.execute("DELETE FROM profile_likes WHERE actor_profile_id = %s OR target_profile_id = %s", (profile_id, profile_id))
    cursor.execute("DELETE FROM profile_blocks WHERE blocker_profile_id = %s OR blocked_profile_id = %s", (profile_id, profile_id))
    cursor.execute("DELETE FROM support_welcome_deliveries WHERE profile_id = %s", (profile_id,))
    cursor.execute("DELETE FROM profile_photos WHERE profile_id = %s", (profile_id,))
    cursor.execute("SELECT id FROM local_users WHERE profile_id = %s", (profile_id,))
    local_user_ids = [int(row["id"]) for row in cursor.fetchall()]
    if local_user_ids:
        placeholders = ", ".join(["%s"] * len(local_user_ids))
        cursor.execute(f"DELETE FROM auth_sessions WHERE user_id IN ({placeholders})", local_user_ids)
        cursor.execute(f"DELETE FROM auth_action_tokens WHERE user_id IN ({placeholders})", local_user_ids)
        cursor.execute(f"DELETE FROM firebase_identities WHERE user_id IN ({placeholders})", local_user_ids)
    cursor.execute("DELETE FROM local_users WHERE profile_id = %s", (profile_id,))
    profile_ref = str(profile_id)
    cursor.execute(
        """
        DELETE FROM app_entities
        WHERE COALESCE(data->>'profileId', '') = %s
           OR COALESCE(data->>'actorProfileId', '') = %s
           OR COALESCE(data->>'targetProfileId', '') = %s
           OR COALESCE(data->>'viewerProfileId', '') = %s
           OR COALESCE(data->>'viewedProfileId', '') = %s
        """,
        (profile_ref, profile_ref, profile_ref, profile_ref, profile_ref),
    )
    if media_file_ids:
        placeholders = ", ".join(["%s"] * len(media_file_ids))
        cursor.execute(f"DELETE FROM media_files WHERE id IN ({placeholders})", media_file_ids)
    cursor.execute("DELETE FROM profiles WHERE id = %s", (profile_id,))
    return {"id": profile_id, "email": profile.get("email")}


@app.patch("/api/admin/item/{view}/{item_id}")
def admin_update_item(
    view: str,
    item_id: str,
    payload: AdminPatchPayload,
    actor: str = Depends(require_admin),
):
    if view == "moderation-photos":
        if not str(item_id).isdigit():
            raise HTTPException(status_code=422, detail="Photo moderation id must be numeric")
        numeric_item_id = int(item_id)
        decision = str(payload.values.get("status") or "").upper()
        if decision not in {"APPROVED", "REJECTED"}:
            raise HTTPException(status_code=422, detail="Choose APPROVED or REJECTED for a profile photo")
        reason = str(payload.values.get("reason") or ("MANUALLY_APPROVED" if decision == "APPROVED" else "MANUALLY_REJECTED")).strip()
        if decision == "REJECTED" and not reason:
            raise HTTPException(status_code=422, detail="A rejection reason is required")
        with db_cursor() as (_, cursor):
            cursor.execute(
                "SELECT data FROM app_entities WHERE id = %s AND entity_type = 'moderation_photo' LIMIT 1",
                (numeric_item_id,),
            )
            entity = cursor.fetchone()
        if not entity:
            raise HTTPException(status_code=404, detail="Photo moderation item not found")
        photo_id = int_or_none(as_dict(entity.get("data")).get("photoId"))
        if not photo_id:
            raise HTTPException(status_code=422, detail="The moderation item is not linked to a profile photo")
        updated = apply_profile_photo_moderation(
            photo_id,
            {"decision": decision, "reason": reason, "providerConfigured": False, "manual": True},
            actor=f"admin:{actor}",
        )
        return {"ok": True, "view": view, "id": numeric_item_id, "photoId": photo_id, "updated": updated}

    if view in ADMIN_MUTATION_TABLES:
        definition = ADMIN_MUTATION_TABLES[view]
        values = clean_mutation_values(view, payload.values)
        if not values:
            raise HTTPException(status_code=422, detail="No allowed fields to update")
        assignments = ", ".join([f"`{key}` = %s" for key in values])
        with db_cursor() as (conn, cursor):
            resolved_item_id: int | str = item_id
            if view in {"users", "profiles"}:
                resolved_item_id = resolve_admin_profile_id(cursor, item_id)
            elif not str(item_id).isdigit():
                raise HTTPException(status_code=422, detail="Item id must be numeric")
            params = [*values.values(), resolved_item_id]
            cursor.execute(f"UPDATE `{definition['table']}` SET {assignments}, updated_at = UTC_TIMESTAMP() WHERE id = %s", params)
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Item not found")
            audit(conn, actor, "update", view, int(resolved_item_id), values)
            conn.commit()
        return {"ok": True, "view": view, "id": resolved_item_id, "updated": values}

    entity_type = ADMIN_ENTITY_VIEWS.get(view)
    if not entity_type:
        raise HTTPException(status_code=404, detail="Admin view not found")
    allowed = {key: payload.values[key] for key in ["title", "status", "locale", "slug", "data"] if key in payload.values}
    if "data" in allowed:
        allowed["data"] = json.dumps(allowed["data"], ensure_ascii=False)
    if not allowed:
        raise HTTPException(status_code=422, detail="No allowed fields to update")
    assignments = ", ".join([f"`{key}` = %s" for key in allowed])
    params = [*allowed.values(), item_id, entity_type]
    with db_cursor() as (conn, cursor):
        cursor.execute(
            f"UPDATE app_entities SET {assignments}, updated_at = UTC_TIMESTAMP() WHERE id = %s AND entity_type = %s",
            params,
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Item not found")
        audit(conn, actor, "update", view, item_id, allowed)
        conn.commit()
    return {"ok": True, "view": view, "id": item_id, "updated": allowed}


@app.post("/api/admin/create/{view}")
def admin_create_item(
    view: str,
    payload: AdminCreatePayload,
    actor: str = Depends(require_admin),
):
    values = payload.values
    with db_cursor() as (conn, cursor):
        if view == "articles":
            cursor.execute(
                """
                INSERT INTO articles (locale, slug, title, excerpt, body_html, cover_url, status, meta, published_at, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, UTC_TIMESTAMP(), UTC_TIMESTAMP())
                """,
                (
                    values.get("locale") or "en",
                    values.get("slug") or f"article-{int(now_utc().timestamp())}",
                    values.get("title") or "Untitled article",
                    values.get("excerpt"),
                    values.get("body_html") or values.get("bodyHtml"),
                    values.get("cover_url") or values.get("coverUrl"),
                    values.get("status") or "draft",
                    json.dumps(values.get("meta") or {}, ensure_ascii=False),
                    values.get("published_at"),
                ),
            )
            item_id = cursor.lastrowid
        elif view == "static-pages":
            cursor.execute(
                """
                INSERT INTO content_pages (locale, slug, title, body_html, meta, status, published_at, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, UTC_TIMESTAMP(), UTC_TIMESTAMP())
                """,
                (
                    values.get("locale") or "en",
                    values.get("slug") or f"page-{int(now_utc().timestamp())}",
                    values.get("title") or "Untitled page",
                    values.get("body_html") or values.get("bodyHtml"),
                    json.dumps(values.get("meta") or {}, ensure_ascii=False),
                    values.get("status") or "draft",
                    values.get("published_at"),
                ),
            )
            item_id = cursor.lastrowid
        elif view == "categories":
            source_key = values.get("source_key") or values.get("slug") or f"category-{int(now_utc().timestamp())}"
            cursor.execute(
                """
                INSERT INTO app_entities (entity_type, source_key, title, status, locale, slug, data)
                VALUES ('category', %s, %s, %s, %s, %s, %s)
                """,
                (
                    source_key,
                    values.get("title") or values.get("name") or "Untitled category",
                    values.get("status") or "active",
                    values.get("locale"),
                    values.get("slug"),
                    json.dumps(values, ensure_ascii=False),
                ),
            )
            item_id = cursor.lastrowid
        elif view in ADMIN_ENTITY_VIEWS:
            entity_type = ADMIN_ENTITY_VIEWS[view]
            source_key = values.get("source_key") or values.get("slug") or f"{entity_type}-{int(now_utc().timestamp())}-{secrets.token_hex(3)}"
            cursor.execute(
                """
                INSERT INTO app_entities (entity_type, source_key, title, status, locale, slug, data)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    entity_type,
                    source_key,
                    values.get("title") or values.get("name") or f"Untitled {entity_type}",
                    values.get("status") or "active",
                    values.get("locale"),
                    values.get("slug"),
                    json.dumps(values.get("data") or values, ensure_ascii=False),
                ),
            )
            item_id = cursor.lastrowid
        else:
            raise HTTPException(status_code=404, detail="Create is not available for this view")
        audit(conn, actor, "create", view, item_id, values)
        conn.commit()
    return {"ok": True, "view": view, "id": item_id}


@app.delete("/api/admin/item/{view}/{item_id}")
def admin_delete_item(view: str, item_id: str, actor: str = Depends(require_admin)):
    if view in ADMIN_MUTATION_TABLES:
        if view == "users":
            with db_cursor() as (conn, cursor):
                resolved_item_id = resolve_admin_profile_id(cursor, item_id)
                deleted = permanently_delete_profile(cursor, resolved_item_id)
                audit(conn, actor, "permanent_delete", view, resolved_item_id, {"email": deleted.get("email")})
                conn.commit()
            return {"ok": True, "view": view, "id": resolved_item_id, "deleted": True}
        archive_values = ADMIN_MUTATION_TABLES[view].get("archive") or {}
        if not archive_values:
            raise HTTPException(status_code=422, detail="Delete is not configured for this view")
        definition = ADMIN_MUTATION_TABLES[view]
        if not str(item_id).isdigit():
            raise HTTPException(status_code=422, detail="Item id must be numeric")
        numeric_item_id = int(item_id)
        assignments = ", ".join([f"`{key}` = %s" for key in archive_values])
        params = [*archive_values.values(), numeric_item_id]
        with db_cursor() as (conn, cursor):
            cursor.execute(f"UPDATE `{definition['table']}` SET {assignments}, updated_at = UTC_TIMESTAMP() WHERE id = %s", params)
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Item not found")
            audit(conn, actor, "archive", view, numeric_item_id, archive_values)
            conn.commit()
        return {"ok": True, "view": view, "id": numeric_item_id, "archived": archive_values}
    entity_type = ADMIN_ENTITY_VIEWS.get(view)
    if not entity_type:
        raise HTTPException(status_code=404, detail="Admin view not found")
    with db_cursor() as (conn, cursor):
        cursor.execute(
            "UPDATE app_entities SET status = 'archived', updated_at = UTC_TIMESTAMP() WHERE id = %s AND entity_type = %s",
            (item_id, entity_type),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Item not found")
        audit(conn, actor, "archive", view, item_id, {"status": "archived"})
        conn.commit()
    return {"ok": True, "view": view, "id": item_id, "archived": {"status": "archived"}}


CLINIC_SERVICE_GROUPS = {
    "ivf_treatments": ("ivf", "icsi_ivf", "egg_donation_ivf", "sperm_donations_ivf", "genetic_testing_ivf", "own_egg_sperm_ivf", "embryo_donations_ivf"),
    "fertility_preservation": ("freezing", "egg_freezing", "sperm_freezing", "embryo_freezing"),
    "artificial_insemination": ("iui_intrauterine", "ici_intracervical", "iutpi_tuboperitoneal", "iti_intratubal"),
    "special_situations": ("women_over_46", "hiv_positive_female", "hiv_positive_male", "hepatitis_bc_male", "hepatitis_bc_female"),
}


def directory_name_search_value(value: str) -> str:
    return " ".join(str(value or "").strip().split())


@app.get("/api/public/clinics/options")
def public_clinic_options(locale: str = Query("en", min_length=2, max_length=16)):
    labels = {
        "en": ["IVF Treatments", "Fertility Preservation", "Artificial Insemination", "Special Situations"],
        "ru": ["ЭКО процедуры", "Сохранение фертильности", "Искусственная инсеминация", "Особые случаи"],
        "es": ["Tratamientos de FIV", "Preservación de la fertilidad", "Inseminación artificial", "Situaciones especiales"],
    }.get(locale, [])
    with db_cursor() as (_, cursor):
        cursor.execute("SELECT country AS value, COUNT(*) AS count FROM clinics WHERE status = 'active' AND country IS NOT NULL AND country <> '' GROUP BY country ORDER BY country")
        countries = cursor.fetchall()
        cursor.execute("SELECT data FROM clinics WHERE status = 'active'")
        language_counts: dict[str, int] = {}
        for row in cursor.fetchall():
            data = as_dict(row.get("data"))
            for value in data.get("languages") or []:
                code = str(value.get("code") if isinstance(value, dict) else value).strip().lower()
                if code:
                    language_counts[code] = language_counts.get(code, 0) + 1
    categories = [
        {"value": key, "label": labels[index] if index < len(labels) else key, "count": None}
        for index, key in enumerate(CLINIC_SERVICE_GROUPS)
    ]
    languages = [{"value": key, "label": key.upper(), "count": count} for key, count in sorted(language_counts.items())]
    return {"countries": countries, "serviceCategories": categories, "languages": languages}


@app.get("/api/public/clinics")
def public_clinics(
    limit: int = Query(12, ge=1, le=100),
    offset: int = Query(0, ge=0),
    q: str | None = Query(None, min_length=1, max_length=200),
    country: str | None = Query(None, min_length=1, max_length=128),
    city: str | None = Query(None, min_length=1, max_length=128),
    service: list[str] | None = Query(None),
    serviceCategory: list[str] | None = Query(None),
    language: str | None = Query(None, min_length=1, max_length=64),
):
    params: list[Any] = []
    where = "WHERE status = 'active'"
    if q:
        where += " AND POSITION(LOWER(%s) IN LOWER(COALESCE(name, ''))) > 0"
        params.append(directory_name_search_value(q))
    if country:
        where += " AND country = %s"
        params.append(country)
    if city:
        where += " AND city = %s"
        params.append(city)
    service_tokens = [str(value).strip() for value in (service or []) if str(value).strip()]
    for category in serviceCategory or []:
        service_tokens.extend(CLINIC_SERVICE_GROUPS.get(str(category).strip(), ()))
    service_tokens = list(dict.fromkeys(service_tokens))
    if service_tokens:
        where += " AND (" + " OR ".join(["CAST(data AS CHAR) LIKE %s"] * len(service_tokens)) + ")"
        params.extend([f"%{value}%" for value in service_tokens])
    if language:
        where += " AND CAST(data AS CHAR) LIKE %s"
        params.append(f'%"{language.strip().lower()}"%')
    with db_cursor() as (_, cursor):
        cursor.execute(f"SELECT COUNT(*) AS cnt FROM clinics {where}", params)
        total = int(cursor.fetchone()["cnt"])
        cursor.execute(
            f"""
            SELECT id, name, country, city, status, created_at, updated_at, data
            FROM clinics
            {where}
            ORDER BY name ASC, id ASC
            LIMIT %s OFFSET %s
            """,
            [*params, limit, offset],
        )
        items = [directory_public_record(row, "clinics") for row in cursor.fetchall()]
    return {"items": items, "limit": limit, "offset": offset, "total": total, "hasMore": offset + len(items) < total}


@app.get("/api/public/clinics/{slug}")
def public_clinic_detail(slug: str):
    with db_cursor() as (_, cursor):
        cursor.execute(
            """
            SELECT id, name, country, city, status, created_at, updated_at,
                   JSON_UNQUOTE(JSON_EXTRACT(data, '$.slug')) AS slug,
                   JSON_UNQUOTE(JSON_EXTRACT(data, '$.logoUrl')) AS logoUrl,
                   JSON_EXTRACT(data, '$.servicesCount') AS servicesCount,
                   JSON_UNQUOTE(JSON_EXTRACT(data, '$.partner.name')) AS partnerName,
                   data
            FROM clinics
            WHERE status = 'active'
              AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.slug')) = %s
            LIMIT 1
            """,
            (slug,),
        )
        row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Clinic not found")
    return directory_public_record(row, "clinics", include_contact=True)


@app.get("/api/public/lawyers/options")
def public_lawyer_options():
    with db_cursor() as (_, cursor):
        cursor.execute("SELECT country AS value, COUNT(*) AS count FROM lawyers WHERE status = 'active' AND country IS NOT NULL AND country <> '' GROUP BY country ORDER BY country")
        countries = cursor.fetchall()
        cursor.execute("SELECT data FROM lawyers WHERE status = 'active'")
        area_counts: dict[str, dict[str, Any]] = {}
        for row in cursor.fetchall():
            for area in as_dict(row.get("data")).get("practiceAreas") or []:
                if not isinstance(area, dict):
                    continue
                value = str(area.get("slug") or area.get("name") or "").strip()
                if not value:
                    continue
                entry = area_counts.setdefault(value, {"value": value, "label": str(area.get("name") or value), "count": 0})
                entry["count"] += 1
    return {"countries": countries, "practiceAreas": sorted(area_counts.values(), key=lambda item: item["label"].lower())}


@app.get("/api/public/lawyers")
def public_lawyers(
    limit: int = Query(12, ge=1, le=100),
    offset: int = Query(0, ge=0),
    q: str | None = Query(None, min_length=1, max_length=200),
    country: str | None = Query(None, min_length=1, max_length=128),
    city: str | None = Query(None, min_length=1, max_length=128),
    practiceArea: list[str] | None = Query(None),
):
    params: list[Any] = []
    where = "WHERE status = 'active'"
    if q:
        where += " AND POSITION(LOWER(%s) IN LOWER(COALESCE(name, ''))) > 0"
        params.append(directory_name_search_value(q))
    if country:
        where += " AND country = %s"
        params.append(country)
    if city:
        where += " AND city = %s"
        params.append(city)
    areas = [str(value).strip() for value in (practiceArea or []) if str(value).strip()]
    if areas:
        where += " AND (" + " OR ".join(["CAST(data AS CHAR) LIKE %s"] * len(areas)) + ")"
        params.extend([f"%{value}%" for value in areas])
    with db_cursor() as (_, cursor):
        cursor.execute(f"SELECT COUNT(*) AS cnt FROM lawyers {where}", params)
        total = int(cursor.fetchone()["cnt"])
        cursor.execute(
            f"""
            SELECT id, name, country, city, status, created_at, updated_at, data
            FROM lawyers
            {where}
            ORDER BY name ASC, id ASC
            LIMIT %s OFFSET %s
            """,
            [*params, limit, offset],
        )
        items = [directory_public_record(row, "lawyers") for row in cursor.fetchall()]
    return {"items": items, "limit": limit, "offset": offset, "total": total, "hasMore": offset + len(items) < total}


@app.get("/api/public/lawyers/{slug}")
def public_lawyer_detail(slug: str):
    with db_cursor() as (_, cursor):
        cursor.execute(
            """
            SELECT id, name, country, city, status, created_at, updated_at,
                   JSON_UNQUOTE(JSON_EXTRACT(data, '$.slug')) AS slug,
                   JSON_UNQUOTE(JSON_EXTRACT(data, '$.photoUrl')) AS photoUrl,
                   JSON_EXTRACT(data, '$.practiceAreasCount') AS practiceAreasCount,
                   data
            FROM lawyers
            WHERE status = 'active'
              AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.slug')) = %s
            LIMIT 1
            """,
            (slug,),
        )
        row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Lawyer not found")
    return directory_public_record(row, "lawyers", include_contact=True)


@app.get("/api/member/catalog")
def member_catalog(
    limit: int = Query(24, ge=1, le=100),
    offset: int = Query(0, ge=0),
    q: str | None = Query(None, min_length=1, max_length=200),
    country: list[str] | None = Query(None),
    city: str | None = Query(None, min_length=1, max_length=128),
    profileType: list[str] | None = Query(None),
    donorType: list[str] | None = Query(None),
    lookingFor: list[str] | None = Query(None),
    verifiedOnly: bool = Query(False),
    days: int | None = Query(None, ge=1, le=30),
    ageMin: int | None = Query(None, ge=18, le=100),
    ageMax: int | None = Query(None, ge=18, le=100),
    education: str | None = Query(None, min_length=1, max_length=128),
    religion: str | None = Query(None, min_length=1, max_length=128),
    ethnicity: str | None = Query(None, min_length=1, max_length=128),
    hairColor: str | None = Query(None, min_length=1, max_length=128),
    eyeColor: str | None = Query(None, min_length=1, max_length=128),
    bodyType: str | None = Query(None, min_length=1, max_length=128),
    user: dict[str, Any] = Depends(require_user),
):
    if ageMin is not None and ageMax is not None and ageMin > ageMax:
        raise HTTPException(status_code=422, detail="Minimum age cannot be greater than maximum age")
    if days is not None and days not in {1, 7, 30}:
        raise HTTPException(status_code=422, detail="Catalog period must be 1, 7, or 30 days")

    country_codes: list[str] = []
    for value in country or []:
        country_code = str(value or "").strip().upper()
        if len(country_code) != 2 or not country_code.isalpha():
            raise HTTPException(status_code=422, detail="Country must be an ISO alpha-2 code")
        if country_code not in country_codes:
            country_codes.append(country_code)
    city_name = str(city or "").strip()
    if city_name and len(country_codes) != 1:
        raise HTTPException(status_code=422, detail="City requires exactly one selected country")
    profile_types = catalog_enum_values(profileType, CATALOG_PROFILE_TYPES, "profileType")
    donor_types = catalog_enum_values(donorType, CATALOG_DONOR_TYPES, "donorType")
    looking_for = catalog_enum_values(lookingFor, CATALOG_LOOKING_FOR, "lookingFor")
    premium_filters = {
        "education": catalog_enum_value(education, CATALOG_EDUCATION, "education"),
        "religion": catalog_enum_value(religion, CATALOG_RELIGIONS, "religion"),
        "ethnicity": catalog_enum_value(ethnicity, CATALOG_ETHNICITIES, "ethnicity"),
        "hairColor": catalog_enum_value(hairColor, CATALOG_HAIR_COLORS, "hairColor"),
        "eyeColor": catalog_enum_value(eyeColor, CATALOG_EYE_COLORS, "eyeColor"),
        "bodyType": catalog_token(bodyType) if bodyType else None,
    }

    viewer_profile_id = require_profile_id(user)
    with db_cursor() as (_, cursor):
        viewer_profile = fetch_profile(cursor, viewer_profile_id)
        if any(value for value in premium_filters.values()) and not profile_is_premium(viewer_profile):
            raise HTTPException(status_code=402, detail="Premium is required for extended catalog filters")
        params: list[Any] = [viewer_profile_id, viewer_profile_id, viewer_profile_id, viewer_profile_id]
        where_parts = [
            "role = 'USER'",
            "status = 'ACTIVE'",
            "id <> %s",
            catalog_completion_sql(),
            "COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.visibleInCatalog')), JSON_UNQUOTE(JSON_EXTRACT(data, '$.isVisibleInCatalog')), 'true') <> 'false'",
            "COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.isSystemUser')), 'false') <> 'true'",
            """
            NOT EXISTS (
              SELECT 1
              FROM profile_blocks b
              WHERE b.status = 'ACTIVE'
                AND (
                  (b.blocker_profile_id = %s AND b.blocked_profile_id = profiles.id)
                  OR (b.blocker_profile_id = profiles.id AND b.blocked_profile_id = %s)
                )
            )
            """,
            """
            NOT EXISTS (
              SELECT 1
              FROM profile_likes own_like
              WHERE own_like.actor_profile_id = %s
                AND own_like.target_profile_id = profiles.id
                AND own_like.status = 'ACTIVE'
            )
            """,
        ]
        if q:
            where_parts.append("(display_name LIKE %s OR JSON_UNQUOTE(JSON_EXTRACT(data, '$.city')) LIKE %s OR JSON_UNQUOTE(JSON_EXTRACT(data, '$.country')) LIKE %s)")
            like = f"%{q}%"
            params.extend([like, like, like])
        if country_codes:
            placeholders = ", ".join(["%s"] * len(country_codes))
            where_parts.append(f"UPPER(JSON_UNQUOTE(JSON_EXTRACT(data, '$.country'))) IN ({placeholders})")
            params.extend(country_codes)
        if city_name:
            where_parts.append("JSON_UNQUOTE(JSON_EXTRACT(data, '$.city')) = %s")
            params.append(city_name)
        if profile_types:
            placeholders = ", ".join(["%s"] * len(profile_types))
            where_parts.append(f"UPPER(REPLACE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.profileType')), ' ', '_')) IN ({placeholders})")
            params.extend(profile_types)
        if donor_types:
            where_parts.append(
                "(" + " OR ".join(
                    ["JSON_CONTAINS(JSON_EXTRACT(data, '$.donorType'), JSON_QUOTE(%s)) = 1"] * len(donor_types)
                ) + ")"
            )
            params.extend(donor_types)
        if looking_for:
            where_parts.append(
                "(" + " OR ".join(
                    ["JSON_CONTAINS(JSON_EXTRACT(data, '$.lookingFor'), JSON_QUOTE(%s)) = 1"] * len(looking_for)
                ) + ")"
            )
            params.extend(looking_for)
        if verifiedOnly:
            where_parts.append("COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.isVerified')), 'false') = 'true'")
        if days is not None:
            where_parts.append("created_at >= %s")
            params.append(database_datetime(now_utc() - timedelta(days=days)))
        if ageMin is not None:
            where_parts.append("CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$.age')) AS UNSIGNED) >= %s")
            params.append(ageMin)
        if ageMax is not None:
            where_parts.append("CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$.age')) AS UNSIGNED) <= %s")
            params.append(ageMax)
        for key, value in premium_filters.items():
            if value:
                where_parts.append(f"JSON_UNQUOTE(JSON_EXTRACT(data, '$.{key}')) = %s")
                params.append(value)
        where = "WHERE " + " AND ".join(where_parts)
        cursor.execute(f"SELECT COUNT(*) AS cnt FROM profiles {where}", params)
        total = int(cursor.fetchone()["cnt"])
        cursor.execute(
            f"""
            SELECT id,
                   display_name AS "displayName",
                   role,
                   status,
                   JSON_UNQUOTE(JSON_EXTRACT(data, '$.id')) AS "sourceId",
                   JSON_UNQUOTE(JSON_EXTRACT(data, '$.country')) AS country,
                   JSON_UNQUOTE(JSON_EXTRACT(data, '$.city')) AS city,
                   JSON_UNQUOTE(JSON_EXTRACT(data, '$.avatarUrl')) AS "avatarUrl",
                   JSON_UNQUOTE(JSON_EXTRACT(data, '$.profileType')) AS "profileType",
                   JSON_UNQUOTE(JSON_EXTRACT(data, '$.age')) AS age,
                   JSON_UNQUOTE(JSON_EXTRACT(data, '$.dateOfBirth')) AS "dateOfBirth",
                   JSON_EXTRACT(data, '$.donorType') AS "donorType",
                   JSON_EXTRACT(data, '$.lookingFor') AS "lookingFor",
                   JSON_EXTRACT(data, '$.isVerified') AS "isVerified",
                   JSON_EXTRACT(data, '$.isPremium') AS "isPremium",
                   EXISTS (
                     SELECT 1
                     FROM profile_likes viewer_like
                     WHERE viewer_like.actor_profile_id = %s
                       AND viewer_like.target_profile_id = profiles.id
                       AND viewer_like.status = 'ACTIVE'
                    ) AS "likedByViewer",
                    created_at AS "createdAt"
            FROM profiles
            {where}
            ORDER BY
              CASE WHEN LOWER(COALESCE(
                JSON_UNQUOTE(JSON_EXTRACT(data, '$.isPremium')),
                JSON_UNQUOTE(JSON_EXTRACT(data, '$.premium')),
                'false'
              )) = 'true' THEN 0 ELSE 1 END,
              id DESC
            LIMIT %s OFFSET %s
            """,
            [viewer_profile_id, *params, limit, offset],
        )
        items = [normalize_row(row) for row in cursor.fetchall()]
        attach_profile_photos(cursor, items)
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@app.get("/api/member/catalog/filter-options")
def member_catalog_filter_options(
    country: str | None = Query(None, min_length=2, max_length=2),
    q: str | None = Query(None, max_length=128),
    limit: int | None = Query(None, ge=1, le=10000),
    user: dict[str, Any] = Depends(require_user),
):
    profile_id = require_profile_id(user)
    country_code = str(country or "").strip().upper()
    search = str(q or "").strip().casefold()
    countries = [dict(item) for item in CATALOG_LOCATIONS["countries"] if isinstance(item, dict)]
    city_candidates: dict[tuple[str, str], dict[str, Any]] = {}

    if country_code:
        for city in CATALOG_CITIES_BY_COUNTRY.get(country_code, []):
            if not isinstance(city, dict):
                continue
            name = str(city.get("name") or "").strip()
            region = str(city.get("region") or "").strip()
            if not name or (search and not name.casefold().startswith(search)):
                continue
            city_candidates[(name.casefold(), region.casefold())] = {
                "value": name,
                "label": name,
                "region": region,
                "placeId": str(city.get("placeId") or ""),
                "population": int_or_none(city.get("population")) or 0,
            }

    with db_cursor() as (_, cursor):
        profile = fetch_profile(cursor, profile_id)
        cursor.execute(
            f"""
            SELECT UPPER(JSON_UNQUOTE(JSON_EXTRACT(data, '$.country'))) AS value, COUNT(*) AS count
            FROM profiles
            WHERE role = 'USER' AND status = 'ACTIVE'
              AND {catalog_completion_sql()}
              AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.country')) IS NOT NULL
              AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.country')) NOT IN ('', 'null')
            GROUP BY value
            """
        )
        available_country_counts = {str(row["value"]): int(row["count"]) for row in cursor.fetchall() if row.get("value")}
        if country_code:
            city_params: list[Any] = [country_code]
            city_where = "UPPER(JSON_UNQUOTE(JSON_EXTRACT(data, '$.country'))) = %s"
            if search:
                city_where += " AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.city')) LIKE %s"
                city_params.append(f"{str(q or '').strip()}%")
            cursor.execute(
                f"""
                SELECT JSON_UNQUOTE(JSON_EXTRACT(data, '$.city')) AS value, COUNT(*) AS count
                FROM profiles
                WHERE role = 'USER' AND status = 'ACTIVE'
                  AND {catalog_completion_sql()}
                  AND {city_where}
                  AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.city')) IS NOT NULL
                  AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.city')) NOT IN ('', 'null')
                GROUP BY value
                ORDER BY count DESC, value ASC
                """,
                city_params,
            )
            for row in cursor.fetchall():
                name = str(row.get("value") or "").strip()
                if not name:
                    continue
                city_candidates.setdefault(
                    (name.casefold(), ""),
                    {"value": name, "label": name, "region": "", "placeId": "", "population": 0},
                )

    for item in countries:
        item["count"] = available_country_counts.get(str(item.get("value") or "").upper(), 0)
    known_country_codes = {str(item.get("value") or "").upper() for item in countries}
    for code, count in available_country_counts.items():
        if code not in known_country_codes:
            countries.append({"value": code, "label": code, "count": count})
    countries.sort(key=lambda item: str(item.get("label") or item.get("value") or "").casefold())

    cities = list(city_candidates.values())
    cities.sort(
        key=lambda item: (
            0 if search and str(item["label"]).casefold().startswith(search) else 1,
            -int(item.get("population") or 0),
            str(item["label"]).casefold(),
            str(item.get("region") or "").casefold(),
        )
    )
    for item in cities:
        item.pop("population", None)

    return {
        "countries": countries,
        "cities": cities if limit is None else cities[:limit],
        "country": country_code or None,
        "isPremium": profile_is_premium(profile),
        "attribution": {
            "name": CATALOG_LOCATIONS["source"],
            "url": CATALOG_LOCATIONS["sourceUrl"],
            "license": CATALOG_LOCATIONS["license"],
        },
    }


@app.get("/api/member/catalog/{profile_id}")
def member_catalog_detail(
    profile_id: str,
    background_tasks: BackgroundTasks,
    user: dict[str, Any] = Depends(require_user),
):
    viewer_profile_id = require_profile_id(user)
    notify_profile_view = False
    target_profile_id = viewer_profile_id
    with db_cursor() as (conn, cursor):
        target_profile_id = resolve_profile_id(cursor, profile_id)
        if target_profile_id == viewer_profile_id:
            profile = fetch_profile(cursor, target_profile_id)
        else:
            if has_active_block(cursor, viewer_profile_id, target_profile_id):
                raise HTTPException(status_code=404, detail="Profile not found")
            profile = fetch_profile(cursor, target_profile_id)
            if not profile_is_visible_in_catalog(profile):
                raise HTTPException(status_code=404, detail="Profile not found")
            notify_profile_view = record_profile_view(cursor, viewer_profile_id, target_profile_id)
            conn.commit()
        item = public_profile_summary(profile)
        if item:
            attach_profile_photos(cursor, [item])
            cursor.execute(
                """
                SELECT EXISTS (
                  SELECT 1
                  FROM profile_likes
                  WHERE actor_profile_id = %s
                    AND target_profile_id = %s
                    AND status = 'ACTIVE'
                ) AS liked_by_viewer
                """,
                (viewer_profile_id, target_profile_id),
            )
            item["likedByViewer"] = bool(cursor.fetchone()["liked_by_viewer"])
    if not item:
        raise HTTPException(status_code=404, detail="Profile not found")
    if notify_profile_view:
        background_tasks.add_task(
            send_profile_notification,
            target_profile_id,
            "PROFILE_VIEW",
            str(user.get("display_name") or "").strip(),
        )
    return item


@app.get("/api/public/catalog")
def public_catalog(
    limit: int = Query(24, ge=1, le=100),
    offset: int = Query(0, ge=0),
    q: str | None = Query(None, min_length=1, max_length=200),
    country: str | None = Query(None, min_length=1, max_length=128),
    city: str | None = Query(None, min_length=1, max_length=128),
    user: dict[str, Any] | None = Depends(optional_user),
):
    viewer_profile_id = require_profile_id(user) if user else None
    params: list[Any] = []
    where_parts = [
        "role = 'USER'",
        "status = 'ACTIVE'",
        catalog_completion_sql(),
        "COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.visibleInCatalog')), 'true') <> 'false'",
        "COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.isSystemUser')), 'false') <> 'true'",
    ]
    if viewer_profile_id:
        where_parts.append("id <> %s")
        params.append(viewer_profile_id)
        where_parts.append(
            """
            NOT EXISTS (
              SELECT 1
              FROM profile_blocks b
              WHERE b.status = 'ACTIVE'
                AND (
                  (b.blocker_profile_id = %s AND b.blocked_profile_id = profiles.id)
                  OR (b.blocker_profile_id = profiles.id AND b.blocked_profile_id = %s)
                )
            )
            """
        )
        params.extend([viewer_profile_id, viewer_profile_id])
    if q:
        where_parts.append("(display_name LIKE %s OR JSON_UNQUOTE(JSON_EXTRACT(data, '$.city')) LIKE %s OR JSON_UNQUOTE(JSON_EXTRACT(data, '$.country')) LIKE %s)")
        like = f"%{q}%"
        params.extend([like, like, like])
    if country:
        where_parts.append("JSON_UNQUOTE(JSON_EXTRACT(data, '$.country')) = %s")
        params.append(country)
    if city:
        where_parts.append("JSON_UNQUOTE(JSON_EXTRACT(data, '$.city')) = %s")
        params.append(city)
    where = "WHERE " + " AND ".join(where_parts)
    with db_cursor() as (_, cursor):
        cursor.execute(f"SELECT COUNT(*) AS cnt FROM profiles {where}", params)
        total = int(cursor.fetchone()["cnt"])
        cursor.execute(
            f"""
            SELECT id,
                   display_name AS "displayName",
                   role,
                   status,
                   JSON_UNQUOTE(JSON_EXTRACT(data, '$.id')) AS "sourceId",
                   JSON_UNQUOTE(JSON_EXTRACT(data, '$.country')) AS country,
                   JSON_UNQUOTE(JSON_EXTRACT(data, '$.city')) AS city,
                   JSON_UNQUOTE(JSON_EXTRACT(data, '$.avatarUrl')) AS "avatarUrl",
                   JSON_UNQUOTE(JSON_EXTRACT(data, '$.dateOfBirth')) AS "dateOfBirth",
                   JSON_EXTRACT(data, '$.donorType') AS "donorType",
                   JSON_EXTRACT(data, '$.recipientType') AS "recipientType",
                   JSON_EXTRACT(data, '$.isVerified') AS "isVerified",
                    JSON_EXTRACT(data, '$.isPremium') AS "isPremium",
                    created_at AS "createdAt"
            FROM profiles
            {where}
            ORDER BY
              CASE WHEN LOWER(COALESCE(
                JSON_UNQUOTE(JSON_EXTRACT(data, '$.isPremium')),
                JSON_UNQUOTE(JSON_EXTRACT(data, '$.premium')),
                'false'
              )) = 'true' THEN 0 ELSE 1 END,
              id DESC
            LIMIT %s OFFSET %s
            """,
            [*params, limit, offset],
        )
        items = [normalize_row(row) for row in cursor.fetchall()]
        attach_profile_photos(cursor, items)
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@app.get("/api/public/catalog/{profile_id}")
def public_catalog_detail(
    profile_id: str,
    background_tasks: BackgroundTasks,
    user: dict[str, Any] | None = Depends(optional_user),
):
    where = "JSON_UNQUOTE(JSON_EXTRACT(data, '$.id')) = %s"
    params: tuple[Any, ...] = (profile_id,)
    if str(profile_id).isdigit():
        where = "(id = %s OR JSON_UNQUOTE(JSON_EXTRACT(data, '$.id')) = %s)"
        params = (int(profile_id), profile_id)
    notify_profile_view = False
    viewed_profile_id = None
    with db_cursor() as (conn, cursor):
        cursor.execute(
            f"""
            SELECT id,
                   display_name AS "displayName",
                   role,
                   status,
                   JSON_UNQUOTE(JSON_EXTRACT(data, '$.country')) AS country,
                   JSON_UNQUOTE(JSON_EXTRACT(data, '$.city')) AS city,
                   JSON_UNQUOTE(JSON_EXTRACT(data, '$.avatarUrl')) AS "avatarUrl",
                   JSON_EXTRACT(data, '$.donorType') AS "donorType",
                   JSON_EXTRACT(data, '$.recipientType') AS "recipientType",
                   JSON_EXTRACT(data, '$.isVerified') AS "isVerified",
                   JSON_EXTRACT(data, '$.isPremium') AS "isPremium",
                   created_at AS "createdAt",
                   data
            FROM profiles
            WHERE {where}
              AND role = 'USER'
              AND status = 'ACTIVE'
              AND {catalog_completion_sql()}
              AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.visibleInCatalog')), 'true') <> 'false'
            LIMIT 1
            """,
            params,
        )
        row = cursor.fetchone()
        if row and user and user.get("profile_id"):
            viewer_profile_id = int_or_none(user.get("profile_id"))
            viewed_profile_id = int_or_none(row.get("id"))
            if viewer_profile_id and viewed_profile_id:
                if has_active_block(cursor, viewer_profile_id, viewed_profile_id):
                    row = None
                else:
                    notify_profile_view = record_profile_view(cursor, viewer_profile_id, viewed_profile_id)
                    conn.commit()
        if row:
            row = normalize_row(row)
            attach_profile_photos(cursor, [row])
    if not row:
        raise HTTPException(status_code=404, detail="Profile not found")
    if notify_profile_view and viewed_profile_id:
        background_tasks.add_task(
            send_profile_notification,
            viewed_profile_id,
            "PROFILE_VIEW",
            str(user.get("display_name") or "").strip(),
        )
    row["data"] = public_safe_data(row.get("data"))
    return row


@app.get("/api/public/articles")
def public_articles(
    locale: str = Query("en", min_length=2, max_length=16),
    category: str | None = Query(None, min_length=1, max_length=128),
    limit: int = Query(12, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    with db_cursor() as (_, cursor):
        cursor.execute(
            """
            SELECT id, locale, slug, title, excerpt, cover_url, status, meta, published_at, created_at, updated_at
            FROM articles
            WHERE locale = CASE
                WHEN EXISTS (SELECT 1 FROM articles locale_check WHERE locale_check.locale = %s AND locale_check.status = 'PUBLISHED') THEN %s
                ELSE 'en'
              END
              AND status = 'PUBLISHED'
            ORDER BY COALESCE(published_at, created_at) DESC, id DESC
            """,
            (locale, locale),
        )
        all_items = []
        for row in cursor.fetchall():
            item = normalize_row(row)
            meta = as_dict(item.get("meta"))
            item["meta"] = public_safe_data(meta)
            item["category"] = inferred_article_category(str(item.get("title") or ""), str(item.get("slug") or ""), meta)
            item["views"] = int_or_none(meta.get("views") or meta.get("viewCount") or meta.get("viewsCount")) or 0
            all_items.append(item)
    wanted = str(category or "").strip().lower()
    if wanted and wanted != "all":
        filtered = [item for item in all_items if str(item.get("category") or "").strip().lower() == wanted]
    else:
        filtered = all_items
    items = filtered[offset:offset + limit]
    return {
        "items": items,
        "limit": limit,
        "offset": offset,
        "total": len(filtered),
        "hasMore": offset + len(items) < len(filtered),
        "categories": ["ivf", "co-parenting", "sperm-donor", "fertility", "lgbtq"],
    }


@app.get("/api/public/articles/{locale}/{slug}")
def public_article(locale: str, slug: str):
    """Return one published article for the React public reader."""
    with db_cursor() as (_, cursor):
        cursor.execute(
            """
            SELECT id, locale, slug, title, excerpt, body_html, cover_url, status, meta,
                   published_at, created_at, updated_at
            FROM articles
            WHERE locale = CASE
                WHEN EXISTS (SELECT 1 FROM articles locale_check WHERE locale_check.locale = %s AND locale_check.status = 'PUBLISHED') THEN %s
                ELSE 'en'
              END
              AND slug = %s AND status = 'PUBLISHED'
            LIMIT 1
            """,
            (locale, locale, slug),
        )
        row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Article not found")
    item = normalize_row(row)
    item["meta"] = public_safe_data(as_dict(item.get("meta")))
    item["category"] = inferred_article_category(str(item.get("title") or ""), str(item.get("slug") or ""), item["meta"])
    return item


@app.get("/api/public/content-pages/{locale}/{slug}")
def public_content_page(locale: str, slug: str):
    with db_cursor() as (_, cursor):
        cursor.execute(
            """
            SELECT id, locale, slug, title, body_html, status, published_at, updated_at
            FROM content_pages
            WHERE locale = %s AND slug = %s AND status = 'PUBLISHED'
            LIMIT 1
            """,
            (locale, slug),
        )
        row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Content page not found")
    return normalize_row(row)


@app.get("/api/screenshot-sections")
def screenshot_sections():
    with db_cursor() as (_, cursor):
        cursor.execute(
            """
            SELECT id, section_name, png_count, created_at
            FROM screenshot_sections
            ORDER BY section_name ASC
            """
        )
        items = [normalize_row(row) for row in cursor.fetchall()]
    return {"items": items}
