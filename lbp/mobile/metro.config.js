// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Firebase JS SDK v10+ ships its React Native build (getReactNativePersistence,
// the RN-specific `registerAuth("ReactNative")` call, etc.) behind an "exports"
// map condition named "react-native" - see node_modules/@firebase/auth/package.json.
// Metro's package-exports resolver is ON by default (metro-config's own default is
// `unstable_enablePackageExports: true`) but its default `unstable_conditionNames`
// is EMPTY, so that "react-native" condition is never active. Once a package ships
// an "exports" field, Node/Metro's resolution algorithm uses ONLY that map and
// completely ignores legacy fields like the package's top-level "react-native" field
// - so even though @firebase/auth/package.json ALSO has a legacy top-level
// `"react-native": "dist/rn/index.js"` field, it's shadowed and never consulted.
// Net effect: Metro silently falls through to the "default" condition
// (dist/esm2017/index.js, Firebase's browser/ESM build) instead of dist/rn/index.js.
// That browser build never calls `registerAuth("ReactNative")`, so when
// src/firebase.ts calls initializeAuth(), Firebase throws "Component auth has not
// been registered yet" - confirmed on a real device 2026-09-21 via the DEBUG capture
// added in src/firebase.ts/SocialAuthButtons.tsx. This is a known Firebase JS SDK +
// Metro package-exports interaction (firebase/firebase-js-sdk#8377 and similar).
//
// Fix: explicitly add "react-native" to the active condition names so Metro's
// exports resolution actually reaches the branch @firebase/auth already ships for
// this exact purpose. "require" keeps CommonJS resolution working for packages
// that gate on it; "default" preserves the existing fallback for everything else.
config.resolver.unstable_conditionNames = ["require", "react-native", "default"];

module.exports = config;
