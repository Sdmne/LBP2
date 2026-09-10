import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { deleteConversation, fetchConversationPeerProfile, fetchMessages, sendAttachment, sendMessage } from "../api/messages";
import { blockProfile } from "../api/blocks";
import { ApiError } from "../api/client";
import type { ConversationMessage } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { useCall } from "../context/CallContext";
import { useI18n } from "../i18n/I18nContext";
import { Feather } from "@expo/vector-icons";
import { colors, radius, spacing } from "../theme";
import ChatWallpaper from "../components/ChatWallpaper";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Chat">;

// Prototype's #scr-chat .emoji-strip quick-react row (see the reference
// screenshot Alena sent) - the exact same 16 emoji, in the same order.
const QUICK_EMOJI = ["😀", "😂", "🥰", "😊", "😍", "🤔", "😉", "😢", "👍", "👋", "🙏", "❤️", "🔥", "🎉", "👶", "😅"];

function looksLikeImageUrl(url: string): boolean {
  return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url);
}

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
export default function ChatScreen({ route, navigation }: Props) {
  const { conversationId, title } = route.params;
  const insets = useSafeAreaInsets();
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
  // The route only carries a conversationId + display title (see
  // RootNavigator) - Report/Block need the OTHER person's actual profile
  // id, which nothing on this screen had until now. Fetched once,
  // best-effort: if it fails, Report/Block just stay disabled rather than
  // blocking the whole screen over a menu nobody may even open.
  const [peerProfileId, setPeerProfileId] = useState<number | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [menuBusy, setMenuBusy] = useState(false);
  // Chat image attachments were reported as rendering blank with no
  // visible error (Alena's "файл так и не прикрепился и в чате его нет") -
  // the bare <Image> had no onError handler, so a failed load (bad URL,
  // network hiccup, moderation-rejected upload) just showed nothing.
  // Tracks which message ids failed to load so a real fallback (icon +
  // message + open-in-browser) renders instead of empty space.
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchConversationPeerProfile(conversationId)
      .then((res) => setPeerProfileId(Number(res.profileId)))
      .catch(() => undefined);
  }, [conversationId]);

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

  // Prototype's #scr-chat .clip button - real now, was a report-only gap
  // (backend already had POST .../attachments built, nothing on mobile
  // called it). Images only via the picker (same as PhotosScreen); the
  // backend also accepts PDFs but there's no "pick a document" UI here yet.
  async function handleAttach() {
    if (attaching) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("chat.attachPermissionTitle"), t("chat.attachPermissionBody"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setAttaching(true);
    try {
      const sent = await sendAttachment(conversationId, result.assets[0].uri);
      setMessages((prev) => [...prev, sent]);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (err) {
      Alert.alert(t("chat.attachError"), err instanceof ApiError ? err.message : t("common.pleaseTryAgain"));
    } finally {
      setAttaching(false);
    }
  }

  function insertEmoji(emoji: string) {
    setDraft((prev) => prev + emoji);
  }

  // The prototype's #scr-chat has no header overflow menu at all (its
  // ".dots" is just the mockup's fake status-bar signal dots, not a real
  // button) - Alena asked for Block/Report/Delete from inside the chat
  // itself, same actions ProfileDetailScreen already has, just reachable
  // from here too. Reuses the same real endpoints (blockProfile,
  // deleteConversation - both already exist/now exist in api/), not new
  // fake buttons.
  function handleReport() {
    setMenuVisible(false);
    if (!peerProfileId) return;
    navigation.navigate("ReportProfile", { profileId: peerProfileId, displayName: title });
  }

  function handleBlock() {
    setMenuVisible(false);
    if (!peerProfileId) return;
    Alert.alert(t("profileDetail.blockConfirmTitle"), t("profileDetail.blockConfirmBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("profileDetail.blockConfirm"),
        style: "destructive",
        onPress: async () => {
          setMenuBusy(true);
          try {
            await blockProfile(peerProfileId);
            navigation.goBack();
          } catch (err) {
            Alert.alert(t("profileDetail.blockError"), err instanceof ApiError ? err.message : t("common.pleaseTryAgain"));
          } finally {
            setMenuBusy(false);
          }
        },
      },
    ]);
  }

  function handleDeleteChat() {
    setMenuVisible(false);
    Alert.alert(t("chat.deleteConfirmTitle"), t("chat.deleteConfirmBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("chat.deleteConfirm"),
        style: "destructive",
        onPress: async () => {
          setMenuBusy(true);
          try {
            await deleteConversation(conversationId);
            navigation.goBack();
          } catch (err) {
            Alert.alert(t("chat.deleteError"), err instanceof ApiError ? err.message : t("common.pleaseTryAgain"));
          } finally {
            setMenuBusy(false);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.pink} />
      </View>
    );
  }

  return (
    // BUG FIX (Sep 2026): Alena sent a screen recording showing the input
    // bar completely disappear behind the keyboard on Android (message
    // "не видно что ты пишешь и сообщения вообще не отправляется" - not
    // that text was invisible, the whole input+send row was hidden under
    // the keyboard, so nothing could be typed or tapped). behavior=
    // undefined means KeyboardAvoidingView does nothing on Android, relying
    // entirely on the native windowSoftInputMode - which isn't reliably
    // resizing this screen. "height" is the standard fix for this exact
    // symptom on Android.
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={styles.toolbar}>
        <Pressable style={styles.iconButton} onPress={() => void handleStartCall("VOICE")}>
          <Feather name="phone" size={18} color={colors.ink} />
        </Pressable>
        <Pressable style={styles.iconButton} onPress={() => void handleStartCall("VIDEO")}>
          <Feather name="video" size={18} color={colors.ink} />
        </Pressable>
        <Pressable style={styles.iconButton} onPress={() => setMenuVisible(true)}>
          <Feather name="more-vertical" size={18} color={colors.ink} />
        </Pressable>
      </View>
      {callError ? <Text style={styles.errorBanner}>{callError}</Text> : null}
      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
      {/* UPDATE (Sept 2026): the gradient above was itself a stand-in for
          the prototype's real chat background - Alena's actual ask was a
          white, Telegram-style wallpaper with a repeating kid/family
          doodle pattern, not a gradient. See ChatWallpaper.tsx for why
          this is a tiled-emoji grid rather than an SVG asset. */}
      <ChatWallpaper style={styles.chatBg}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const isMine = user?.profileId != null && item.senderProfileId === user.profileId;
            const isImage = !!item.mediaUrl && looksLikeImageUrl(item.mediaUrl);
            const isFile = !!item.mediaUrl && !isImage;
            return (
              <View style={[styles.msgRow, isMine ? styles.msgRowOut : styles.msgRowIn]}>
                {isImage ? (
                  imageLoadErrors.has(item.id) ? (
                    <Pressable
                      style={styles.msgPhotoError}
                      onPress={() => item.mediaUrl && Linking.openURL(item.mediaUrl)}
                    >
                      <Feather name="image" size={22} color={colors.muted} />
                      <Text style={styles.msgPhotoErrorText}>{t("chat.imageLoadFailed")}</Text>
                      <Text style={styles.msgPhotoErrorLink}>{t("chat.openInBrowser")}</Text>
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => item.mediaUrl && Linking.openURL(item.mediaUrl)}>
                      <Image
                        source={{ uri: item.mediaUrl! }}
                        style={styles.msgPhoto}
                        onError={() => setImageLoadErrors((prev) => new Set(prev).add(item.id))}
                      />
                    </Pressable>
                  )
                ) : (
                  <View style={[styles.bubble, isMine ? styles.bubbleOut : styles.bubbleIn]}>
                    {isFile ? (
                      <Pressable style={styles.fileRow} onPress={() => item.mediaUrl && Linking.openURL(item.mediaUrl)}>
                        <Feather name="paperclip" size={15} color={isMine ? colors.white : colors.ink} />
                        <Text style={[isMine ? styles.bubbleTextOut : styles.bubbleTextIn, styles.fileRowText]} numberOfLines={1}>
                          {item.body || t("chat.fileMessage")}
                        </Text>
                      </Pressable>
                    ) : (
                      <Text style={isMine ? styles.bubbleTextOut : styles.bubbleTextIn}>{item.body}</Text>
                    )}
                  </View>
                )}
              </View>
            );
          }}
        />
      </ChatWallpaper>
      {showEmoji ? (
        <View style={styles.emojiStrip}>
          {QUICK_EMOJI.map((emoji) => (
            <Pressable key={emoji} style={styles.emojiStripItem} onPress={() => insertEmoji(emoji)} hitSlop={4}>
              <Text style={styles.emojiStripText}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={[styles.inputBar, { paddingBottom: Math.max(spacing.sm, insets.bottom) }]}>
        <Pressable style={styles.inputIconButton} onPress={() => void handleAttach()} disabled={attaching} hitSlop={6}>
          {attaching ? <ActivityIndicator size="small" color={colors.muted} /> : <Feather name="paperclip" size={19} color={colors.muted} />}
        </Pressable>
        <Pressable style={styles.inputIconButton} onPress={() => setShowEmoji((v) => !v)} hitSlop={6}>
          <Feather name="smile" size={19} color={showEmoji ? colors.pink : colors.muted} />
        </Pressable>
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

      {/* Report/Block/Delete - real actions against the peer profile id
          fetched on mount, same pattern as AuthMethodSheet's bottom sheet
          elsewhere in the app. */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
          <View style={[styles.menuSheet, { paddingBottom: spacing.lg + insets.bottom }]}>
            <View style={styles.menuHandle} />
            <Pressable style={styles.menuRow} onPress={handleReport} disabled={!peerProfileId || menuBusy}>
              <Feather name="flag" size={18} color={colors.ink} />
              <Text style={styles.menuRowText}>{t("chat.menuReport")}</Text>
            </Pressable>
            <Pressable style={styles.menuRow} onPress={handleBlock} disabled={!peerProfileId || menuBusy}>
              <Feather name="slash" size={18} color={colors.ink} />
              <Text style={styles.menuRowText}>{t("chat.menuBlock")}</Text>
            </Pressable>
            <Pressable style={styles.menuRow} onPress={handleDeleteChat} disabled={menuBusy}>
              <Feather name="trash-2" size={18} color={colors.danger} />
              <Text style={[styles.menuRowText, { color: colors.danger }]}>{t("chat.menuDelete")}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
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
  chatBg: { flex: 1 },
  list: { padding: spacing.md, gap: 4 },
  msgPhoto: { width: 200, height: 200, borderRadius: 16, marginBottom: 4 },
  msgPhotoError: {
    width: 200,
    height: 120,
    borderRadius: 16,
    marginBottom: 4,
    backgroundColor: colors.bgSoft,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.line,
  },
  msgPhotoErrorText: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  msgPhotoErrorLink: { fontSize: 12, color: colors.blueDark, fontWeight: "700" },
  fileRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  fileRowText: { flexShrink: 1 },
  msgRow: { flexDirection: "row", marginBottom: 10 },
  msgRowIn: { justifyContent: "flex-start" },
  msgRowOut: { justifyContent: "flex-end" },
  bubble: { maxWidth: "76%", paddingHorizontal: 13, paddingVertical: 10, borderRadius: 16 },
  bubbleIn: {
    // colors.card (pure white) used to sit on a colored gradient
    // background where it read fine - against the new white ChatWallpaper
    // it would be an invisible white-on-white bubble with only a faint
    // shadow to mark its edges. bgSoft gives it real contrast again.
    backgroundColor: colors.bgSoft,
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
  inputIconButton: { width: 28, height: 38, alignItems: "center", justifyContent: "center" },
  emojiStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  emojiStripItem: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  emojiStripText: { fontSize: 21 },
  menuOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(2,8,23,0.45)" },
  menuSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  menuHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: "center", marginBottom: spacing.md },
  menuRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: 52 },
  menuRowText: { fontSize: 15, fontWeight: "600", color: colors.ink },
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
