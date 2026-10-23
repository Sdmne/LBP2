export class ApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly detail?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

export type ApiClient = {
  get<T>(path: string, options?: { signal?: AbortSignal; headers?: HeadersInit }): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
  upload<T>(path: string, body: FormData): Promise<T>;
};

const sharedReads = new Map<string, Promise<unknown>>();

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
      cache: path.startsWith("/member/") || path.startsWith("/auth/") ? "no-store" : init.cache,
      credentials: "same-origin",
      headers,
    });
    if (init.signal?.aborted) throw new DOMException("Request aborted", "AbortError");
    if (!response.ok) {
      if (response.status === 401 && typeof window !== "undefined" && (path.startsWith("/member/") || path === "/auth/me" || path === "/auth/heartbeat")) {
        window.dispatchEvent(new Event("lbp-session-expired"));
      }
      const message = await response.text();
      let detail: unknown;
      try { detail = JSON.parse(message)?.detail; } catch { /* Keep the existing message for non-JSON errors. */ }
      throw new ApiError(response.status, message || `Request failed (${response.status})`, detail);
    }
    return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
  };

  return {
    get: <T>(path: string, options?: { signal?: AbortSignal; headers?: HeadersInit }): Promise<T> => {
      if (options?.signal || options?.headers || (path !== "/privacy/consent" && !path.startsWith("/public/footer-pages/"))) return request<T>(path, options);
      const key = `${basePath}${path}`;
      const pending = sharedReads.get(key);
      if (pending) return pending as Promise<T>;
      const result = request<T>(path, options).finally(() => {
        if (sharedReads.get(key) === result) sharedReads.delete(key);
      });
      sharedReads.set(key, result);
      return result;
    },

    post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
    patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
    put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) }),
    delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
    upload: <T>(path: string, body: FormData) => request<T>(path, { method: "POST", body }),
  };
}
