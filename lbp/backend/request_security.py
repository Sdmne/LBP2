"""Database-backed request limits shared by all application workers."""

from __future__ import annotations

import hashlib
import ipaddress
import json
import math
import time
from collections.abc import Callable
from typing import Any


class ContactBodyLimitMiddleware:
    def __init__(self, app: Any, max_bytes: int = 65536):
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: dict, receive: Any, send: Any) -> None:
        if scope.get("type") != "http" or scope.get("path") != "/api/public/contact":
            await self.app(scope, receive, send)
            return

        async def reject(status: int) -> None:
            body = b'{"detail":"Contact request exceeds the size limit"}'
            await send({"type": "http.response.start", "status": status,
                        "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]})
            await send({"type": "http.response.body", "body": body})

        headers = dict(scope.get("headers", []))
        try:
            length = int(headers.get(b"content-length", b"0"))
        except ValueError:
            await reject(400)
            return
        if length < 0 or length > self.max_bytes:
            await reject(413)
            return
        chunks = []
        total = 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            total += len(chunk)
            if total > self.max_bytes:
                await reject(413)
                return
            chunks.append(chunk)
            if not message.get("more_body", False):
                break
        body = b"".join(chunks)
        consumed = False

        async def bounded_receive() -> dict:
            nonlocal consumed
            if not consumed:
                consumed = True
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()

        await self.app(scope, bounded_receive, send)


class RateLimitExceeded(Exception):
    def __init__(self, retry_after: float):
        self.retry_after = max(1, math.ceil(retry_after))


def request_ip(request: Any) -> str:
    peer = str(getattr(request.client, "host", "") or "").strip()
    try:
        address = ipaddress.ip_address(peer)
    except ValueError:
        return "unknown"
    if not (address.is_private or address.is_loopback):
        return str(address)
    # The application is reached through the private reverse-proxy network.
    # Proxies append the real peer; an attacker-controlled leftmost value
    # must never select the rate-limit bucket.
    forwarded = []
    for value in str(request.headers.get("x-forwarded-for") or "").split(","):
        try:
            forwarded.append(ipaddress.ip_address(value.strip()))
        except ValueError:
            continue
    for value in reversed(forwarded):
        if value.is_global:
            return str(value)
    return str(forwarded[-1] if forwarded else address)


def throttle_key(scope: str, client_ip: str, email: str = "") -> str:
    digest = hashlib.sha256(f"{scope}\0{client_ip}\0{email.strip().casefold()}".encode()).hexdigest()
    return f"{scope}:{digest}"


def _state(cursor: Any, key: str) -> dict[str, Any]:
    cursor.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (key,))
    cursor.execute(
        "SELECT data FROM app_entities WHERE entity_type = 'request_throttle' AND source_key = %s FOR UPDATE",
        (key,),
    )
    row = cursor.fetchone()
    data = (row or {}).get("data") or {}
    if isinstance(data, str):
        data = json.loads(data)
    return data if isinstance(data, dict) else {}


def _save(cursor: Any, key: str, data: dict[str, Any]) -> None:
    cursor.execute(
        """INSERT INTO app_entities (entity_type, source_key, title, status, data, created_at, updated_at)
           VALUES ('request_throttle', %s, 'Request limit', 'ACTIVE', %s::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (entity_type, source_key) DO UPDATE
           SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP""",
        (key, json.dumps(data)),
    )


def consume_window(db_cursor: Callable, key: str, limit: int, seconds: int) -> None:
    now = time.time()
    with db_cursor() as (conn, cursor):
        data = _state(cursor, key)
        attempts = [float(value) for value in data.get("attempts", []) if float(value) > now - seconds]
        if len(attempts) >= limit:
            raise RateLimitExceeded(attempts[0] + seconds - now)
        attempts.append(now)
        _save(cursor, key, {"attempts": attempts, "expiresAt": now + seconds})
        conn.commit()


def check_login_backoff(db_cursor: Callable, key: str) -> None:
    with db_cursor() as (_, cursor):
        data = _state(cursor, key)
        remaining = float(data.get("blockedUntil") or 0) - time.time()
        if remaining > 0:
            raise RateLimitExceeded(remaining)


def record_login_failure(db_cursor: Callable, key: str) -> None:
    now = time.time()
    with db_cursor() as (conn, cursor):
        data = _state(cursor, key)
        previous = float(data.get("lastFailure") or 0)
        failures = int(data.get("failures") or 0) if previous > now - 1800 else 0
        failures += 1
        pause = min(900, 60 * 2 ** min(4, max(0, failures - 5))) if failures >= 5 else 0
        _save(cursor, key, {"failures": failures, "lastFailure": now, "blockedUntil": now + pause, "expiresAt": now + 1800})
        conn.commit()


def clear_login_backoff(db_cursor: Callable, key: str) -> None:
    with db_cursor() as (conn, cursor):
        _state(cursor, key)
        _save(cursor, key, {"failures": 0, "blockedUntil": 0, "expiresAt": time.time()})
        conn.commit()
