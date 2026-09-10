import { api, localFileToBlob } from "./client";

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

// Structured 10-section Family Plan (Alena's reference mockup, "Your
// Family Plan"). Separate from FamilyPlan above (the older free-text
// parenting/finances/legal notes, still used by the Checklist/Documents
// cards) - see backend/sql/2026_09_family_plan_sections.sql and the
// FAMILY_PLAN_SECTION_KEYS list in main.py, mirrored client-side in
// utils/familyPlan.ts for ordering + i18n labels.
export type FamilyPlanSection = {
  key: string;
  content: string;
  updatedByProfileId: number | null;
  updatedAt: string | null;
  myComplete: boolean;
  partnerComplete: boolean;
};

export type FamilyRoom = {
  ok: true;
  matchId: number;
  plan: FamilyPlan;
  sections: FamilyPlanSection[];
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

export function updateFamilyPlanSection(
  profileId: number | string,
  sectionKey: string,
  updates: Partial<{ content: string; isComplete: boolean }>,
) {
  return api.patch<{ ok: true; sections: FamilyPlanSection[] }>(
    `/api/member/family-room/${profileId}/sections/${encodeURIComponent(sectionKey)}`,
    updates,
  );
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
export async function uploadFamilyDocument(
  profileId: number | string,
  file: { uri: string; name: string; type: string },
) {
  // See client.ts's localFileToBlob for why this can't be the old
  // {uri, name, type} object form anymore. Same follow-on issue as
  // photos.ts's uploadPhoto: `file.type` (expo-document-picker's own
  // asset.mimeType, which IS reliable here) was being accepted as a
  // parameter and then silently dropped - only the raw blob's own
  // `.type`, sniffed by fetch(uri).blob() from a file://cache URI, made it
  // into the multipart part's Content-Type, and that's frequently blank/
  // "application/octet-stream" - which is exactly the server's "Unsupported
  // file type" rejection Alena hit. .slice() rewrites the blob's reported
  // type using the picker's own mimeType without recopying the bytes.
  const form = new FormData();
  const rawBlob = await localFileToBlob(file.uri);
  const blob =
    rawBlob.type && rawBlob.type !== "application/octet-stream" ? rawBlob : rawBlob.slice(0, rawBlob.size, file.type);
  form.append("file", blob, file.name);
  return api.upload<{ ok: true; document: FamilyDocument }>(`/api/member/family-room/${profileId}/documents`, form);
}

export function deleteFamilyDocument(documentId: number) {
  return api.delete<{ ok: true }>(`/api/member/family-room/documents/${documentId}`);
}
