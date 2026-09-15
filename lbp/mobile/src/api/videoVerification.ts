import { API_BASE_URL } from "../config";
import { getSessionToken } from "./session";
import { ApiError } from "./client";

// Premium roadmap step 9 - video-verification badge, distinct from the
// existing (Didit-provided) photo/ID verification in api/verification.ts.
// Reviewed by a human admin (see backend/main.py's
// member_submit_video_verification/admin_review_video_verification) - no
// automatic video-analysis provider exists, same honesty rule as Boost/
// the Co-Parenting Agreement elsewhere in this app.

export type VideoVerificationStatus = {
  videoVerified: boolean;
  videoVerifiedAt: string | null;
  requestId: number | null;
  requestStatus: "PENDING" | "APPROVED" | "DECLINED" | null;
};

export async function fetchVideoVerificationStatus(): Promise<VideoVerificationStatus> {
  const token = getSessionToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}/api/member/video-verification`, { headers });
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new ApiError(response.status, message || `Request failed (${response.status})`);
  }
  return (await response.json()) as VideoVerificationStatus;
}

type SubmitVideoVerificationResponse = {
  ok: true;
  requestId?: number;
  requestStatus: "PENDING" | "APPROVED" | "DECLINED";
  message: string;
};

// Same manual fetch + AbortController pattern as api/photos.ts's
// uploadPhoto() (not client.ts's api.upload() helper) so a hung/blocked
// upload fails with a specific message instead of the generic
// "Upload failed" text - a video is heavier than a photo so this gets a
// longer timeout (90s vs photos' 30s).
export async function submitVideoVerification(localUri: string, mimeType: string): Promise<SubmitVideoVerificationResponse> {
  const ext = mimeType === "video/quicktime" ? "mov" : mimeType === "video/webm" ? "webm" : "mp4";
  const filename = `video-verification-${Date.now()}.${ext}`;

  const formData = new FormData();
  // React Native's fetch polyfill accepts this {uri, name, type} object
  // form for file:// URIs from the camera/picker directly - unlike the
  // photo-upload path in photos.ts, there's no known content-type sniffing
  // issue reported for video parts here, so this stays the simpler form
  // rather than routing through localFileToBlob()/blob.slice() too.
  formData.append("file", { uri: localUri, name: filename, type: mimeType } as unknown as Blob);

  const token = getSessionToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/member/video-verification`, {
      method: "POST",
      headers,
      body: formData,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(0, "Upload timed out - check your connection and try again.");
    }
    const detail = err instanceof Error && err.message ? ` (${err.message})` : "";
    throw new ApiError(0, `Network error during upload - check your connection and try again.${detail}`);
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new ApiError(response.status, message || `Upload failed (${response.status})`);
  }
  return (await response.json()) as SubmitVideoVerificationResponse;
}
