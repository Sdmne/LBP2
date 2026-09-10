// Single place that knows how to reach the real LBP2 backend (the same
// FastAPI service that powers letsbeparents.com - see lbp/backend/main.py).
// Change this by setting EXPO_PUBLIC_API_BASE_URL in a .env file (see
// .env.example) rather than editing this file, so switching between local
// dev and the real deployed backend never touches code.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") || "http://localhost:8000";

// Where static, non-API files served by the website's own build (not the
// FastAPI backend) live - e.g. the Resources & Tools .docx downloads at
// /web-static/resources/*.docx. Traced this by reading the real
// lbp/frontend/src/api.ts: in production it calls "/api/..." as a *relative*
// path with credentials: "same-origin", which only works if the website and
// the API are served from the same origin (a reverse proxy routing /api/*
// to FastAPI and everything else, including /web-static/*, to the frontend's
// static build) - not a separate api.* subdomain. So this defaults to the
// same value as API_BASE_URL. If it turns out the real deployment actually
// does put the API on its own subdomain, set EXPO_PUBLIC_SITE_BASE_URL
// separately in .env to the real website origin.
export const SITE_BASE_URL =
  process.env.EXPO_PUBLIC_SITE_BASE_URL?.replace(/\/+$/, "") || API_BASE_URL;

// Same Firebase project the website already uses for "Continue with Google"
// / "Continue with Apple" (see lbp/frontend/src/firebase-auth.ts - the
// backend's POST /api/auth/firebase expects a real Firebase ID token, not a
// raw Google/Apple one, so the app has to go through this same Firebase
// project, not a separate one). These are the public "client config" values
// Firebase itself calls safe to ship in an app (they identify the project,
// they don't authenticate anything by themselves) - get them from Firebase
// Console -> Project settings -> General -> "Your apps" (add an iOS/Android
// app there if one doesn't exist yet, or reuse the existing Web app's
// config - the values are the same project-wide). See .env.example.
export const FIREBASE_CONFIG = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "",
};

// Google OAuth client IDs for expo-auth-session's Google provider (used by
// src/components/SocialAuthButtons.tsx). Firebase auto-creates a "Web
// client" the moment Google sign-in is enabled in the Firebase console -
// find it in Google Cloud Console -> APIs & Services -> Credentials (same
// GCP project as the Firebase project above). iOS/Android client IDs are
// separate entries in that same list; create them there if they don't exist
// yet. See .env.example for exactly which one goes where.
export const GOOGLE_OAUTH_CLIENT_IDS = {
  ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "",
  android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "",
  web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "",
};
