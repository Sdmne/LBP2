import { api } from "./client";
import type { MemberSettings } from "./types";

export function fetchSettings() {
  return api.get<MemberSettings>("/api/member/settings");
}

export function updateSettings(patch: Partial<MemberSettings>) {
  return api.patch<{ ok: true; settings: Partial<MemberSettings> }>("/api/member/settings", patch);
}
