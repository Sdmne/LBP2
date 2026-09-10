// Shared helpers for reading the free-form `data` JSON blob that both
// ProfileDetailScreen and CatalogScreen's inline profile expansion render
// (GET /api/member/catalog/{id} - member_catalog_detail() in main.py wraps
// public_profile_summary() plus whatever's in that profile's own JSON blob:
// bio/about text, questionnaire answers, etc. Its exact keys aren't
// enumerated anywhere in the backend, hence the defensive reads below).
// Extracted out of ProfileDetailScreen (Sept 2026) so CatalogScreen's new
// "scroll to see the full profile without leaving Browse" panel (Alena's
// screen recording of the prototype - the swipe card scrolls in place,
// revealing Looking for/Contact with the child/About me/Languages/
// Occupation/... underneath, while the pass/info/message/like row and tab
// bar stay put) can render the exact same fields the same way, instead of
// only linking out to the separate ProfileDetail screen.
import { catalogOptionLabel } from "../data/catalogLabels";

export type ProfileDetailData = {
  id: number;
  displayName: string | null;
  city: string | null;
  country: string | null;
  avatarUrl: string | null;
  photos?: string[];
  isVerified?: boolean;
  isPremium?: boolean;
  likedByViewer?: boolean;
  profileType?: string | null;
  data?: Record<string, unknown>;
};

export function dataList(data: Record<string, unknown> | undefined, key: string): string[] {
  if (!data) return [];
  const value = data[key];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return value.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

export function rawToLabel(field: string, raw: string | null): string {
  return raw ? catalogOptionLabel(field, raw) : "";
}

export function dataString(data: Record<string, unknown> | undefined, key: string): string | null {
  if (!data) return null;
  const value = data[key];
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number") return String(value);
  return null;
}

export function firstString(data: Record<string, unknown> | undefined, keys: string[]): string | null {
  if (!data) return null;
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

export type DetailRow = { label: string; value: string };

// Same field list/order as ProfileDetailScreen's old inline `detailRows`,
// traced from the website's profile-edit form (frontend/src/ui.tsx's Basic
// information / Appearance & lifestyle sections). `t` is the screen's own
// useI18n() translator, passed in rather than imported, so this stays a
// plain function usable from either screen.
export function buildDetailRows(t: (key: string) => string, data: Record<string, unknown> | undefined): DetailRow[] {
  return [
    { label: t("profileDetail.occupation"), value: dataString(data, "occupation") || "" },
    { label: t("profileDetail.religion"), value: rawToLabel("religion", dataString(data, "religion")) },
    { label: t("profileDetail.education"), value: rawToLabel("education", dataString(data, "education")) },
    { label: t("profileDetail.smoking"), value: rawToLabel("smokingStatus", dataString(data, "smokingStatus")) },
    { label: t("profileDetail.drinking"), value: rawToLabel("drinkingStatus", dataString(data, "drinkingStatus")) },
    { label: t("profileDetail.height"), value: dataString(data, "height") || "" },
    { label: t("profileDetail.weight"), value: dataString(data, "weight") || "" },
    { label: t("profileDetail.eyeColor"), value: rawToLabel("eyeColor", dataString(data, "eyeColor")) },
    { label: t("profileDetail.hairColor"), value: rawToLabel("hairColor", dataString(data, "hairColor")) },
  ].filter((row) => row.value);
}
