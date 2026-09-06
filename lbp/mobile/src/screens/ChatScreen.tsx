import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { fetchMessages, sendMessage } from "../api/messages";
import { ApiError } from "../api/client";
import type { ConversationMessage } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { useCall } from "../context/CallContext";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Chat">;

// Restyled (Sep 2026) to match the prototype's #scr-chat thread: white
// message bubbles with a soft shadow for incoming, blue (var(--blue)) for
// outgoing, both with a small "tail" corner (4px) instead of the earlier
// symmetric card-style bubbles, plus a pill-shaped input field and a round
// send button (.chat-input-bar). The prototype's header row also folds its
// call/info action into a single circular icon button next to the avatar
// (.chat-header .ic) - this app supports both voice AND video calls
// (member_start_call in main.py takes a callType), so that becomes two
// small icon buttons in the same slot rather than the previous full-width
// "Audio" / "Video" bordered buttons.
export default function ChatScreen({ route }: Props) {
  const { conversationId } = route.params;
  const { user } = useAuth();
  const { startCall } = useCall();
  const { t } = useI18n();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  // Same gating as the web app (member_start_call in main.py): both sides
  // need Premium, the other member needs to be verified - the backend
  // enforces this either way, this is just a friendlier error than a raw
  // 402/409.
  async function handleStartCall(callType: "VOICE" | "VIDEO") {
    setCallError(null);
    try {
      await startCall(conversationId, callType);
    } catch (err) {
      setCallError(err instanceof ApiError ? err.message : t("chat.callErrorDefault"));
    }
  }

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetchMessages(conversationId);
      setMessages(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("chat.loadError"));
    }
  }, [conversationId, t]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setDraft("");
    try {
      const res = await sendMessage(conversationId, body);
      // The send endpoint only echoes back id/conversationId/senderProfileId/
      // body (see api/messages.ts) - fill in the rest locally so this matches
      // the shape the GET .../messages list would eventually return.
      const sent: ConversationMessage = {
        id: res.message.id,
        conversationId: res.message.conversationId,
        senderProfileId: res.message.senderProfileId,
        body: res.message.body,
        mediaUrl: null,
        created_at: new Date().toISOString(),
        deliveredAt: null,
        readAt: null,
        status: "ACTIVE",
      };
      setMessages((prev) => [...prev, sent]);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (err) {
      // Give the text back so nothing is lost - but only if the person
      // hasn't already started typing something new in the meantime,
      // otherwise this would clobber their newer draft.
      setDraft((current) => (current ? current : body));
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.pink} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <View style={styles.toolbar}>
        <Pressable style={styles.iconButton} onPress={() => void handleStartCall("VOICE")}>
          <Text style={styles.iconButtonText}>📞</Text>
        </Pressable>
        <Pressable style={styles.iconButton} onPress={() => void handleStartCall("VIDEO")}>
          <Text style={styles.iconButtonText}>🎥</Text>
        </Pressable>
      </View>
      {callError ? <Text style={styles.errorBanner}>{callError}</Text> : null}
      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
      <View style={styles.chatBg}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const isMine = user?.profileId != null && item.senderProfileId === user.profileId;
            return (
              <View style={[styles.msgRow, isMine ? styles.msgRowOut : styles.msgRowIn]}>
                <View style={[styles.bubble, isMine ? styles.bubbleOut : styles.bubbleIn]}>
                  <Text style={isMine ? styles.bubbleTextOut : styles.bubbleTextIn}>{item.body}</Text>
                </View>
              </View>
            );
          }}
        />
      </View>
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={t("chat.placeholder")}
          placeholderTextColor={colors.muted}
          multiline
        />
        <Pressable style={[styles.sendButton, (sending || !draft.trim()) && styles.sendButtonDisabled]} onPress={handleSend} disabled={sending || !draft.trim()}>
          <Text style={styles.sendButtonText}>{sending ? "…" : "➤"}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorBanner: { color: colors.danger, textAlign: "center", padding: spacing.xs },
  toolbar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.card,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.tintPink,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonText: { fontSize: 15 },
  chatBg: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.md, gap: 4 },
  msgRow: { flexDirection: "row", marginBottom: 10 },
  msgRowIn: { justifyContent: "flex-start" },
  msgRowOut: { justifyContent: "flex-end" },
  bubble: { maxWidth: "76%", paddingHorizontal: 13, paddingVertical: 10, borderRadius: 16 },
  bubbleIn: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: 4,
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  bubbleOut: { backgroundColor: colors.blue, borderBottomRightRadius: 4 },
  bubbleTextIn: { color: colors.ink, fontSize: 15, lineHeight: 20 },
  bubbleTextOut: { color: colors.white, fontSize: 15, lineHeight: 20 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    maxHeight: 120,
    fontSize: 15,
    color: colors.ink,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { color: colors.white, fontWeight: "700", fontSize: 15 },
});
