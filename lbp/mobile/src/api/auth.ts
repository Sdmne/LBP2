import { api } from "./client";
import type { AuthResponse, PublicUser } from "./types";

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

// UPDATE (Sept 2026): the backend now issues a 6-digit code alongside the
// verification link on every local signup/resend (see main.py's
// issue_email_verification_code/send_auth_action_email), matching the
// prototype's #scr-verify-code design - VerifyCodeScreen is a blocking gate
// (an authenticated-but-unverified user sees only this screen; see
// RootNavigator), not a skippable notice.
//
// POST /api/auth/email-verification/code/confirm - auth_confirm_email_code()
// in main.py. Rate-limited to 10 failed attempts per 15 minutes
// (429 "TOO_MANY_CODE_ATTEMPTS"); a wrong/expired code is a 400.
export function confirmEmailCode(code: string) {
  return api.post<{ ok: true; status: string; user: PublicUser }>(
    "/api/auth/email-verification/code/confirm",
    { code },
  );
}

// POST /api/auth/email-verification/resend - auth_resend_verification() in
// main.py. Reissues and resends both the link and the 6-digit code,
// throttled to once per AUTH_EMAIL_RESEND_SECONDS (60s). Returns status
// "EMAIL_SENT", "EMAIL_RECENTLY_SENT", "EMAIL_ALREADY_VERIFIED", or
// "EMAIL_DELIVERY_FAILED" rather than an error - VerifyCodeScreen reads
// `status` to decide what to show, not just `ok`.
export function resendEmailVerification(locale = "en") {
  return api.post<{ ok: true; status: string }>("/api/auth/email-verification/resend", { locale });
}

// POST /api/member/account-deletion - member_account_deletion() in main.py.
// Ends access immediately (revokes all sessions, flags the profile/user
// DELETION_PENDING) and schedules permanent deletion ACCOUNT_DELETION_DAYS
// (30) days out - see DeleteAccountScreen.
export function requestAccountDeletion(reason: string, details = "") {
  return api.post<{ ok: true; status: string; deleteAfter: string }>("/api/member/account-deletion", {
    reason,
    details,
    confirmation: "DELETE",
  });
}

export function me() {
  return api.get<{ user: AuthResponse["user"] & { profileVerified: boolean; isPremium: boolean; profileCompleteness: number } }>(
    "/api/auth/me",
  );
}
