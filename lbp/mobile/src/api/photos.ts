import { API_BASE_URL } from "../config";
import { getSessionToken } from "./session";
import { ApiError, api } from "./client";
import type { ProfilePhoto } from "./types";

export function fetchPhotos() {
  return api.get<{ items: ProfilePhoto[] }>("/api/member/photos");
}

export function deletePhoto(photoId: number) {
  return api.delete<{ ok: true }>(`/api/member/photos/${photoId}`);
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
  const mime = ext === "png" ? "image/png" : "image/jpeg";

  const formData = new FormData();
  formData.append("position", String(position));
  // React Native's fetch/FormData accepts this {uri, name, type} object form
  // for a file field - it is NOT a real Blob, but RN's networking layer
  // knows to read it from disk. This is the standard RN upload pattern.
  formData.append("file", { uri: localUri, name: filename, type: mime } as unknown as Blob);

  const token = getSessionToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  // Deliberately NOT setting Content-Type - fetch/RN sets the correct
  // multipart boundary itself when the body is a FormData instance.

  const response = await fetch(`${API_BASE_URL}/api/member/photos`, {
    method: "POST",
    headers,
    body: formData,
  });
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new ApiError(response.status, message || `Upload failed (${response.status})`);
  }
  const res = (await response.json()) as UploadPhotoResponse;
  const now = new Date().toISOString();
  return { ...res.photo, created_at: now, updated_at: now };
}
