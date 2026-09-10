import { API_BASE_URL } from "../config";
import { getSessionToken } from "./session";
import { ApiError, api, localFileToBlob, resolveMediaUrl } from "./client";
import type { ProfilePhoto } from "./types";

export async function fetchPhotos() {
  const res = await api.get<{ items: ProfilePhoto[] }>("/api/member/photos");
  // See client.ts's resolveMediaUrl - member_photos() can return a bare
  // relative path (its own CONCAT fallback, or a relative UPLOAD_URL_PREFIX)
  // that React Native's <Image> can't load on its own.
  return { items: res.items.map((item) => ({ ...item, publicUrl: resolveMediaUrl(item.publicUrl), avatarUrl: resolveMediaUrl(item.avatarUrl) })) };
}

export function deletePhoto(photoId: number) {
  return api.delete<{ ok: true }>(`/api/member/photos/${photoId}`);
}

// New POST /api/member/photos/{id}/primary (see backend/main.py,
// member_set_primary_photo) - swaps an already-approved gallery photo into
// position 0 and re-derives the profile's avatarUrl the same way deleting
// the old primary photo already did. Added alongside the mockup's
// "Primary photo / Avatar" split screen so "make this my main photo"
// is a real action instead of delete-and-reupload.
export function setPrimaryPhoto(photoId: number) {
  return api.post<{ ok: true; alreadyPrimary?: boolean; avatarUrl?: string | null }>(
    `/api/member/photos/${photoId}/primary`,
    {}
  );
}

// Not routed through src/api/client.ts's upload() because that helper
// assumes a JSON-shaped ApiError-friendly response but otherwise behaves the
// same - kept as its own function mainly so the position/local-file bits are
// obvious in one place. `localUri` is whatever expo-image-picker returned
// (a file:// URI).
//
// member_upload_photo() in main.py replies with
// {"ok": true, "photo": {id, publicUrl, position, status, uploadStatus,
// moderationStatus, moderationReason, avatarUrl}, ...} - the photo is
// nested, and even then it doesn't carry created_at/updated_at (those only
// come back from GET /api/member/photos). This unwraps "photo" and fills in
// the two missing timestamps locally so callers get a real ProfilePhoto.
type UploadPhotoResponse = {
  ok: true;
  photo: Omit<ProfilePhoto, "created_at" | "updated_at">;
};

export async function uploadPhoto(localUri: string, position: number): Promise<ProfilePhoto> {
  const filename = localUri.split("/").pop() || `photo-${Date.now()}.jpg`;
  const match = /\.(\w+)$/.exec(filename);
  const ext = match ? match[1].toLowerCase() : "jpg";
  const mime = ext === "webp" ? "image/webp" : ext === "png" ? "image/png" : "image/jpeg";

  const formData = new FormData();
  formData.append("position", String(position));
  // See client.ts's localFileToBlob for why this can't be the old
  // {uri, name, type} object form anymore. That fixed "Unsupported
  // FormDataPart implementation", but Alena then hit a NEW error one step
  // further in: "Only JPEG, PNG and WebP images are supported" - the
  // upload now reaches the server, but the multipart part's Content-Type
  // is whatever `blob.type` came back as from fetch(localUri).blob(), and
  // on a picker-supplied file:// / content:// URI that's frequently blank
  // or "application/octet-stream" rather than a real image/* type - RN/
  // Expo's fetch polyfill doesn't reliably sniff it from the URI alone.
  // .slice() with an explicit contentType rewrites the blob's reported
  // type (derived from the actual filename extension above) without
  // recopying the bytes, so the multipart part always carries a real
  // image/* Content-Type the backend's JPEG/PNG/WebP check accepts.
  const rawBlob = await localFileToBlob(localUri);
  const blob = rawBlob.type && rawBlob.type.startsWith("image/") ? rawBlob : rawBlob.slice(0, rawBlob.size, mime);
  formData.append("file", blob, filename);

  const token = getSessionToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  // Deliberately NOT setting Content-Type - fetch/RN sets the correct
  // multipart boundary itself when the body is a FormData instance.

  // Alena has reported "Upload failed. Please try again." repeatedly - that
  // generic text is what PhotosScreen.tsx shows for any error that ISN'T a
  // real ApiError (see its catch block), which only happens if something
  // fails before we get a real HTTP response: fetch() itself throwing
  // (network drop) or this request simply hanging with no server response.
  // Neither case gave any real diagnostic signal before - a bare "Upload
  // failed" could mean anything. Two changes to actually narrow it down
  // next time it happens: (1) a 30s timeout via AbortController, so a
  // hung/blocked upload fails fast with a distinct message instead of
  // sitting silently; (2) catching fetch's own throw and re-throwing as a
  // real ApiError with a specific message, so PhotosScreen's Alert shows
  // something we can act on instead of the generic fallback.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/member/photos`, {
      method: "POST",
      headers,
      body: formData,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(0, "Upload timed out - check your connection and try again.");
    }
    // See client.ts's request() for why: append the real underlying error
    // instead of only ever showing this same guess-text.
    const detail = err instanceof Error && err.message ? ` (${err.message})` : "";
    throw new ApiError(0, `Network error during upload - check your connection and try again.${detail}`);
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new ApiError(response.status, message || `Upload failed (${response.status})`);
  }
  const res = (await response.json()) as UploadPhotoResponse;
  const now = new Date().toISOString();
  return { ...res.photo, publicUrl: resolveMediaUrl(res.photo.publicUrl), avatarUrl: resolveMediaUrl(res.photo.avatarUrl), created_at: now, updated_at: now };
}


// New POST /api/member/avatar (already existed on the backend, unused by
// any client until now) - uploads a separate cropped image tied to the
// current primary (position 0) photo, which is what actually becomes the
// profile's avatarUrl (see backend/main.py member_upload_avatar /
// apply_avatar_crop_moderation). Mirrors uploadPhoto's manual fetch +
// timeout handling rather than api.upload() for the same reason: a real,
// specific error instead of a generic "Upload failed" if the request never
// gets a response.
type UploadAvatarResponse = {
  ok: true;
  avatarUrl: string | null;
  moderation: { status: string; reason: string | null; providerConfigured: boolean };
};

export async function uploadAvatar(localUri: string): Promise<UploadAvatarResponse> {
  const filename = localUri.split("/").pop() || `avatar-${Date.now()}.jpg`;
  const match = /\.(\w+)$/.exec(filename);
  const ext = match ? match[1].toLowerCase() : "jpg";
  const mime = ext === "webp" ? "image/webp" : ext === "png" ? "image/png" : "image/jpeg";

  const formData = new FormData();
  // See uploadPhoto above for why the blob's type gets forced here - same
  // "Only JPEG, PNG and WebP images are supported" failure applies to the
  // avatar endpoint too.
  const rawBlob = await localFileToBlob(localUri);
  const blob = rawBlob.type && rawBlob.type.startsWith("image/") ? rawBlob : rawBlob.slice(0, rawBlob.size, mime);
  formData.append("file", blob, filename);

  const token = getSessionToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/member/avatar`, {
      method: "POST",
      headers,
      body: formData,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(0, "Upload timed out - check your connection and try again.");
    }
    // See client.ts's request() for why: append the real underlying error
    // instead of only ever showing this same guess-text.
    const detail = err instanceof Error && err.message ? ` (${err.message})` : "";
    throw new ApiError(0, `Network error during upload - check your connection and try again.${detail}`);
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new ApiError(response.status, message || `Upload failed (${response.status})`);
  }
  const res = (await response.json()) as UploadAvatarResponse;
  return { ...res, avatarUrl: resolveMediaUrl(res.avatarUrl) };
}
