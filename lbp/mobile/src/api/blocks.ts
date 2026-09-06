import { api } from "./client";
import type { BlockedProfile } from "./types";

export function fetchBlockedProfiles() {
  return api.get<{ items: BlockedProfile[]; total: number }>("/api/member/blocks");
}

export function blockProfile(profileIdentifier: number | string, reason?: string) {
  return api.post<{ ok: true; blocked: true }>(`/api/member/blocks/${profileIdentifier}`, { reason });
}

export function unblockProfile(profileIdentifier: number | string) {
  return api.delete<{ ok: true; blocked: false }>(`/api/member/blocks/${profileIdentifier}`);
}
