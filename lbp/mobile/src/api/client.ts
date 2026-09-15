import { API_BASE_URL } from "../config";
import { getSessionToken } from "./session";
// Same "download the bytes ourselves, then hand them to the OS share sheet"
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

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

// ROOT CAUSE (Sept 2026) for "photos don't show" across THREE separate
// surfaces Alena reported independently - profile avatar (blank circle on
// Profile screen), article cover images in Knowledge Hub (placeholder
// book icon on every card), and a photo sent in chat (no image bubble at
// all in the "Onelona" conversation). All three come from the exact same
// bug: resolveMediaUrl() above was written specifically to fix this class
// of problem, but was only ever WIRED UP inside api/photos.ts - every
// other endpoint in this file (member_likes/catalog/profile/articles/
// messages, all of which can return a relative "/uploads/..." or
// "/api/.../content" style URL, same as photos always could) still handed
// that raw relative path straight to <Image>, which - unlike a browser -
// has no page origin to resolve a relative URL against, so it just fails
// to load, silently, with nothing rendered. Rather than repeat the same
// resolveMediaUrl() call by hand at every call site across a dozen API
// modules (easy to miss one, exactly how this happened three times), this
// walks every JSON response ONCE, centrally, and fixes up every field
// whose name ends in "Url" if its value looks like a relative path -
// covers avatarUrl, photoUrl, coverImageUrl, logoUrl, contentUrl, and any
// future one, with no per-endpoint code needed.
// FOLLOW-UP (Sept 2026): the "url"-suffix check above catches an object
// field like avatarUrl/photoUrl directly, but member_catalog_detail()'s
// attach_profile_photos() returns a plain array of raw path STRINGS under
// the key "photos" (["/uploads/x.jpg", ...], no per-item "Url" key at
// all) - Alena's own profile preview screen ("Preview my profile") showed
// a blank photo box because of exactly this: the array branch below used
// to recurse into each string with no idea which key it came from, so a
// bare relative string inside an array was never eligible for the
// suffix check and passed through unresolved. Threads the enclosing
// key down through arrays (and objects, harmlessly unused there) so a
// string's own "did this come from a media-ish field" context survives
// one level of [ ] - covers "photos" specifically plus a few likely
// siblings (images/gallery/avatars) without hardcoding every endpoint.
function isMediaArrayKey(key: string | undefined): boolean {
  return !!key && /(photos?|images?|gallery|avatars?)$/i.test(key);
}

function resolveMediaUrlsDeep<T>(value: T, keyHint?: string): T {
  if (typeof value === "string") {
    if (isMediaArrayKey(keyHint) && value.startsWith("/") && !value.startsWith("//")) {
      return resolveMediaUrl(value) as T;
    }
    return value as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveMediaUrlsDeep(item, keyHint)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      // Case-insensitive suffix match: covers avatarUrl, mediaUrl, photoUrl
      // (camelCase, most of this API) AND cover_url (snake_case - see
      // ArticleSummary in api/articles.ts, which mirrors main.py's raw
      // column name directly instead of the usual camelCase convention).
      if (typeof val === "string" && /url$/i.test(key) && val.startsWith("/") && !val.startsWith("//")) {
        result[key] = resolveMediaUrl(val);
      } else {
        result[key] = resolveMediaUrlsDeep(val, key);
      }
    }
    return result as T;
  }
  return value;
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
  const json = await response.json();
  return resolveMediaUrlsDeep(json) as T;
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

// Family Room documents and Pregnancy Room entries are served from
// private, auth-gated endpoints (/api/member/family-room/.../content) -
// every other request in this file gets its "Authorization: Bearer
// <token>" header from request() above, but Linking.openURL hands the URL
// off to a completely separate app (the system browser / a viewer app),
// which has no way to attach that header, and - since these endpoints'
// contentUrl is a bare relative path like the resolveMediaUrl comment
// above already flags for photos - no scheme/host to even resolve
// against either. That combination is exactly Android's "Couldn't open
// this file" dialog (nothing before this could actually launch), and on
// iOS would just as reliably fail differently (relative URL, then a 401
// from the real host even once made absolute). Downloading the bytes
// ourselves with the header attached, to a local cache file, and handing
// THAT off to the share sheet is the same pattern already proven working
// for public downloads in ResourceToolScreen.tsx / CompatibilityQuizScreen.tsx
// - just adding the auth header downloadAsync also accepts.
export async function downloadAndOpenPrivateFile(path: string, suggestedName: string, mimeType?: string): Promise<void> {
  const token = getSessionToken();
  const remoteUrl = /^https?:\/\//i.test(path) ? path : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  if (new URL(remoteUrl).origin !== new URL(API_BASE_URL).origin) {
    throw new ApiError(422, "Private files must be downloaded from LetsBeParents.");
  }
  const safeName = (suggestedName || "file").replace(/[\\/]/g, "_");
  const localUri = `${FileSystem.cacheDirectory}${Date.now()}-${safeName}`;
  let result: FileSystem.FileSystemDownloadResult;
  try {
    result = await FileSystem.downloadAsync(remoteUrl, localUri, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  } catch (err) {
    const detail = err instanceof Error && err.message ? ` (${err.message})` : "";
    throw new ApiError(0, `Couldn't download this file${detail}`);
  }
  if (result.status >= 400) {
    throw new ApiError(result.status, `Couldn't download this file (${result.status})`);
  }
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new ApiError(0, "Sharing/opening files isn't available on this device.");
  }
  // Without an explicit mimeType, Android's share-sheet has to guess the
  // type from the uri's extension alone - and on some OEM builds, when
  // that guess comes up empty (a name with no/unexpected extension, or a
  // mime the guesser doesn't recognize), shareAsync resolves normally
  // without ever showing anything, which reads as "nothing happens" when
  // tapped - no error, no chooser, no file. Passing the real mimeType we
  // already have from the API response sidesteps the guess entirely.
  try {
    await Sharing.shareAsync(result.uri, mimeType ? { mimeType } : undefined);
  } catch (err) {
    const detail = err instanceof Error && err.message ? ` (${err.message})` : "";
    throw new ApiError(0, `Couldn't open this file${detail}`);
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body === undefined ? undefined : JSON.stringify(body) }),
  // Optional body added for push token unregistration (item 16) - the
  // token itself has to travel in the request since there's no
  // per-token URL to DELETE (a device can have several). Every existing
  // caller passes no second argument, so this is unchanged for them.
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "DELETE", body: body === undefined ? undefined : JSON.stringify(body) }),
  upload: <T>(path: string, body: FormData) => request<T>(path, { method: "POST", body }),
};
