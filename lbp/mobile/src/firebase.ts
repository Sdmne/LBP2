import { initializeApp, getApps } from "firebase/app";
// Import directly from "@firebase/auth" instead of the "firebase/auth"
// umbrella package. History: with real EXPO_PUBLIC_FIREBASE_* values set,
// this crashed the entire app on launch with "Component auth has not been
// registered yet" (thrown deep inside @firebase/component, meaning the
// "auth" component was never registered against this app's container at
// all) - confirmed on a real device 2026-09-21, not just a theoretical
// risk. Root cause: Metro was resolving the "firebase/auth" umbrella
// package to its default (web) build instead of the React Native one, most
// likely a package-exports condition-resolution quirk across firebase's
// umbrella-package -> @firebase/auth re-export chain. @firebase/auth's own
// package.json unambiguously points "react-native" (both as a legacy
// top-level field AND as an exports condition) at dist/rn/index.js, with
// no re-export chain in between for Metro to lose track of - importing it
// directly removes the ambiguity entirely.
// @ts-expect-error - getReactNativePersistence really is exported at
// runtime (node_modules/@firebase/auth/dist/rn/index.js - that file's own
// source recommends importing it exactly this way). tsc doesn't apply the
// "react-native" resolution condition, so it only sees the default (web)
// typings and reports this import as invalid - a type-checker-only false
// positive, not a real bug.
import { initializeAuth, getAuth, getReactNativePersistence, type Auth } from "@firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FIREBASE_CONFIG } from "./config";

// Mirrors lbp/frontend/src/firebase-auth.ts's initializeApp() call, but for
// React Native: the web version uses getAuth() + browserLocalPersistence
// (a real browser's localStorage); RN has neither, so it needs
// initializeAuth() with an explicit AsyncStorage-backed persistence instead
// (getReactNativePersistence is the Firebase JS SDK's own RN entry point
// for this - added specifically so apps like this one don't have to hand-
// roll token persistence).
const isConfigured = Object.values(FIREBASE_CONFIG).every(Boolean);

// TEMPORARY DIAGNOSTIC (2026-09-21): captures the real error text from the
// catch block below so SocialAuthButtons.tsx can show it on screen - no
// device log access to read `console.error` output directly otherwise.
// Remove once Google/Apple sign-in is confirmed working end to end.

let auth: Auth | null = null;
if (isConfigured) {
  // Whatever goes wrong in here (wrong bundle resolution, a bad config
  // value, anything) must never crash the WHOLE app on launch again - the
  // 2026-09-21 incident above took down every screen, not just Google/Apple
  // sign-in. Worst case now: auth stays null and the social buttons stay
  // disabled, exactly like the "not configured yet" case always did.
  try {
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
  } catch (err) {
    console.error("[firebase] Auth failed to initialize - Google/Apple sign-in disabled, rest of the app unaffected", err);
    auth = null;
  }
} else {
  console.error("[firebase] Auth configuration is incomplete - Google/Apple sign-in disabled");
}

export const firebaseAuth = auth;
