import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { deleteConversation, fetchConversationPeerProfile, fetchMessages, sendAttachment, sendMessage, sendSticker } from "../api/messages";
import { fetchMessageStarters } from "../api/messageStarters";
import { blockProfile } from "../api/blocks";
import { ApiError } from "../api/client";
import type { ConversationMessage } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { useCall } from "../context/CallContext";
import { useI18n } from "../i18n/I18nContext";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, radius, spacing } from "../theme";
import ChatWallpaper, { CHAT_WALLPAPER_VARIANTS, wallpaperThemeIcon, type ChatWallpaperVariant } from "../components/ChatWallpaper";
import { EMOJI_CATEGORIES } from "../data/emojiData";
import { STICKERS } from "../data/stickerData";
import { stickerEmojiFromBody } from "../utils/stickers";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Chat">;

// Prototype's #scr-chat .emoji-strip quick-react row (see the reference
// screenshot Alena sent) - the exact same 16 emoji, in the same order.
// Item 11 - chat wallpaper picker. Global (not per-conversation - Alena
// didn't ask for per-chat, and a single app-wide preference is simplest);
// persisted locally since there's no backend field for it yet.
const CHAT_WALLPAPER_STORAGE_KEY = "chatWallpaperVariant";

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
  const { t, locale } = useI18n();
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
  // Default is "rainbow", not "pattern" - Alena confirmed the rainbow
  // image is her actual chosen wallpaper (the grey icon-grid pattern was
  // her first pick, made before she had real artwork ready; this default
  // only matters for someone who hasn't opened the picker yet, since a
  // saved AsyncStorage choice below always wins over this).
  const [wallpaperVariant, setWallpaperVariant] = useState<ChatWallpaperVariant>("rainbow");
  const [wallpaperPickerVisible, setWallpaperPickerVisible] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(CHAT_WALLPAPER_STORAGE_KEY)
      .then((value) => {
        if (alive && value && (CHAT_WALLPAPER_VARIANTS as string[]).includes(value)) {
          setWallpaperVariant(value as ChatWallpaperVariant);
        }
      })
      .catch(() => {
        // Falls back to the default "pattern" wallpaper - not worth
        // surfacing an error for a purely cosmetic preference.
      });
    return () => {
      alive = false;
    };
  }, []);

  function chooseWallpaper(next: ChatWallpaperVariant) {
    setWallpaperVariant(next);
    setWallpaperPickerVisible(false);
    AsyncStorage.setItem(CHAT_WALLPAPER_STORAGE_KEY, next).catch(() => {});
  }
  const [showEmoji, setShowEmoji] = useState(false);
  const [emojiCategoryIndex, setEmojiCategoryIndex] = useState(0);
  // Item 13(b) - stickers live as one more tab inside the same picker
  // panel as the emoji grid (reusing its category-tab UI) rather than a
  // separate button - true when that tab is the one showing.
  const [stickersTabActive, setStickersTabActive] = useState(false);
  const [sendingSticker, setSendingSticker] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [menuBusy, setMenuBusy] = useState(false);
  // Chat image attachments were reported as rendering blank with no
  // visible error (Alena's "файл так и не прикрепился и в чате его нет") -
  // the bare <Image> had no onError handler, so a failed load (bad URL,
  // network hiccup, moderation-rejected upload) just showed nothing.
  // Tracks which message ids failed to load so a real fallback (icon +
  // message + open-in-browser) renders instead of empty space.
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<number>>(new Set());
  // UPDATE (Sept 23): Alena - "послала фото и опять сразу его нет" - then
  // confirmed it wasn't actually lost server-side: force-closing and
  // reopening the app made the exact same photo appear immediately, i.e.
  // a plain re-fetch + fresh <Image> succeeded right away. The old
  // onError handler above (still kept for a truly dead URL) marked a
  // message permanently failed on the very FIRST load attempt with no
  // retry at all - so any one-off hiccup right after upload (this is a
  // freshly-written file the very same request just finished writing;
  // see member_send_attachment in main.py) reads as "the photo is gone"
  // forever, for that screen mount, instead of "try again". Gives each
  // image up to 3 attempts, with a short backoff and a cache-busting
  // query param (RN's <Image> won't naturally retry the same failed URI),
  // before falling back to the permanent error placeholder.
  const [imageRetryCounts, setImageRetryCounts] = useState<Record<number, number>>({});
  const imageRetryCountsRef = useRef(imageRetryCounts);
  imageRetryCountsRef.current = imageRetryCounts;
  const IMAGE_MAX_RETRIES = 3;
  const IMAGE_RETRY_DELAY_MS = 900;
  const handleImageLoadError = useCallback((messageId: number) => {
    const attempts = (imageRetryCountsRef.current[messageId] || 0) + 1;
    if (attempts >= IMAGE_MAX_RETRIES) {
      setImageLoadErrors((errs) => new Set(errs).add(messageId));
      return;
    }
    setTimeout(() => {
      setImageRetryCounts((cur) => ({ ...cur, [messageId]: attempts }));
    }, IMAGE_RETRY_DELAY_MS * attempts);
  }, []);
  // Premium roadmap: AI-drafted message starters. Stateless per-open - no
  // history kept, unlike the AI Advisor's own persisted chat, since these
  // are disposable drafts the member reviews/edits before sending.
  const [startersVisible, setStartersVisible] = useState(false);
  const [startersLoading, setStartersLoading] = useState(false);
  const [starters, setStarters] = useState<string[]>([]);
  const [startersError, setStartersError] = useState<string | null>(null);

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

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          <Pressable style={styles.headerIconButton} onPress={() => void handleStartCall("VOICE")}>
            <Feather name="phone" size={18} color={colors.ink} />
          </Pressable>
          <Pressable style={styles.headerIconButton} onPress={() => void handleStartCall("VIDEO")}>
            <Feather name="video" size={18} color={colors.ink} />
          </Pressable>
          <Pressable style={styles.headerIconButton} onPress={() => setMenuVisible(true)}>
            <Feather name="more-vertical" size={18} color={colors.ink} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, conversationId]);

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
  //
  // UPDATE (Sept 2026): Alena - "фото долго не грузит" (photo takes a long
  // time to upload), then clarified she hadn't installed a new build - so
  // this genuinely is just a slow upload, not a stale-build illusion like
  // the keyboard/composer report earlier. There's no expo-image-manipulator
  // in this project (adding it means a new native module, i.e. another
  // `eas build`, which she's not doing right now) so the only zero-build
  // lever here is JPEG quality - dropped from 0.8 to 0.5, still fine for a
  // chat bubble/thumbnail, meaningfully smaller upload. The real fix (an
  // actual attachingLabel visible while the request is inflight, not just
  // a small spinner on the paperclip icon that's easy to miss) is the
  // `attachingLabel` state below.
  async function handleAttach() {
    if (attaching) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("chat.attachPermissionTitle"), t("chat.attachPermissionBody"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
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

  // Premium roadmap - AI-drafted message starters. Reuses the same Claude
  // API plumbing as the AI Family Advisor (see message_starters_system_prompt
  // in main.py) with only already-public profile context, explicitly told
  // never to invent facts. A 402 here means the caller isn't Premium -
  // shown as a friendly upgrade prompt, same pattern as Rewind/Incognito/
  // stickers elsewhere in the app, rather than a raw error.
  async function handleSuggestStarters() {
    if (startersLoading) return;
    setStartersError(null);
    setStarters([]);
    setStartersLoading(true);
    setStartersVisible(true);
    try {
      const res = await fetchMessageStarters(conversationId, locale);
      setStarters(res.starters);
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        setStartersVisible(false);
        Alert.alert(t("chat.messageStartersPremiumTitle"), t("chat.messageStartersPremiumBody"), [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("chat.messageStartersSeePremium"), onPress: () => navigation.navigate("Subscription") },
        ]);
      } else {
        setStartersError(err instanceof ApiError ? err.message : t("common.pleaseTryAgain"));
      }
    } finally {
      setStartersLoading(false);
    }
  }

  function pickStarter(text: string) {
    setDraft(text);
    setStartersVisible(false);
  }

  // Item 13(b) - unlike insertEmoji above, tapping a sticker sends it
  // immediately (one-tap-to-send, matching how stickers work in every
  // other chat app) rather than inserting into the draft. Not Premium
  // gated client-side beyond the small lock hint in the tab/grid - the
  // real gate is server-side (member_send_sticker -> 402), surfaced here
  // as a friendly upsell alert rather than a raw error.
  async function handleSendSticker(stickerId: string) {
    if (sendingSticker) return;
    setSendingSticker(true);
    try {
      const res = await sendSticker(conversationId, stickerId);
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
      setShowEmoji(false);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        Alert.alert(t("chat.stickersPremiumTitle"), t("chat.stickersPremiumBody"));
      } else {
        Alert.alert(t("chat.stickerSendError"), err instanceof ApiError ? err.message : t("common.pleaseTryAgain"));
      }
    } finally {
      setSendingSticker(false);
    }
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
      {callError ? <Text style={styles.errorBanner}>{callError}</Text> : null}
      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
      {/* UPDATE (Sept 2026): the gradient above was itself a stand-in for
          the prototype's real chat background - Alena's actual ask was a
          white, Telegram-style wallpaper with a repeating kid/family
          doodle pattern, not a gradient. See ChatWallpaper.tsx for why
          this is a tiled-emoji grid rather than an SVG asset. */}
      <ChatWallpaper style={styles.chatBg} variant={wallpaperVariant}>
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
            // Item 13(b) - a sticker message has no mediaUrl (it's plain
            // text with a recognized prefix, see utils/stickers.ts), so
            // this check has to come before the image/file branches below
            // but renders the emoji bare (no bubble background), matching
            // how stickers look in every other chat app.
            const stickerEmoji = stickerEmojiFromBody(item.body);
            return (
              <View style={[styles.msgRow, isMine ? styles.msgRowOut : styles.msgRowIn]}>
                {stickerEmoji ? (
                  <Text style={styles.stickerMessageEmoji}>{stickerEmoji}</Text>
                ) : isImage ? (
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
                        // Cache-busting query param keyed on the retry
                        // count: RN's <Image> won't naturally re-attempt
                        // a URI that already failed, so the retry has to
                        // actually be a different request.
                        source={{
                          uri: imageRetryCounts[item.id]
                            ? `${item.mediaUrl!}${item.mediaUrl!.includes("?") ? "&" : "?"}retry=${imageRetryCounts[item.id]}`
                            : item.mediaUrl!,
                        }}
                        style={styles.msgPhoto}
                        onError={() => handleImageLoadError(item.id)}
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
        <View style={styles.emojiPicker}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiCategoryTabs}>
            {EMOJI_CATEGORIES.map((category, index) => (
              <Pressable
                key={category.key}
                style={[styles.emojiCategoryTab, !stickersTabActive && index === emojiCategoryIndex && styles.emojiCategoryTabActive]}
                onPress={() => {
                  setStickersTabActive(false);
                  setEmojiCategoryIndex(index);
                }}
                accessibilityLabel={t(category.labelKey)}
              >
                <Text style={styles.emojiCategoryTabEmoji}>{category.emojis[0]}</Text>
              </Pressable>
            ))}
            {/* Item 13(b) - one more tab for stickers, reusing this same
                category-tab row rather than a separate button. The small
                lock badge is just a hint (Free members can still open this
                tab and see what they'd get) - the real gate is server-side,
                see handleSendSticker's 402 handling. */}
            <Pressable
              style={[styles.emojiCategoryTab, stickersTabActive && styles.emojiCategoryTabActive]}
              onPress={() => setStickersTabActive(true)}
              accessibilityLabel={t("chat.stickersTabLabel")}
            >
              <Text style={styles.emojiCategoryTabEmoji}>{STICKERS[0].emoji}</Text>
              {!user?.isPremium ? (
                <View style={styles.stickerTabLockBadge}>
                  <Feather name="lock" size={8} color={colors.white} />
                </View>
              ) : null}
            </Pressable>
          </ScrollView>
          {stickersTabActive ? (
            <>
              {!user?.isPremium ? (
                <View style={styles.stickersPremiumBanner}>
                  <Feather name="lock" size={12} color={colors.pink} />
                  <Text style={styles.stickersPremiumBannerText}>{t("chat.stickersPremiumHint")}</Text>
                </View>
              ) : null}
              <ScrollView style={styles.emojiGridScroll} contentContainerStyle={styles.emojiGrid}>
                {STICKERS.map((sticker) => (
                  <Pressable
                    key={sticker.id}
                    style={styles.stickerGridItem}
                    onPress={() => void handleSendSticker(sticker.id)}
                    disabled={sendingSticker}
                    hitSlop={4}
                  >
                    <Text style={styles.stickerGridEmoji}>{sticker.emoji}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : (
            <ScrollView style={styles.emojiGridScroll} contentContainerStyle={styles.emojiGrid}>
              {EMOJI_CATEGORIES[emojiCategoryIndex].emojis.map((emoji, i) => (
                <Pressable key={`${emoji}-${i}`} style={styles.emojiStripItem} onPress={() => insertEmoji(emoji)} hitSlop={4}>
                  <Text style={styles.emojiStripText}>{emoji}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      ) : null}
      {/* UPDATE (Sept 2026): the paperclip's own tiny spinner was easy to
          miss during a slow upload, which is exactly what made "фото
          долго не грузит" read as broken rather than just slow - this
          banner is the same information, just impossible to miss. */}
      {attaching ? (
        <View style={styles.attachingBanner}>
          <ActivityIndicator size="small" color={colors.pink} />
          <Text style={styles.attachingBannerText}>{t("chat.attachSending")}</Text>
        </View>
      ) : null}
      <View style={[styles.inputBar, { paddingBottom: Math.max(spacing.sm, insets.bottom) }]}>
        <Pressable style={styles.inputIconButton} onPress={() => void handleAttach()} disabled={attaching} hitSlop={6}>
          {attaching ? <ActivityIndicator size="small" color={colors.muted} /> : <Feather name="paperclip" size={19} color={colors.muted} />}
        </Pressable>
        <Pressable style={styles.inputIconButton} onPress={() => setShowEmoji((v) => !v)} hitSlop={6}>
          <Feather name="smile" size={19} color={showEmoji ? colors.pink : colors.muted} />
        </Pressable>
        <Pressable
          style={styles.inputIconButton}
          onPress={() => void handleSuggestStarters()}
          hitSlop={6}
          accessibilityLabel={t("chat.messageStartersButtonLabel")}
        >
          <Feather name="zap" size={19} color={colors.muted} />
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
            <Pressable
              style={styles.menuRow}
              onPress={() => {
                setMenuVisible(false);
                setWallpaperPickerVisible(true);
              }}
            >
              <Feather name="image" size={18} color={colors.ink} />
              <Text style={styles.menuRowText}>{t("chat.menuWallpaper")}</Text>
            </Pressable>
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

      {/* Item 11/12 - wallpaper picker. "rainbow" is the one real bundled
          image (Alena's matching cloud+star asset is still pending); every
          other option, including the original "pattern" default, is one
          of ChatWallpaper's icon-grid themes - see wallpaperThemeIcon()
          there for the icon+color each one renders with. Wrapped in a
          ScrollView with a maxHeight since 12 options in a wrapping grid
          can run taller than a short device's screen. */}
      <Modal visible={wallpaperPickerVisible} transparent animationType="fade" onRequestClose={() => setWallpaperPickerVisible(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setWallpaperPickerVisible(false)}>
          <View style={[styles.menuSheet, { paddingBottom: spacing.lg + insets.bottom }]}>
            <View style={styles.menuHandle} />
            <Text style={styles.wallpaperPickerTitle}>{t("chat.wallpaperPickerTitle")}</Text>
            <ScrollView style={styles.wallpaperOptionsScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.wallpaperOptionsRow}>
                {CHAT_WALLPAPER_VARIANTS.map((v) => {
                  const themeIcon = wallpaperThemeIcon(v);
                  return (
                    <Pressable key={v} style={styles.wallpaperOption} onPress={() => chooseWallpaper(v)}>
                      {v === "rainbow" ? (
                        <Image source={require("../../assets/chat-backgrounds/rainbow.png")} style={styles.wallpaperThumb} />
                      ) : (
                        <View style={[styles.wallpaperThumb, styles.wallpaperThumbPattern]}>
                          <MaterialCommunityIcons name={themeIcon!.icon} size={26} color={themeIcon!.color} />
                        </View>
                      )}
                      <Text style={styles.wallpaperOptionLabel} numberOfLines={1}>
                        {t(`chat.wallpaper${v.charAt(0).toUpperCase()}${v.slice(1)}` as any)}
                      </Text>
                      {wallpaperVariant === v ? <Feather name="check-circle" size={16} color={colors.pink} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Premium roadmap - AI-drafted message starters. Tapping a draft
          fills the composer (never auto-sends - the member always reviews
          and sends it themselves, same honesty-first pattern as Share Plan
          on the Safety Check-In screen). */}
      <Modal visible={startersVisible} transparent animationType="fade" onRequestClose={() => setStartersVisible(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setStartersVisible(false)}>
          <View style={[styles.menuSheet, { paddingBottom: spacing.lg + insets.bottom }]}>
            <View style={styles.menuHandle} />
            <Text style={styles.wallpaperPickerTitle}>{t("chat.messageStartersTitle")}</Text>
            {startersLoading ? (
              <ActivityIndicator size="small" color={colors.pink} style={styles.startersLoading} />
            ) : startersError ? (
              <Text style={styles.errorBanner}>{startersError}</Text>
            ) : (
              <View style={styles.startersList}>
                {starters.map((item, index) => (
                  <Pressable key={index} style={styles.starterOption} onPress={() => pickStarter(item)}>
                    <Text style={styles.starterOptionText}>{item}</Text>
                  </Pressable>
                ))}
              </View>
            )}
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconButton: {
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
  emojiPicker: {
    height: 260,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  emojiCategoryTabs: {
    flexDirection: "row",
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingHorizontal: spacing.sm,
  },
  emojiCategoryTab: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    position: "relative",
  },
  emojiCategoryTabActive: { borderBottomColor: colors.pink },
  emojiCategoryTabEmoji: { fontSize: 18 },
  emojiGridScroll: { flex: 1 },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  emojiStripItem: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  emojiStripText: { fontSize: 21 },
  // Item 13(b) - stickers tab/grid, sharing the emoji picker panel above.
  stickerTabLockBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.pink,
    alignItems: "center",
    justifyContent: "center",
  },
  stickersPremiumBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: colors.tintPink,
  },
  stickersPremiumBannerText: { fontSize: 11.5, color: colors.pink, fontWeight: "600", flexShrink: 1 },
  stickerGridItem: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.bgSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  stickerGridEmoji: { fontSize: 30 },
  // A sent/received sticker renders bare (no bubble background), much
  // bigger than an inline emoji character - the visual difference is what
  // makes it read as "a sticker" rather than "a message that's just an
  // emoji".
  stickerMessageEmoji: { fontSize: 64, marginVertical: 2 },
  attachingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.tintPink,
  },
  attachingBannerText: { fontSize: 12.5, color: colors.ink, flex: 1 },
  menuOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(2,8,23,0.45)" },
  menuSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  menuHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: "center", marginBottom: spacing.md },
  menuRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 52 },
  menuRowText: { fontSize: 15, fontWeight: "600", color: colors.ink, flex: 1 },
  wallpaperPickerTitle: { fontSize: 16, fontWeight: "800", color: colors.ink, marginBottom: spacing.md },
  // Item 12: 12 options now (was 2), so this wraps into a grid instead of
  // a single row. maxHeight on the ScrollView keeps the sheet from running
  // off a short screen; the grid itself just wraps normally.
  wallpaperOptionsScroll: { maxHeight: 340 },
  wallpaperOptionsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  wallpaperOption: { alignItems: "center", gap: 6, width: 72 },
  wallpaperThumb: { width: 64, height: 64, borderRadius: 14, backgroundColor: colors.bgSoft },
  wallpaperThumbPattern: { alignItems: "center", justifyContent: "center" },
  wallpaperOptionLabel: { fontSize: 11.5, fontWeight: "600", color: colors.ink, textAlign: "center" },
  startersLoading: { marginVertical: spacing.lg },
  startersList: { gap: spacing.sm, marginBottom: spacing.md },
  starterOption: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: colors.bgSoft,
  },
  starterOptionText: { fontSize: 14, color: colors.ink, lineHeight: 19 },
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
