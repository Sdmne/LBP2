import { api } from "./client";
import type { DirectoryDetail, DirectoryListResponse } from "./types";

// GET /api/public/clinics and /api/public/lawyers - public_clinics() /
// public_lawyers() in main.py. No auth required (same as the site: anyone
// can browse the directory, only favouriting needs a session) - so this app
// calls them without a session token too, which api.get already handles
// fine (it just won't attach an Authorization header if there's none yet).
export function fetchClinics(
  params: { q?: string; country?: string[]; city?: string; serviceCategory?: string; offset?: number; limit?: number } = {},
) {
  return api.get<DirectoryListResponse>(`/api/public/clinics${queryString(params)}`);
}

export function fetchClinicDetail(slugOrId: string | number) {
  return api.get<DirectoryDetail>(`/api/public/clinics/${encodeURIComponent(String(slugOrId))}`);
}

export function fetchLawyers(
  params: { q?: string; country?: string[]; city?: string; practiceArea?: string; offset?: number; limit?: number } = {},
) {
  return api.get<DirectoryListResponse>(`/api/public/lawyers${queryString(params)}`);
}

export function fetchLawyerDetail(slugOrId: string | number) {
  return api.get<DirectoryDetail>(`/api/public/lawyers/${encodeURIComponent(String(slugOrId))}`);
}

// GET /api/public/clinics/options and /api/public/lawyers/options -
// public_clinic_options()/public_lawyer_options() in main.py. Real filter
// data (countries with counts, at minimum) that was already built
// server-side but never surfaced on this screen - DirectoryScreen used to
// leave filtering out entirely reasoning the list endpoints had no
// category param, without checking whether a country param (which they do
// support) had a real options source behind it too.
export type DirectoryCountryOption = { value: string; count: number };
// Real, backend-backed specialty filters - CLINIC_SERVICE_GROUPS /
// public_clinic_options() and the practiceAreas aggregation in
// public_lawyer_options() (main.py). count is null for clinic categories
// (the backend groups several raw service slugs per category and doesn't
// pre-count them), always present for lawyer practice areas.
export type DirectoryCategoryOption = { value: string; label: string; count: number | null };

export function fetchClinicOptions(locale?: string) {
  return api.get<{ countries: DirectoryCountryOption[]; serviceCategories: DirectoryCategoryOption[] }>(
    `/api/public/clinics/options${locale ? `?locale=${encodeURIComponent(locale)}` : ""}`,
  );
}

export function fetchLawyerOptions() {
  return api.get<{ countries: DirectoryCountryOption[]; practiceAreas: DirectoryCategoryOption[] }>("/api/public/lawyers/options");
}

// Alena: the directory's country filter needed to accept several
// countries at once, not just one - so this now needs to emit a repeated
// ?country=A&country=B query string for array values (the same shape
// catalogFilterParams already uses for catalog's own list filters), not
// just a single "country=A,B" that public_clinics()/public_lawyers()
// wouldn't parse as a list.
function queryString(params: Record<string, string | number | string[] | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) if (item) search.append(key, item);
    } else {
      search.append(key, String(value));
    }
  }
  const result = search.toString();
  return result ? `?${result}` : "";
}
