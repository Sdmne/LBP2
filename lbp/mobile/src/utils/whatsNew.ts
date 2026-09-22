import AsyncStorage from "@react-native-async-storage/async-storage";

// One-shot "what's new" screen (see screens/WhatsNewScreen.tsx). Keyed by
// a version suffix (v1) rather than a bare flag so a future batch of new
// features can bump this to "whatsnew_v2_seen" and show again to everyone,
// without needing a server-side migration - same idea as the web's own
// "here's what's new since you last looked" framing, just device-local.
const STORAGE_KEY = "whatsnew_v1_seen";

export async function hasSeenWhatsNew(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY)) === "1";
  } catch {
    // Fails "seen" so a storage read error never traps someone behind the
    // screen forever, but also never shows it more than once per successful
    // read - the trade-off already used for chat wallpaper in ChatScreen.tsx.
    return true;
  }
}

export function markWhatsNewSeen() {
  AsyncStorage.setItem(STORAGE_KEY, "1").catch(() => {});
}
