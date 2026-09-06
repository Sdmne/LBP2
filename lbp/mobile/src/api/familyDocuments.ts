import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { API_BASE_URL } from "../config";
import { ApiError } from "./client";
import { getSessionToken } from "./session";
import type { FamilyDocument } from "./familyRoom";

export async function openFamilyDocument(document: FamilyDocument): Promise<void> {
  if (!Number.isSafeInteger(document.id) || document.id < 1) throw new Error("Invalid document");
  const token = getSessionToken();
  if (!token) throw new ApiError(401, "Sign in to open this document.");
  if (!FileSystem.cacheDirectory || !(await Sharing.isAvailableAsync())) {
    throw new Error("Document sharing is not available on this device.");
  }
  const directory = `${FileSystem.cacheDirectory}family-document-${document.id}-${Date.now()}-${Math.random().toString(36).slice(2)}/`;
  const fileName = document.displayName.replace(/[\\/\x00-\x1f\x7f]/g, "_").replace(/^\.+/, "").slice(0, 120) || `document-${document.id}`;
  try {
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    const result = await FileSystem.downloadAsync(
      `${API_BASE_URL}/api/member/family-room/documents/${document.id}/content`,
      directory + encodeURIComponent(fileName),
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (result.status !== 200) throw new ApiError(result.status, "Could not download this document.");
    await Sharing.shareAsync(result.uri, { mimeType: document.mimeType });
  } finally {
    await FileSystem.deleteAsync(directory, { idempotent: true }).catch(() => {});
  }
}
