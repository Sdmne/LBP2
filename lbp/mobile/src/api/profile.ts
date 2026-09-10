import { api } from "./client";
import type { PublicUser } from "./types";

// Fields the backend stores directly under these exact keys inside the
// profile's `data` JSON column (see backend/main.py's update_profile_data +
// ProfileUpdatePayload) - only the fields EditProfileScreen/ProfileWizard
// actually read or write are typed here. The backend supports a few more
// (state, cityPlaceId, latitude, longitude, visibleInCatalog) that neither
// screen touches - not silently dropped, just genuinely out of scope so far.
export type MemberProfileData = {
  dateOfBirth?: string | null;
  age?: number | null;
  ethnicity?: string | null;
  about?: string | null;
  bio?: string | null;
  languages?: string[] | null;
  lookingFor?: string[] | null;
  donorType?: string[] | null;
  desiredDonorContact?: string | null;
  profileType?: string | null;
  height?: number | null;
  weight?: number | null;
  eyeColor?: string | null;
  hairColor?: string | null;
  occupation?: string | null;
  education?: string | null;
  religion?: string | null;
  smokingStatus?: string | null;
  drinkingStatus?: string | null;
  unitPreference?: string | null;
};

export type MemberProfileSummary = {
  id: number;
  displayName: string | null;
  role: string | null;
  status: string | null;
  country: string | null;
  city: string | null;
  avatarUrl: string | null;
  profileType: string | null;
  isVerified: boolean | null;
  isPremium: boolean | null;
  data: MemberProfileData;
};

// GET /api/member/me (main.py's member_me) - there's no separate
// GET /api/member/profile; this is the only endpoint that returns the full
// editable profile.data JSON (dateOfBirth/ethnicity/about/languages/...)
// for the signed-in person, via public_profile_summary()'s "data" field.
export type MemberMeResponse = {
  user: PublicUser;
  profile: MemberProfileSummary | null;
  photos: unknown[];
  counts: Record<string, number>;
};

export function fetchMe() {
  return api.get<MemberMeResponse>("/api/member/me");
}

// PATCH /api/member/profile (main.py's member_update_profile). dateOfBirth
// is enforced server-side as required on every single save (422 "Date of
// birth is required" if missing) even when this particular edit didn't
// touch it.
//
// displayName/dateOfBirth/country/city/ethnicity/about/languages are
// required here because EditProfileScreen is a full-form editor that always
// sends its complete controlled-form state, so an intentionally-cleared
// field goes through as "" / [] rather than being silently omitted (the
// backend treats an omitted key as "leave alone" via
// model_dump(exclude_unset=True), which is not what a cleared field means
// there). displayName must never actually be blank when sent though - the
// backend 422s on an empty display name, so callers validate that
// themselves before calling this.
//
// UPDATE (Sept 2026): widened with the backend's remaining ProfileUpdatePayload
// fields - profileType/lookingFor/donorType/height/weight/eyeColor/hairColor/
// occupation/education/religion/smokingStatus/drinkingStatus/unitPreference -
// all optional, so this stays backward compatible with EditProfileScreen's
// existing calls (which don't set any of them) while letting
// ProfileWizardScreen's one-shot "Complete profile" save send the full
// signup questionnaire in the same PATCH. Optional ones are only included in
// a given call's payload object when the caller actually has a value -
// omitted (not sent as "" or 0) so an untouched optional field doesn't
// overwrite anything real on a later edit.
export type ProfileUpdatePayload = {
  displayName: string;
  dateOfBirth: string;
  country: string;
  city: string;
  ethnicity: string;
  about: string;
  languages: string[];
  profileType?: string;
  lookingFor?: string[];
  donorType?: string[];
  desiredDonorContact?: string;
  height?: number;
  weight?: number;
  eyeColor?: string;
  hairColor?: string;
  occupation?: string;
  education?: string;
  religion?: string;
  smokingStatus?: string;
  drinkingStatus?: string;
  unitPreference?: string;
};

export function updateProfile(payload: ProfileUpdatePayload) {
  return api.patch<{ ok: true; profile: MemberProfileSummary }>("/api/member/profile", payload);
}
