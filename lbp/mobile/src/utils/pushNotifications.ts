import { Platform } from "react-native";
// KNOWN GAP: expo-device/expo-notifications are not yet in package.json -
// this sandbox's network egress can't reach the npm registry to resolve
// the right SDK-57-compatible versions (`npx expo install` needs that
// lookup), so `npx tsc --noEmit` currently reports these two imports as
// unresolved. That is the ONLY thing left before this file is real: the
// developer runs `npx expo install expo-notifications expo-device` (the
// standard, correct way to add any Expo module - it picks the right
// version automatically) as step one of building item 16, which will also
// make these two lines type-check. Every other file in this diff already
// type-checks clean; this file's logic itself follows the standard,
// widely-used expo-notifications registration pattern.
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { registerPushToken, unregisterPushToken } from "../api/pushTokens";

// Item 16 of Alena's backlog - push notifications. Alena chose to build
// this ahead of time ("Начать код сейчас") even though expo-notifications
// is a brand-new native module that can't reach anyone's phone until the
// developer runs `npx expo install expo-notifications expo-device` and
// ships a full new `eas build` - a plain `eas update` (everything else
// built this session) cannot deliver a new native module. Until that
// build exists, this file is inert dead code shipped early on purpose.
//
// Sets the app-wide handler once, at import time (same pattern
// expo-notifications' own docs use) - without it, a notification that
// arrives while the app is in the foreground is silently swallowed
// instead of showing a banner/sound.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Requests permission and registers this device's Expo push token with our
// backend (POST /api/member/push-tokens - see member_register_push_token
// in main.py). Returns the token on success so the caller (AuthContext)
// can hand it back to unregisterCurrentPushToken() on logout; returns null
// for every failure case (simulator, permission denied, no project id,
// network error) - push is a nice-to-have that must never block sign-in.
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    // Simulators/emulators can't receive real pushes - Device.isDevice is
    // false there, so skip the permission prompt entirely rather than
    // asking for something that can never work.
    if (!Device.isDevice) return null;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== "granted") return null;

    const projectId: string | undefined = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return null;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return null;

    await registerPushToken(token, Platform.OS);
    return token;
  } catch {
    return null;
  }
}

// Called from AuthContext's logout() with whatever token
// registerForPushNotifications() last returned, so a shared/reset device
// stops receiving this person's pushes once they've signed out of it.
export async function unregisterCurrentPushToken(token: string | null) {
  if (!token) return;
  try {
    await unregisterPushToken(token);
  } catch {
    // Best-effort, same as the registration side - worst case a stale
    // token just lingers until PUSH_TOKENS_MAX_PER_PROFILE evicts it.
  }
}
