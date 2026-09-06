import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import Constants, { ExecutionEnvironment } from "expo-constants";
import type { Room as RoomType } from "livekit-client";
import * as callsApi from "../api/calls";
import { ApiError } from "../api/client";
import type { CallInfo, CallKind } from "../api/types";
import { useAuth } from "./AuthContext";
import { useI18n } from "../i18n/I18nContext";

// Mirrors lbp/frontend/src/ui.tsx's CallManager component as closely as an
// app with no DOM can: same polling loop (GET /api/member/calls/incoming
// every 3s while logged in and not already on a call - there's no
// push/websocket for this in the backend yet), same state machine
// (incoming -> accept/decline -> active -> end). The actual media
// connection is necessarily different (see connectRoom below) because RN
// has no HTMLMediaElement to .attach() a track to.
//
// IMPORTANT - this piece needs a custom dev build, not Expo Go:
// @livekit/react-native ships native WebRTC code (via
// @livekit/react-native-webrtc), which Expo Go does not include. After
// `npx expo install @livekit/react-native @livekit/react-native-webrtc
// @config-plugins/react-native-webrtc` (see README), you need
// `npx expo prebuild` and a real dev-client build (`eas build --profile
// development` or a local Xcode/Android Studio build) to actually test
// calls - Expo Go will crash/no-op on this screen. Everything else in the
// app keeps working fine in Expo Go.

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// `Room`/`RoomEvent` (livekit-client) and `AudioSession` (@livekit/react-
// native) are require()'d here instead of statically imported, and only
// outside Expo Go. A static `import { Room } from "livekit-client"` at the
// top of this file would run the moment ANYTHING imports CallProvider -
// which App.tsx does unconditionally - so it would execute even though
// every actual USE of Room below was already guarded by `isExpoGo`. That
// mismatch (import always runs, usage sometimes guarded) is exactly what
// caused the app to crash with "WebRTC native module not found" the first
// time this was "fixed": the guard skipped calling the native code, but not
// loading the module that reaches for it. require() inside `if (!isExpoGo)`
// defers actually loading the module until this line runs, so in Expo Go
// it never loads at all. `Room` is still used as a TYPE below (for
// `roomRef` and `CallContextValue.room`) via a type-only import, which
// TypeScript erases completely at compile time - that half is always safe.
let Room: typeof import("livekit-client").Room;
let RoomEvent: typeof import("livekit-client").RoomEvent;
let AudioSession: typeof import("@livekit/react-native").AudioSession;
if (!isExpoGo) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ({ Room, RoomEvent } = require("livekit-client"));
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ({ AudioSession } = require("@livekit/react-native"));
}

type CallContextValue = {
  incoming: CallInfo | null;
  active: CallInfo | null;
  room: RoomType | null;
  connectionState: string;
  startCall: (conversationId: number, callType: CallKind) => Promise<void>;
  acceptIncoming: () => Promise<void>;
  declineIncoming: () => Promise<void>;
  endActive: () => Promise<void>;
};

const CallContext = createContext<CallContextValue | undefined>(undefined);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { t } = useI18n();
  const [incoming, setIncoming] = useState<CallInfo | null>(null);
  const [active, setActive] = useState<CallInfo | null>(null);
  const [connectionState, setConnectionState] = useState("");
  const roomRef = useRef<RoomType | null>(null);
  // Guards the incoming-call poll against out-of-order responses: each poll
  // tags itself with the next sequence number, and only applies its result
  // if it's still the most recent one issued by the time it resolves. Two
  // races this closes:
  //  1. Overlapping GETs resolving out of order (a slow poll's response
  //     landing after a faster, later poll's) used to let stale data
  //     clobber fresher data.
  //  2. accept/declineIncoming bump the sequence themselves, so a poll
  //     already in flight when the user acts can no longer resurrect the
  //     call they just accepted/declined once it resolves.
  const pollSeqRef = useRef(0);

  // Poll for incoming calls, same cadence as the web app. This needs no
  // LiveKit code at all (just a plain GET), so it runs fine in Expo Go too
  // - a person can see an incoming-call banner there, they just can't
  // connect to it (see the effect below).
  useEffect(() => {
    if (!isAuthenticated || active) return;
    let alive = true;
    const poll = () => {
      const seq = ++pollSeqRef.current;
      callsApi
        .fetchIncomingCalls()
        .then((res) => {
          if (alive && seq === pollSeqRef.current) setIncoming(res.items?.[0] || null);
        })
        .catch(() => undefined);
    };
    poll();
    const timer = setInterval(poll, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [isAuthenticated, active]);

  // Connect/disconnect the LiveKit room whenever `active` (a call with a
  // serverUrl+token, i.e. one we started or accepted) changes.
  useEffect(() => {
    if (!active?.serverUrl || !active.token) {
      roomRef.current = null;
      return;
    }
    if (isExpoGo) {
      // Room/RoomEvent/AudioSession were never require()'d in Expo Go (see
      // above) - `new Room()` would throw "Room is not a constructor".
      // Fail fast with the same "couldn't connect" message instead.
      setConnectionState(t("callOverlay.unableToConnect"));
      setActive(null);
      return;
    }
    let cancelled = false;
    const room = new Room();
    roomRef.current = room;
    room.on(RoomEvent.Disconnected, () => {
      if (!cancelled) {
        setConnectionState(t("callOverlay.callEnded"));
        setActive(null);
      }
    });

    (async () => {
      try {
        setConnectionState(t("callOverlay.connecting"));
        await AudioSession.startAudioSession();
        await room.connect(active.serverUrl!, active.token!);
        await room.localParticipant.setMicrophoneEnabled(true);
        if (active.callType === "VIDEO") {
          await room.localParticipant.setCameraEnabled(true);
        }
        if (!cancelled) setConnectionState(t("callOverlay.connected"));
      } catch (err) {
        if (!cancelled) {
          setConnectionState(t("callOverlay.unableToConnect"));
          setActive(null);
        }
      }
    })();

    return () => {
      cancelled = true;
      room.disconnect();
      AudioSession.stopAudioSession().catch(() => {});
      if (roomRef.current === room) roomRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, active?.serverUrl, active?.token]);

  const value = useMemo<CallContextValue>(
    () => ({
      incoming,
      active,
      room: roomRef.current,
      connectionState,
      async startCall(conversationId, callType) {
        const res = await callsApi.startCall(conversationId, callType);
        setActive(res.call);
      },
      async acceptIncoming() {
        if (!incoming) return;
        const call = incoming;
        pollSeqRef.current += 1; // invalidate any in-flight poll response for this call
        setIncoming(null);
        try {
          const res = await callsApi.acceptCall(call.id);
          setActive(res.call);
        } catch (err) {
          setConnectionState(err instanceof ApiError ? err.message : t("callOverlay.noLongerAvailable"));
        }
      },
      async declineIncoming() {
        if (!incoming) return;
        const call = incoming;
        pollSeqRef.current += 1; // invalidate any in-flight poll response for this call
        setIncoming(null);
        try {
          await callsApi.declineCall(call.id);
        } catch {
          // Best-effort - the caller's side will eventually time out anyway.
        }
      },
      async endActive() {
        if (!active) return;
        const call = active;
        setActive(null);
        roomRef.current?.disconnect();
        try {
          await callsApi.endCall(call.id);
        } catch {
          // Best-effort - media is already torn down locally either way.
        }
      },
    }),
    [incoming, active, connectionState, t]
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used inside <CallProvider>");
  return ctx;
}
