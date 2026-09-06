import { initializeApp, getApps } from "firebase/app";
// @ts-expect-error React Native persistence is exported by the runtime entry point.
import { initializeAuth, getAuth, getReactNativePersistence, type Auth } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FIREBASE_CONFIG } from "./config";

const isConfigured = Object.values(FIREBASE_CONFIG).every(Boolean);

let auth: Auth | null = null;
if (isConfigured) {
  const app = getApps().find((candidate) => candidate.name === "lbp-mobile")
    ?? initializeApp(FIREBASE_CONFIG, "lbp-mobile");
  if (app.options.projectId !== "parents-698f8") {
    throw new Error("Firebase configuration must use project parents-698f8.");
  }
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    if ((error as { code?: string }).code !== "auth/already-initialized") throw error;
    auth = getAuth(app);
  }
}

export const firebaseAuth = auth;
