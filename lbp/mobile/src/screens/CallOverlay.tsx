import React from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Track } from "livekit-client";
import { RoomContext, useTracks, VideoTrack } from "@livekit/react-native";
import { useCall } from "../context/CallContext";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";

// Renders globally (mounted once in App.tsx, inside <CallProvider>) so an
// incoming call shows up no matter which screen the person is on - same
// idea as the web app's <CallManager/> being mounted at the top of the app
// rather than tied to one route.
export default function CallOverlay() {
  const { incoming, active, room, connectionState, acceptIncoming, declineIncoming, endActive } = useCall();
  const { t } = useI18n();

  return (
    <>
      <Modal visible={!!incoming} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.eyebrow}>
              {incoming?.callType === "VIDEO" ? t("callOverlay.incomingVideo") : t("callOverlay.incomingVoice")}
            </Text>
            <Text style={styles.peerName}>{incoming?.peerName}</Text>
            <View style={styles.actionsRow}>
              <Pressable style={[styles.actionButton, styles.declineButton]} onPress={() => void declineIncoming()}>
                <Text style={styles.declineText}>{t("callOverlay.decline")}</Text>
              </Pressable>
              <Pressable style={[styles.actionButton, styles.acceptButton]} onPress={() => void acceptIncoming()}>
                <Text style={styles.acceptText}>{t("callOverlay.accept")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!active} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.eyebrow}>
              {active?.callType === "VIDEO" ? t("callOverlay.videoCallLabel") : t("callOverlay.voiceCallLabel")}
            </Text>
            <Text style={styles.peerName}>{active?.peerName}</Text>
            <Text style={styles.status}>{connectionState || t("callOverlay.calling")}</Text>

            {room ? (
              <RoomContext.Provider value={room}>
                <CallMedia isVideo={active?.callType === "VIDEO"} />
              </RoomContext.Provider>
            ) : (
              <ActivityIndicator color={colors.white} style={{ marginVertical: spacing.lg }} />
            )}

            <Pressable style={styles.endButton} onPress={() => void endActive()}>
              <Text style={styles.endText}>{t("callOverlay.endCall")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

// Renders remote (and, for video calls, local) camera tracks. Audio tracks
// need no UI - @livekit/react-native routes subscribed audio to the device
// speaker/earpiece automatically once AudioSession is started (see
// CallContext), unlike the web where CallManager manually .attach()es each
// audio track to a hidden <audio> element.
function CallMedia({ isVideo }: { isVideo: boolean }) {
  const { t } = useI18n();
  const tracks = useTracks([Track.Source.Camera]);
  if (!isVideo) return null;
  if (!tracks.length) {
    return (
      <View style={styles.videoPlaceholder}>
        <Text style={styles.status}>{t("callOverlay.waitingVideo")}</Text>
      </View>
    );
  }
  return (
    <View style={styles.videoArea}>
      {tracks.map((trackRef) => (
        <VideoTrack key={trackRef.publication.trackSid} trackRef={trackRef} style={styles.video} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  card: { width: "100%", maxWidth: 420, backgroundColor: "#1b1b26", borderRadius: radius.lg, padding: spacing.xl, alignItems: "center" },
  eyebrow: { color: "#b8b8d0", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  peerName: { color: colors.white, fontSize: 22, fontWeight: "800", marginTop: spacing.xs },
  status: { color: "#b8b8d0", fontSize: 14, marginTop: spacing.sm },
  actionsRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xl, width: "100%" },
  actionButton: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, paddingVertical: 14 },
  declineButton: { backgroundColor: "rgba(255,255,255,0.12)" },
  declineText: { color: colors.white, fontWeight: "700" },
  acceptButton: { backgroundColor: colors.success },
  acceptText: { color: colors.white, fontWeight: "700" },
  endButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.danger,
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    width: "100%",
    alignItems: "center",
  },
  endText: { color: colors.white, fontWeight: "700" },
  videoArea: { width: "100%", height: 260, marginTop: spacing.lg, borderRadius: radius.lg, overflow: "hidden", backgroundColor: "#000" },
  video: { width: "100%", height: "100%" },
  videoPlaceholder: {
    width: "100%",
    height: 180,
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
});
