import React, { useRef, useState } from "react";
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
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { askAi } from "../api/askAi";
import { ApiError } from "../api/client";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import GradientBackground from "../components/GradientBackground";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "AskAi">;

type LocalMessage = { role: "user" | "assistant"; text: string; at: string };

// Native version of the website's free "Ask AI" tool (backlog item 25,
// backend: POST /api/public/ask-ai) - was previously a card on
// WhatsNewScreen/a row on SettingsScreen that opened that same website
// page inside expo-web-browser. Alena, after seeing it open the website
// instead of a real screen: "И почему переход на сайт из приложения?? Все
// это должно быть в самом приложении" - confirmed she wants it native
// ("Конечно хочу").
//
// Deliberately NOT a copy of AiAdvisorScreen's premium-gated, persisted
// chat: this tool is free, unauthenticated, and stateless server-side (see
// api/askAi.ts) - every question stands alone, nothing is saved on the
// backend, so this screen keeps its own local, in-memory message list that
// resets whenever the screen is left. Layout otherwise deliberately
// mirrors AiAdvisorScreen's hard-won keyboard-avoidance structure
// (KeyboardAvoidingView as the true screen root, GradientBackground as its
// child, the input bar as a plain sibling still inside
// KeyboardAvoidingView but outside GradientBackground) - see the FIX
// HISTORY comments in AiAdvisorScreen.tsx for exactly why each of those
// choices matters; getting this from scratch without them reintroduces
// the same two Android/iOS composer bugs that took two rounds to fix there.
export default function AskAiScreen({}: Props) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList<LocalMessage>>(null);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    setSending(true);
    setError(null);
    // Optimistic, same pattern as AiAdvisorScreen - show the question
    // immediately, drop it again (and restore the draft) if the call fails
    // so nothing typed is lost.
    const optimistic: LocalMessage = { role: "user", text, at: new Date().toISOString() };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const res = await askAi(text);
      setMessages((prev) => [...prev, { role: "assistant", text: res.answer, at: new Date().toISOString() }]);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m !== optimistic));
      setDraft(text);
      if (err instanceof ApiError && err.status === 429) {
        // Server's own detail text is accurate but always English
        // (no locale support on that error path server-side) - a
        // localized client-side message here instead, same reasoning as
        // AiAdvisorScreen short-circuiting the 402/matched-like case
        // locally rather than surfacing the raw server string.
        setError(t("askAi.dailyLimitReached"));
      } else if (err instanceof ApiError && err.status === 503) {
        setError(t("askAi.notConfigured"));
      } else {
        setError(err instanceof ApiError ? err.message : t("askAi.sendError"));
      }
    } finally {
      setSending(false);
    }
  }

  function handleReset() {
    // Local only - there is nothing server-side to clear (see api/askAi.ts).
    setMessages([]);
    setError(null);
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 44 : 0}
    >
      <GradientBackground variant="soft" style={styles.flex}>
        {error ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{error}</Text>
          </View>
        ) : null}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item, index) => `${item.role}-${item.at}-${index}`}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.center}>
              <Feather name="message-square" size={36} color={colors.muted} />
              <Text style={styles.emptyText}>{t("whatsnew.askAiBody")}</Text>
              <Text style={styles.disclaimer}>{t("askAi.disclaimer")}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMine = item.role === "user";
            return (
              <View style={[styles.bubbleRow, isMine ? styles.bubbleRowOut : styles.bubbleRowIn]}>
                <View style={[styles.bubble, isMine ? styles.bubbleOut : styles.bubbleIn]}>
                  <Text style={isMine ? styles.bubbleTextOut : styles.bubbleTextIn}>{item.text}</Text>
                </View>
              </View>
            );
          }}
        />
        {sending ? (
          <View style={styles.typingRow}>
            <ActivityIndicator size="small" color={colors.muted} />
            <Text style={styles.typingText}>{t("aiAdvisor.typing")}</Text>
          </View>
        ) : null}
      </GradientBackground>
      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <Pressable onPress={handleReset} hitSlop={8} style={styles.clearButton} disabled={!messages.length}>
          <Feather name="refresh-ccw" size={18} color={messages.length ? colors.muted : colors.border} />
        </Pressable>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={t("askAi.placeholder")}
          placeholderTextColor={colors.muted}
          multiline
          maxLength={1500}
        />
        <Pressable onPress={() => void send()} disabled={!draft.trim() || sending} hitSlop={8} style={styles.sendButton}>
          <Feather name="send" size={20} color={draft.trim() ? colors.pink : colors.muted} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.sm },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20, maxWidth: 300 },
  disclaimer: { fontSize: 11.5, color: colors.muted, textAlign: "center", lineHeight: 16, maxWidth: 280, marginTop: spacing.xs },
  notice: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  noticeText: { fontSize: 12.5, color: colors.danger, textAlign: "center" },
  list: { padding: spacing.md, flexGrow: 1 },
  bubbleRow: { flexDirection: "row", marginBottom: spacing.sm },
  bubbleRowOut: { justifyContent: "flex-end" },
  bubbleRowIn: { justifyContent: "flex-start" },
  bubble: { maxWidth: "80%", paddingHorizontal: 13, paddingVertical: 10, borderRadius: 16 },
  bubbleIn: { backgroundColor: colors.white, borderBottomLeftRadius: 4 },
  bubbleOut: { backgroundColor: colors.pink, borderBottomRightRadius: 4 },
  bubbleTextIn: { color: colors.ink, fontSize: 15, lineHeight: 20 },
  bubbleTextOut: { color: colors.white, fontSize: 15, lineHeight: 20 },
  typingRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
  typingText: { fontSize: 12.5, color: colors.muted },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.bgSoft,
  },
  clearButton: { paddingBottom: 8 },
  sendButton: { paddingBottom: 8 },
  input: {
    flex: 1,
    maxHeight: 100,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    color: colors.ink,
    fontSize: 15,
  },
});
