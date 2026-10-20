"""Read storage metadata without downloading complete remote files."""
from functools import lru_cache
from ipaddress import ip_address
from pathlib import Path
import re
import socket
import time
import urllib.error
import urllib.parse
import urllib.request


def storage_file_path(key: str, uploads: Path, private: Path) -> Path | None:
    key = str(key or "").strip().lstrip("/")
    if not key or ".." in Path(key).parts:
        return None
    root = private if key.startswith("quarantine/") else uploads
    relative = key.removeprefix("quarantine/")
    target = (root / relative).resolve()
    if not target.is_relative_to(root.resolve()) or target == root.resolve():
        return None
    return target


def public_storage_url(url: str) -> str:
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Invalid storage URL")
    if parsed.port not in {None, 80, 443}:
        raise ValueError("Invalid storage port")
    addresses = socket.getaddrinfo(parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM)
    if not addresses or any(not ip_address(item[4][0]).is_global for item in addresses):
        raise ValueError("Storage URL must use a public address")
    return url


class StorageRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        return super().redirect_request(request, fp, code, message, headers, public_storage_url(new_url))


@lru_cache(maxsize=8192)
def remote_storage_facts(url: str, epoch: int) -> tuple[bool | None, int | None]:
    del epoch
    try:
        public_storage_url(url)
        opener = urllib.request.build_opener(StorageRedirect())
        request = urllib.request.Request(url, headers={"User-Agent": "LetsBeParents/1.0", "Accept-Encoding": "identity", "Range": "bytes=0-0"})
        with opener.open(request, timeout=3) as response:
            response.read(1)
            content_range = str(response.headers.get("Content-Range") or "")
            total = re.search(r"/(\d+)$", content_range)
            length = str(response.headers.get("Content-Length") or "")
            size = int(total[1]) if total else int(length) if length.isdigit() and response.status == 200 else None
            return True, size
    except urllib.error.HTTPError as error:
        return (False, None) if error.code in {404, 410} else (None, None)
    except (urllib.error.URLError, OSError, TimeoutError, ValueError):
        return None, None


def inspect_storage_file(key: str, url: str, declared_bytes: int | None, uploads: Path, private: Path, *, probe: bool = False) -> dict:
    path = storage_file_path(key, uploads, private)
    try:
        if path and path.is_file():
            return {"exists": True, "bytes": path.stat().st_size, "sizeKnown": True, "sizeSource": "filesystem"}
    except OSError:
        pass
    declared = int(declared_bytes or 0)
    exists, actual = (None, None)
    if str(url or "").startswith(("https://", "http://")):
        epoch = int(time.monotonic() // 300)
        if probe:
            exists, actual = remote_storage_facts(str(url), epoch)
        else:
            exists, actual = _STORAGE_FACTS.get((str(url), epoch), (None, None))
        _STORAGE_FACTS[(str(url), epoch)] = (exists, actual)
        if len(_STORAGE_FACTS) > 10000:
            for cache_key in list(_STORAGE_FACTS):
                if cache_key[1] != epoch:
                    _STORAGE_FACTS.pop(cache_key, None)
    elif not str(url or "").startswith("/api/"):
        exists = False
    return {"exists": exists, "bytes": actual if actual is not None else declared, "sizeKnown": actual is not None or declared > 0, "sizeSource": "remote" if actual is not None else "metadata" if declared > 0 else "unknown"}


_STORAGE_FACTS: dict[tuple[str, int], tuple[bool | None, int | None]] = {}


def clear_storage_file_facts() -> None:
    remote_storage_facts.cache_clear()
    _STORAGE_FACTS.clear()
