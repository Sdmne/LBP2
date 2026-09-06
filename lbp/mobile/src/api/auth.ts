import { api } from "./client";
import type { AuthResponse } from "./types";

export function login(email: string, password: string) {
  return api.post<AuthResponse>("/api/auth/login", { email, password });
}

export function signup(email: string, password: string, displayName: string, locale = "en") {
  return api.post<AuthResponse>("/api/auth/signup", { email, password, displayName, locale });
}

// POST /api/auth/firebase - auth_firebase() in main.py, FirebaseAuthPayload.
// Same endpoint the website's "Continue with Google"/"Continue with Apple"
// buttons call (see lbp/frontend/src/firebase-auth.ts's signInWithSocial) -
// idToken here must be a real Firebase ID token (from firebaseAuth in
// src/firebase.ts after signInWithCredential), not a raw Google/Apple one.
// Returns the same shape as login()/signup() (AuthResponse already has the
// optional provider/isNewUser fields this endpoint adds).
//
// Errors worth mapping in the UI: 403 "ACCOUNT_INACTIVE" (account disabled),
// 403 with a plain-text detail (unverified email on the social account -
// shouldn't normally happen since Google/Apple emails are pre-verified),
// 409 "SOCIAL_ACCOUNT_CONFLICT" (that email already has a password-based
// account, or is already linked to a different social identity).
export function authenticateWithFirebase(idToken: string, displayName: string | null, intent: "login" | "register") {
  return api.post<AuthResponse>("/api/auth/firebase", { idToken, displayName, intent });
}

// POST /api/auth/forgot-password - auth_forgot_password() in main.py, takes
// just {email}. Deliberately always resolves the same way from the UI's
// point of view whether or not the email exists (the backend itself only
// sends a real reset email when it finds an ACTIVE account) - don't reveal
// account existence in the message shown to the person.
export function forgotPassword(email: string) {
  return api.post<{ ok: true }>("/api/auth/forgot-password", { email });
}

export function logout() {
  return api.post<{ ok: true }>("/api/auth/logout");
}

export function me() {
  return api.get<{ user: AuthResponse["user"] & { profileVerified: boolean; isPremium: boolean } }>(
    "/api/auth/me",
  );
}
