export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export const ADMIN_AUTH_REQUIRED_EVENT = "lbp-admin-auth-required";

export type ApiClient = {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
  upload<T>(path: string, body: FormData): Promise<T>;
};

export function createApiClient(basePath = "/api"): ApiClient {
  const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const headers = new Headers(init.headers || {});
    if (typeof window !== "undefined" && path.startsWith("/partner/") && !headers.has("Authorization")) {
      const partnerToken = window.localStorage.getItem("lbp_partner_token");
      if (partnerToken) headers.set("Authorization", `Bearer ${partnerToken}`);
    }
    if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const response = await fetch(`${basePath}${path}`, {
      ...init,
      credentials: "same-origin",
      headers,
    });
    if (!response.ok) {
      // FIX (Sept 2026): this used to throw the RAW response body as the
      // error message - for a FastAPI error that's a JSON string like
      // {"detail":"Verify the profile before approving a Boost"}, not
      // readable text. Every call site's error/success-styling check
      // (see the repeated notice.includes("Could not") pattern in
      // ui.tsx) was written assuming a plain sentence, so a real backend
      // error read as an unmatched string and rendered with the SUCCESS
      // ("notice") style instead of the error one - Alena's Boost
      // Requests screenshot, a green banner showing raw
      // {"detail":"..."} JSON. Parse the body and prefer its .detail
      // (FastAPI's standard shape); fall back to the raw text for a
      // non-JSON or differently-shaped error body.
      const rawBody = await response.text();
      let message = rawBody;
      if (rawBody) {
        try {
          const parsed = JSON.parse(rawBody) as unknown;
          if (parsed && typeof parsed === "object" && "detail" in parsed) {
            const detail = (parsed as { detail: unknown }).detail;
            if (typeof detail === "string" && detail) message = detail;
          }
        } catch {
          // Not JSON - keep the raw text as-is.
        }
      }
      if (
        response.status === 401 &&
        typeof window !== "undefined" &&
        path !== "/admin/login"
      ) {
        window.dispatchEvent(new Event(ADMIN_AUTH_REQUIRED_EVENT));
      }
      throw new ApiError(response.status, message || `Request failed (${response.status})`);
    }
    return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
  };

  return {
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
    patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
    put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) }),
    delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
    upload: <T>(path: string, body: FormData) => request<T>(path, { method: "POST", body }),
  };
}
