import { api } from "./client";

export function reportProfile(profileIdentifier: number | string, reason: string, details?: string) {
  return api.post<{ ok: true }>(`/api/member/reports/${profileIdentifier}`, { reason, details });
}
