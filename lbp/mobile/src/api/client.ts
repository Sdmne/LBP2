import { API_BASE_URL } from "../config";
import { getSessionToken } from "./session";

// Mirrors the shape of the real web app's own client (lbp/frontend/src/api.ts)
// on purpose, so the two stay easy to compare - the difference is just how
// each authenticates: the website relies on the browser sending its
// HttpOnly session cookie automatically ("credentials: same-origin"), this
// app can't see that cookie, so it sends "Authorization: Bearer <token>"
// instead, using the token captured at login (see src/api/session.ts).

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

// FastAPI error bodies are JSON ({"detail": "..."} for a plain
// HTTPException, or {"detail": [{"msg": "...", ...}, ...]} for a 422
// validation error) - request() used to hand the RAW response TEXT
// straight to ApiError, so every failed request in the app (this is a
// shared helper, not something specific to one screen) showed the raw
// JSON string in its Alert, e.g. {"detail":"Likes are irreversible. Block
// the profile to remove mutual interaction."} verbatim - confusing even
// though the backend's actual message underneath is perfectly readable.
// Pulls the human text out of the common shapes and falls back to the raw
// text only if none of them match (so an HTML error page or a plain-text
// 502 from a proxy still shows something instead of nothing).
function extractErrorMessage(raw: string): string {
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    const detail = parsed?.detail ?? parsed?.message ?? parsed?.error;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const msgs = detail.map((d) => (typeof d === "string" ? d : d?.msg)).filter(Boolean);
      if (msgs.length) return msgs.join(" ");
    }
  } catch {
    // Not JSON - fall through to the raw text.
  }
  return raw;
}

// member_photos()'s SQL has a fallback that CONCATs a bare relative path
// ("/api/member/photos/123/content") when a row's stored public_url is
// empty - and UPLOAD_URL_PREFIX itself defaults to "/uploads", also
// relative. That's fine for the website (a browser resolves a relative
// URL against its own page origin automatically), but React Native's
// <Image> component has no page origin to resolve against - a relative
// uri source just fails to load, silently, with nothing rendered. This is
// almost certainly Alena's "ни одно фото не показывает" (blank primary/
// additional-photo thumbnails) - PhotosScreen was passing these URLs to
// <Image> as-is. Prefixes API_BASE_URL onto any media URL that isn't
// already absolute; a no-op for URLs that already are (e.g. a real CDN/S3
// URL some photos already carry).
export function resolveMediaUrl<T extends string | null | undefined>(url: T): T {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return (API_BASE_URL + (url.startsWith("/") ? url : `/${url}`)) as T;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  const token = getSessionToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch (err) {
    // Network failure (backend unreachable, wrong URL, phone/computer not on
    // the same network, etc.) - surfaced as a normal ApiError so every
    // screen's existing error handling covers it too. Append the real
    // underlying error (err.message, e.g. "Network request failed" is RN's
    // own fetch error text - but on real devices it can also be a TLS,
    // timeout, or DNS-specific message) instead of only our own guess, so
    // the next time this happens the Alert on screen actually says why,
    // rather than always showing the same generic text no matter the cause.
    const detail = err instanceof Error && err.message ? ` (${err.message})` : "";
    throw new ApiError(0, `Network request failed - check EXPO_PUBLIC_API_BASE_URL and that the backend is reachable from your phone.${detail}`);
  }

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    throw new ApiError(response.status, extractErrorMessage(raw) || `Request failed (${response.status})`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

// Expo SDK 57's own fetch() implementation only accepts a real Blob (or
// something with a .bytes() method) as a FormData file part - see
// node_modules/expo/src/winter/fetch/convertFormData.ts. The classic React
// Native pattern of appending a plain {uri, name, type} object (which used
// to work fine against RN's own built-in fetch) makes it throw "Unsupported
// FormDataPart implementation" instead - the exact error behind Alena's
// repeated "network error" reports on photo upload, avatar upload AND
// family-room document upload, all three of which built their FormData
// this same old way. Fetching the local file's own uri and reading the
// response as a Blob produces the real Blob object every upload needs.
export async function localFileToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return await response.blob();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, body: FormData) => request<T>(path, { method: "POST", body }),
};
