// react-native-gesture-handler's own setup docs require this import to be
// the very first line of the app's entry file (before React, before
// anything else) - it patches some native event handling that has to be in
// place before other modules touch it. Needed for the swipeable Browse
// card stack in CatalogScreen.tsx.
import "react-native-gesture-handler";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Updates from "expo-updates";
import { AuthProvider } from "./src/context/AuthContext";
import { CallProvider } from "./src/context/CallContext";
import { I18nProvider } from "./src/i18n/I18nContext";
import RootNavigator from "./src/navigation/RootNavigator";

// Needed once, before any LiveKit Room is created, so livekit-client's
// WebRTC calls (RTCPeerConnection etc., normally browser globals) resolve
// to react-native-webrtc's native implementation instead. See the comment
// in src/context/CallContext.tsx about why this whole feature needs a
// custom dev build rather than Expo Go.
//
// BUT registerGlobals() itself reaches into that same native WebRTC module
// - which does NOT exist inside the plain Expo Go app, only in a custom
// dev-client build. The FIRST fix here only skipped *calling*
// registerGlobals() in Expo Go, using a normal `import { registerGlobals }
// from "@livekit/react-native"` at the top of the file - but a static
// import runs the moment this file loads, regardless of any `if` below it
// (imports are hoisted). @livekit/react-native's own module code reaches
// for the native WebRTC module as soon as IT loads, so the app still
// crashed with "WebRTC native module not found" even though
// registerGlobals() itself was never called.
//
// The real fix: use require() instead of import, inside the `if`, so the
// module isn't even loaded in Expo Go - not just left uncalled. Same
// reasoning applies to CallOverlay below (it statically imports
// RoomContext/useTracks/VideoTrack from @livekit/react-native) and to
// src/context/CallContext.tsx (Room/RoomEvent/AudioSession) - see the
// comments there.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
if (!isExpoGo) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { registerGlobals } = require("@livekit/react-native");
  registerGlobals();
}

// CallOverlay is the always-mounted call UI (incoming-call modal, active-call
// screen) - it needs to exist even when no call is active, so it can't just
// be skipped via a prop. Loading it via require() only outside Expo Go means
// its own @livekit/react-native import never runs there either; in Expo Go
// it's swapped for a component that renders nothing (the call feature
// already needs a dev-client build to do anything real, per CallContext.tsx).
const CallOverlay: React.ComponentType = isExpoGo
  ? () => null
  : // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("./src/screens/CallOverlay").default;

export default function App() {
  // Alena repeatedly reported "I ran eas update but the screens don't
  // change" - expo-updates' default behavior only *checks* for a new
  // update in the background on cold start; it still launches with
  // whichever bundle was already installed, and only actually switches to
  // the new one on the *next* full close+reopen. Nothing here was broken,
  // but requiring two relaunches after every publish is an easy thing to
  // miss and looks exactly like "nothing changed". Check for and apply any
  // pending update right on launch instead, so one relaunch after
  // `eas update` is enough. Updates.isEnabled is false in Expo Go/dev
  // builds, matching the isExpoGo guard already used below - a no-op
  // there, and any failure (offline, update server unreachable) just
  // leaves the app running its currently installed bundle.
  useEffect(() => {
    if (!Updates.isEnabled) return;
    (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (check.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch {
        // Offline or update server unreachable - keep running as-is.
      }
    })();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <I18nProvider>
            <CallProvider>
              <StatusBar style="dark" />
              <RootNavigator />
              <CallOverlay />
            </CallProvider>
          </I18nProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
