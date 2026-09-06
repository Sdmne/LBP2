import { api } from "./client";
import type { CatalogResponse } from "./types";

export function fetchCatalog(offset = 0, limit = 24) {
  return api.get<CatalogResponse>(`/api/member/catalog?limit=${limit}&offset=${offset}`);
}

export function likeProfile(profileIdentifier: number | string) {
  return api.post<{ ok: true }>(`/api/member/likes/${profileIdentifier}`);
}

export function unlikeProfile(profileIdentifier: number | string) {
  return api.delete<{ ok: true }>(`/api/member/likes/${profileIdentifier}`);
}
