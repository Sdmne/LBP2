import { api, localFileToBlob } from "./client";

// Pregnancy Room - a separate room next to the general Family Room
// documents (src/api/familyRoom.ts), for exactly the 3 things Alena asked
// for: lab results, ultrasound scans, and doctor's prescriptions/
// appointments. Same gating as the rest of Family Room (Premium + an
// ACTIVE mutual match - a 402 means "needs Premium", a 404 means "no
// match with this profile") and the same private multipart-upload
// pattern as uploadFamilyDocument below.

export type PregnancyEntryCategory = "lab_test" | "ultrasound" | "prescription";

export type PregnancyEntry = {
  id: number;
  matchId: number;
  category: PregnancyEntryCategory;
  displayName: string;
  note: string;
  entryDate: string; // YYYY-MM-DD
  uploadedByProfileId: number;
  createdAt: string;
  mimeType: string;
  bytes: number;
  contentUrl: string;
};

export function fetchPregnancyRoom(profileId: number | string) {
  return api.get<{ ok: true; matchId: number; entries: PregnancyEntry[] }>(
    `/api/member/family-room/${profileId}/pregnancy`,
  );
}

// Multipart upload - mirrors familyRoom.ts's uploadFamilyDocument, including
// the same .slice() re-typing fix (see that function's comment for why:
// a picked file's blob, sniffed by fetch(uri).blob() from a file://cache
// URI, is frequently missing/generic on its own Content-Type).
export async function uploadPregnancyEntry(
  profileId: number | string,
  file: { uri: string; name: string; type: string },
  fields: { category: PregnancyEntryCategory; note?: string; entryDate?: string },
) {
  const form = new FormData();
  const rawBlob = await localFileToBlob(file.uri);
  const blob =
    rawBlob.type && rawBlob.type !== "application/octet-stream" ? rawBlob : rawBlob.slice(0, rawBlob.size, file.type);
  form.append("file", blob, file.name);
  form.append("category", fields.category);
  if (fields.note) form.append("note", fields.note);
  if (fields.entryDate) form.append("entryDate", fields.entryDate);
  return api.upload<{ ok: true; entry: PregnancyEntry }>(`/api/member/family-room/${profileId}/pregnancy`, form);
}

export function deletePregnancyEntry(entryId: number) {
  return api.delete<{ ok: true }>(`/api/member/family-room/pregnancy/${entryId}`);
}
