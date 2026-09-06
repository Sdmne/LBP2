import { api } from "./client";
import type { FavouritesResponse } from "./types";

// GET /api/member/favourites - member_favourites() in main.py (the /favorites
// alias exists too, but we standardize on the British spelling the backend
// itself uses as the primary route).
export function fetchFavourites() {
  return api.get<FavouritesResponse>("/api/member/favourites");
}

export function favouriteClinic(clinicIdentifier: string | number) {
  return api.post<{ ok: true; favourited: true; clinicId: number }>(
    `/api/member/favourites/clinics/${encodeURIComponent(String(clinicIdentifier))}`
  );
}

export function unfavouriteClinic(clinicIdentifier: string | number) {
  return api.delete<{ ok: true; favourited: false; clinicId: number }>(
    `/api/member/favourites/clinics/${encodeURIComponent(String(clinicIdentifier))}`
  );
}

export function favouriteLawyer(lawyerIdentifier: string | number) {
  return api.post<{ ok: true; favourited: true; lawyerId: number }>(
    `/api/member/favourites/lawyers/${encodeURIComponent(String(lawyerIdentifier))}`
  );
}

export function unfavouriteLawyer(lawyerIdentifier: string | number) {
  return api.delete<{ ok: true; favourited: false; lawyerId: number }>(
    `/api/member/favourites/lawyers/${encodeURIComponent(String(lawyerIdentifier))}`
  );
}
