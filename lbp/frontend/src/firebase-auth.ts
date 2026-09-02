import { initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  OAuthProvider,
  browserLocalPersistence,
  getAuth,
  setPersistence,
  signInWithPopup,
} from "firebase/auth";
import { createApiClient } from "./api";

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}, "lbp-web");

const auth = getAuth(app);
const api = createApiClient("/api");

export type SocialProvider = "google" | "apple";
export type SocialSession = {
  user: Record<string, unknown>;
  isNewUser: boolean;
};

export async function signInWithSocial(providerName: SocialProvider, intent: "login" | "register"): Promise<SocialSession> {
  await setPersistence(auth, browserLocalPersistence);
  const provider = providerName === "google" ? new GoogleAuthProvider() : new OAuthProvider("apple.com");
  if (providerName === "google") provider.setCustomParameters({ prompt: "select_account" });
  else {
    provider.addScope("email");
    provider.addScope("name");
  }
  const result = await signInWithPopup(auth, provider);
  const idToken = await result.user.getIdToken();
  const response = await api.post<SocialSession>("/auth/firebase", {
    idToken,
    displayName: result.user.displayName || null,
    intent,
  });
  return {
    user: response.user,
    isNewUser: response.isNewUser === true,
  };
}

export function socialErrorMessage(error: unknown): string {
  const value = error as { code?: string; message?: string };
  const raw = String(value?.code || value?.message || "");
  let detail = raw;
  try {
    const parsed = JSON.parse(raw) as { detail?: unknown; message?: unknown };
    detail = String(parsed.detail || parsed.message || raw);
  } catch {
    // Firebase SDK errors are plain strings; API errors may be JSON.
  }
  const code = `${raw} ${detail}`.toLowerCase();
  if (code.includes("popup-closed-by-user") || code.includes("cancelled-popup-request")) return "The sign-in window was closed before completion.";
  if (code.includes("popup-blocked")) return "Your browser blocked the sign-in window. Allow pop-ups and try again.";
  if (code.includes("unauthorized-domain")) return "This domain is not authorised for social sign-in yet. Please use the approved environment or contact support.";
  if (code.includes("operation-not-allowed")) return "This sign-in method is not configured yet.";
  if (code.includes("social_account_conflict") || code.includes("account-exists-with-different-credential")) return "An account with this email already exists. Sign in with its existing method.";
  if (code.includes("social_account_not_found") || code.includes("user-not-found")) return "No account exists for this social identity. Create an account first.";
  if (code.includes("account_inactive")) return "This account is not active.";
  if (code.includes("invalid or expired firebase session")) return "The social sign-in session expired before it could be confirmed. Please try again.";
  if (code.includes("firebase authentication is unavailable")) return "Social sign-in is temporarily unavailable. Please try again shortly.";
  return "Social sign-in failed. Please try again.";
}
