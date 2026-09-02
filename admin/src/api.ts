export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

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
      const message = await response.text();
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
