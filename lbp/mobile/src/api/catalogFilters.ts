import { api } from "./client";

// Mirrors the website's CatalogFilters shape (frontend/src/ui.tsx) - kept
// deliberately parallel so the two clients stay easy to compare. ageMin/
// ageMax are strings (not numbers) so an empty text field round-trips
// cleanly through form state without a stray "0" - they're only parsed to
// numbers at the point fetchCatalog() builds the query string.
export type CatalogFilters = {
  country: string[];
  city: string;
  profileTypes: string[];
  donorTypes: string[];
  lookingFor: string[];
  verifiedOnly: boolean;
  ageMin: string;
  ageMax: string;
};

export function emptyCatalogFilters(): CatalogFilters {
  return { country: [], city: "", profileTypes: [], donorTypes: [], lookingFor: [], verifiedOnly: false, ageMin: "", ageMax: "" };
}

export function activeCatalogFilterCount(filters: CatalogFilters): number {
  return [
    filters.country.length > 0,
    filters.city.length > 0,
    filters.profileTypes.length > 0,
    filters.donorTypes.length > 0,
    filters.lookingFor.length > 0,
    filters.verifiedOnly,
    filters.ageMin.length > 0,
    filters.ageMax.length > 0,
  ].filter(Boolean).length;
}

export type CatalogFilterOptionRow = { value: string; label: string; count?: number };

export type CatalogFilterOptionsResponse = {
  countries: CatalogFilterOptionRow[];
  cities: CatalogFilterOptionRow[];
  isPremium: boolean;
};

// GET /api/member/catalog/filter-options (main.py's member_catalog_filter_options)
// - without a country, returns every country with a live-user count;
// with one, also returns that country's cities. limit=200 matches the
// website's own call so we're not artificially truncating the list.
export function fetchCatalogFilterOptions(country?: string) {
  const params = new URLSearchParams({ limit: "200" });
  if (country) params.set("country", country);
  return api.get<CatalogFilterOptionsResponse>(`/api/member/catalog/filter-options?${params.toString()}`);
}
