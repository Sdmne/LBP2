import { api } from "./client";
import type { PublicUser } from "./types";

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
  cityPlaceId?: string | null;
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

export type MemberMeResponse = {
  user: PublicUser;
  profile: MemberProfileSummary | null;
  photos: unknown[];
  counts: Record<string, unknown>;
};

export function fetchMe() {
  return api.get<MemberMeResponse>("/api/member/me");
}

export type ProfileUpdatePayload = {
  displayName: string;
  dateOfBirth: string;
  country: string;
  city: string;
  cityPlaceId: string;
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
