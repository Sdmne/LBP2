import { api } from "./client";
import type { VerificationStatus } from "./types";

export function fetchVerificationStatus() {
  return api.get<VerificationStatus>("/api/member/verification");
}

export function startVerification(locale: "en" | "ru" | "es" = "en") {
  // VerificationPayload in main.py: verificationType defaults to "profile"
  // and isn't restricted to a fixed enum server-side, so this matches that
  // default rather than inventing a new value.
  return api.post<{ ok: true; status: string; sessionId: string | null; url: string | null; existing?: boolean }>(
    "/api/member/verification",
    { verificationType: "profile", payload: { locale } },
  );
}
