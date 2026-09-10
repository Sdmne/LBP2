import { initializeApp, getApps } from "firebase/app";
// @ts-expect-error - getReactNativePersistence really is exported at
// runtime (verified against the installed firebase@10.14.1: it's defined
// in node_modules/@firebase/auth/dist/rn/index.js, which is what Metro's
// bundler is SUPPOSED to resolve "firebase/auth" to on React Native via
// the "react-native" package-export condition - that file's own source
// even recommends importing it exactly this way). tsc doesn't apply that
// same condition when it follows firebase/auth's `export * from
// '@firebase/auth'` re-export chain, so it only sees the default (web)
// typings and reports this import as invalid - a type-checker-only false
// positive, not a real bug in ITS OWN RIGHT. (See the bigger caveat below
// about whether the RUNTIME resolution is actually landing on the RN
// build either.)
import { initializeAuth, getAuth, getReactNativePersistence, type Auth } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FIREBASE_CONFIG } from "./config";

// Mirrors lbp/frontend/src/firebase-auth.ts's initializeApp() call, but for
// React Native: the web version uses getAuth() + browserLocalPersistence
// (a real browser's localStorage); RN has neither, so it needs
// initializeAuth() with an explicit AsyncStorage-backed persistence instead
// (getReactNativePersistence is the Firebase JS SDK's own RN entry point
// for this - added specifically so apps like this one don't have to hand-
// roll token persistence).
//
// UPDATE after the first real device run: this crashed the entire app on
// launch with "Component auth has not been registered yet" (thrown deep
// inside @firebase/component, meaning the "auth" component was never
// registered against this app's container at all - a strong sign Metro
// resolved "firebase/auth" to the wrong (web) build rather than the RN one
// referenced above, likely a package-exports condition-resolution quirk
// across firebase's umbrella-package -> @firebase/auth re-export chain).
// I could not reproduce/debug this myself (no way to actually run Metro
// here), so rather than guess further and risk a worse regression, this
// now skips initializing Firebase Auth ENTIRELY while it isn't configured
// (all EXPO_PUBLIC_FIREBASE_* values are blank right now anyway per
// .env.example - the 3 pending items from the team). SocialAuthButtons.tsx
// already handles `firebaseAuth` being unusable gracefully (same as it
// already does when the Google client ID alone is missing).
//
// IMPORTANT: once real Firebase values are filled in, re-test this. If the
// SAME "Component auth has not been registered yet" crash comes back, the
// next thing to try is importing directly from "@firebase/auth" instead of
// the "firebase/auth" umbrella package - @firebase/auth's own package.json
// unambiguously points "react-native" (both as a legacy top-level field
// AND as an exports condition) at dist/rn/index.js, with no re-export
// chain in between for Metro to lose track of.
const isConfigured = Object.values(FIREBASE_CONFIG).every(Boolean);

let auth: Auth | null = null;
if (isConfigured) {
  const app = getApps().length ? getApps()[0]! : initializeApp(FIREBASE_CONFIG, "lbp-mobile");
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // initializeAuth() throws if called more than once for the same app
    // (e.g. Fast Refresh re-running this module) - fall back to the
    // already-initialized instance rather than crashing.
    auth = getAuth(app);
  }
}

export const firebaseAuth = auth;
