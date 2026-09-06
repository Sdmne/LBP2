import { api } from "./client";
import type { DirectoryDetail, DirectoryListResponse } from "./types";

// GET /api/public/clinics and /api/public/lawyers - public_clinics() /
// public_lawyers() in main.py. No auth required (same as the site: anyone
// can browse the directory, only favouriting needs a session) - so this app
// calls them without a session token too, which api.get already handles
// fine (it just won't attach an Authorization header if there's none yet).
export function fetchClinics(params: { q?: string; country?: string; city?: string; offset?: number; limit?: number } = {}) {
  return api.get<DirectoryListResponse>(`/api/public/clinics${queryString(params)}`);
}

export function fetchClinicDetail(slugOrId: string | number) {
  return api.get<DirectoryDetail>(`/api/public/clinics/${encodeURIComponent(String(slugOrId))}`);
}

export function fetchLawyers(params: { q?: string; country?: string; city?: string; offset?: number; limit?: number } = {}) {
  return api.get<DirectoryListResponse>(`/api/public/lawyers${queryString(params)}`);
}

export function fetchLawyerDetail(slugOrId: string | number) {
  return api.get<DirectoryDetail>(`/api/public/lawyers/${encodeURIComponent(String(slugOrId))}`);
}

function queryString(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== "");
  if (!entries.length) return "";
  const search = new URLSearchParams(entries.map(([key, value]) => [key, String(value)]));
  return `?${search.toString()}`;
}
