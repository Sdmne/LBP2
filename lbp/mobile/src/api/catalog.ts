import { api } from "./client";
import type { CatalogResponse } from "./types";
import type { ProfileDetailData } from "../utils/profileFields";
import type { CatalogFilters } from "./catalogFilters";

// Builds the same query params GET /api/member/catalog accepts (main.py's
// member_catalog) - country/profileType/donorType/lookingFor are repeated
// params for a list value (FastAPI's Query(list[str])), not comma-joined.
function catalogFilterParams(filters?: CatalogFilters): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  filters.country.forEach((value) => params.append("country", value));
  if (filters.city) params.set("city", filters.city);
  filters.profileTypes.forEach((value) => params.append("profileType", value));
  filters.donorTypes.forEach((value) => params.append("donorType", value));
  filters.lookingFor.forEach((value) => params.append("lookingFor", value));
  if (filters.verifiedOnly) params.set("verifiedOnly", "true");
  if (filters.videoVerifiedOnly) params.set("videoVerifiedOnly", "true");
  if (filters.ageMin) params.set("ageMin", filters.ageMin);
  if (filters.ageMax) params.set("ageMax", filters.ageMax);
  // Premium filters (see catalogFilters.ts) - backend 402s the whole
  // request if any of these are set and the viewer isn't Premium, so
  // FiltersScreen is responsible for only ever letting a Premium user
  // populate them in the first place.
  if (filters.ethnicity) params.set("ethnicity", filters.ethnicity);
  if (filters.hairColor) params.set("hairColor", filters.hairColor);
  if (filters.eyeColor) params.set("eyeColor", filters.eyeColor);
  if (filters.education) params.set("education", filters.education);
  if (filters.religion) params.set("religion", filters.religion);
  const query = params.toString();
  return query ? `&${query}` : "";
}

export function fetchCatalog(offset = 0, limit = 24, filters?: CatalogFilters) {
  return api.get<CatalogResponse>(`/api/member/catalog?limit=${limit}&offset=${offset}${catalogFilterParams(filters)}`);
}

// Real response shape from POST /api/member/likes/{id} (main.py's
// member_like_profile) - was previously typed as just {ok: true}, silently
// dropping "matched"/"matchId"/"conversationId", which the backend already
// returns whenever this like closes a mutual match (same "narrow type
// drops real fields" pattern already found and fixed for /api/auth/me in
// AuthContext.tsx - see MeProfileScreen's AuthUser widening).
export type LikeResult = {
  ok: true;
  liked: true;
  created: boolean;
  matched: boolean;
  matchId: number | null;
  conversationId: number | null;
};

export function likeProfile(profileIdentifier: number | string) {
  return api.post<LikeResult>(`/api/member/likes/${profileIdentifier}`);
}

export function unlikeProfile(profileIdentifier: number | string) {
  return api.delete<{ ok: true }>(`/api/member/likes/${profileIdentifier}`);
}

// Same endpoint ProfileDetailScreen uses (GET /api/member/catalog/{id} -
// member_catalog_detail() in main.py) - CatalogScreen's inline "scroll to
// see the full profile" expansion (see utils/profileFields.ts) fetches the
// full detail blob for the current top card on demand, the same way, so
// both places show identical data instead of two screens quietly drifting
// apart.
export function fetchCatalogProfileDetail(profileId: number | string) {
  return api
    .get<{ profile: ProfileDetailData } | ProfileDetailData>(`/api/member/catalog/${profileId}`)
    .then((res) => ("profile" in res ? res.profile : res));
}
