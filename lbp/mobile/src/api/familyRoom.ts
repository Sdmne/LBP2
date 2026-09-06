import { api } from "./client";

// Family Plan / Shared Family Room / Document & checklist tools - the
// "Family Builder Pro" pricing-page features (see the site's pricing page,
// familyBuilderPro plan). NEW backend endpoints, added alongside this
// mobile screen - see backend/main.py's "FAMILY ROOM" section and the
// accompanying 2026_09_family_room.sql migration. Gated server-side behind
// the existing single Premium flag (not a real Family-Builder-vs-Pro tier
// split, which the backend doesn't have yet) and behind an ACTIVE mutual
// match - a 402 means "needs Premium", a 404 means "no match with this
// profile" (or the profile id itself doesn't exist).

export type FamilyPlan = {
  id: number | null;
  matchId: number;
  parentingNotes: string;
  financesNotes: string;
  legalNotes: string;
  updatedByProfileId: number | null;
  updatedAt: string | null;
};

export type FamilyChecklistItem = {
  id: number;
  matchId: number;
  section: "parenting" | "finances" | "legal" | "general";
  label: string;
  isDone: boolean;
  createdByProfileId: number;
  createdAt: string;
  updatedAt: string;
};

export type FamilyDocument = {
  id: number;
  matchId: number;
  displayName: string;
  uploadedByProfileId: number;
  createdAt: string;
  mimeType: string;
  bytes: number;
  contentUrl: string;
};

export type FamilyRoom = {
  ok: true;
  matchId: number;
  plan: FamilyPlan;
  checklist: FamilyChecklistItem[];
  documents: FamilyDocument[];
};

export function fetchFamilyRoom(profileId: number | string) {
  return api.get<FamilyRoom>(`/api/member/family-room/${profileId}`);
}

export function updateFamilyPlan(
  profileId: number | string,
  updates: Partial<Pick<FamilyPlan, "parentingNotes" | "financesNotes" | "legalNotes">>,
) {
  return api.patch<{ ok: true; plan: FamilyPlan }>(`/api/member/family-room/${profileId}/plan`, updates);
}

export function createFamilyChecklistItem(
  profileId: number | string,
  section: FamilyChecklistItem["section"],
  label: string,
) {
  return api.post<{ ok: true; item: FamilyChecklistItem }>(`/api/member/family-room/${profileId}/checklist`, {
    section,
    label,
  });
}

export function updateFamilyChecklistItem(
  itemId: number,
  updates: Partial<Pick<FamilyChecklistItem, "label" | "isDone">>,
) {
  return api.patch<{ ok: true; item: FamilyChecklistItem }>(`/api/member/family-room/checklist/${itemId}`, updates);
}

export function deleteFamilyChecklistItem(itemId: number) {
  return api.delete<{ ok: true }>(`/api/member/family-room/checklist/${itemId}`);
}

// Multipart upload - mirrors src/api/photos.ts's pattern for building a
// FormData body from a picked file.
export function uploadFamilyDocument(profileId: number | string, file: { uri: string; name: string; type: string }) {
  const form = new FormData();
  form.append("file", { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  return api.upload<{ ok: true; document: FamilyDocument }>(`/api/member/family-room/${profileId}/documents`, form);
}

export function deleteFamilyDocument(documentId: number) {
  return api.delete<{ ok: true }>(`/api/member/family-room/documents/${documentId}`);
}
