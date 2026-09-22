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
  videoVerifiedOnly: boolean;
  ageMin: string;
  ageMax: string;
  // Premium-only appearance/background filters (main.py's member_catalog
  // premium_filters dict; website's ui.tsx CatalogFilterPanel has the same
  // 5 fields - no bodyType on the panel even though the backend also
  // accepts it, so mobile mirrors the website exactly here rather than
  // the backend's full set). Single-select strings, like `city`, not
  // arrays - the backend only accepts one value per field. Added Sept
  // 2026 per Alena's screenshot of the website's filter panel asking why
  // these Premium filters weren't on mobile yet (they existed only as a
  // single locked placeholder row before this).
  ethnicity: string;
  hairColor: string;
  eyeColor: string;
  education: string;
  religion: string;
};

export function emptyCatalogFilters(): CatalogFilters {
  return {
    country: [], city: "", profileTypes: [], donorTypes: [], lookingFor: [], verifiedOnly: false, videoVerifiedOnly: false, ageMin: "", ageMax: "",
    ethnicity: "", hairColor: "", eyeColor: "", education: "", religion: "",
  };
}

export function activeCatalogFilterCount(filters: CatalogFilters): number {
  return [
    filters.country.length > 0,
    filters.city.length > 0,
    filters.profileTypes.length > 0,
    filters.donorTypes.length > 0,
    filters.lookingFor.length > 0,
    filters.verifiedOnly,
    filters.videoVerifiedOnly,
    filters.ageMin.length > 0,
    filters.ageMax.length > 0,
    filters.ethnicity.length > 0,
    filters.hairColor.length > 0,
    filters.eyeColor.length > 0,
    filters.education.length > 0,
    filters.religion.length > 0,
  ].filter(Boolean).length;
}

export type CatalogFilterOptionRow = { value: string; label: string; count?: number; placeId?: string };

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
