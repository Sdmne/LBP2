type MediaRow = Record<string, unknown>;
const row = (value: unknown): MediaRow => value && typeof value === "object" && !Array.isArray(value) ? value as MediaRow : {};

export function photoUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const url = value.trim();
  return /^(?:https?:\/\/|\/(?!\/)|blob:)/i.test(url) ? url : "";
}

function photoList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }
  return [];
}

export function profilePhotoUrls(profile: MediaRow, failed: readonly string[] = [], ownerView = false): string[] {
  const data = row(profile.data);
  const hasPhotos = profile.photos !== undefined || data.photos !== undefined;
  const values = photoList(profile.photos !== undefined ? profile.photos : data.photos);
  const urls: string[] = [];
  for (const value of values) {
    const photo = row(value);
    const status = String(photo.status || "ACTIVE").toUpperCase();
    const moderation = String(photo.moderationStatus || photo.moderation_status || "APPROVED").toUpperCase();
    if (ownerView) {
      if (!["ACTIVE", "PENDING", "REJECTED"].includes(status)) continue;
      const uploadStatus = String(photo.uploadStatus || photo.upload_status || "COMMITTED").toUpperCase();
      if (uploadStatus !== "COMMITTED") continue;
    } else if (status !== "ACTIVE" || moderation !== "APPROVED") continue;
    const original = photoUrl(typeof value === "string" ? value : photo.publicUrl || photo.public_url || photo.url);
    if (!original) continue;
    const primary = original === photoUrl(profile.primaryPhotoUrl || data.primaryPhotoUrl)
      || (photo.position !== undefined && photo.position !== null && Number(photo.position) === 0);
    const crop = primary ? photoUrl(photo.avatarUrl || photo.avatar_url || profile.avatarUrl || data.avatarUrl) : "";
    const url = crop && !failed.includes(crop) ? crop : original;
    if (!failed.includes(url) && !urls.includes(url)) urls.push(url);
  }
  if (!hasPhotos) {
    const fallback = photoUrl(profile.avatarUrl || data.avatarUrl || profile.photoUrl || data.photoUrl);
    if (fallback && !failed.includes(fallback)) urls.push(fallback);
  }
  return urls;
}
