const requiredBase = [
  "EXPO_PUBLIC_API_BASE_URL",
  "EXPO_PUBLIC_FIREBASE_API_KEY",
  "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "EXPO_PUBLIC_FIREBASE_APP_ID",
  "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID",
];

const platform = String(process.env.EAS_BUILD_PLATFORM || process.env.EXPO_PLATFORM || "").toLowerCase();
const requiredForPlatform = platform === "ios"
  ? ["EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID"]
  : platform === "android"
    ? ["EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID"]
    : ["EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID", "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID"];

const required = [...requiredBase, ...requiredForPlatform];
const missing = required.filter((name) => !String(process.env[name] || "").trim());

if (missing.length) {
  console.error("Missing social-auth environment variables:");
  for (const name of missing) console.error(`- ${name}`);
  console.error("Set them in EAS project env or in a local .env before building.");
  process.exit(1);
}

if (process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID !== "let-s-be-parents") {
  console.error("EXPO_PUBLIC_FIREBASE_PROJECT_ID must be let-s-be-parents.");
  process.exit(1);
}

console.log(`Social-auth environment OK for ${platform || "local"} build.`);
