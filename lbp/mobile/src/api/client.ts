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
    // screen's existing error handling covers it too.
    throw new ApiError(0, "Network request failed - check EXPO_PUBLIC_API_BASE_URL and that the backend is reachable from your phone.");
  }

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new ApiError(response.status, message || `Request failed (${response.status})`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
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
