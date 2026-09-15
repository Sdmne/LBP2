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
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  clearAiAdvisorMessages,
  fetchAiAdvisorMessages,
  fetchWeeklyInsight,
  sendAiAdvisorMessage,
  type AiAdvisorMessage,
} from "../api/aiAdvisor";
import { ApiError } from "../api/client";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import GradientBackground from "../components/GradientBackground";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "AiAdvisor">;

// AI Family Advisor (backlog item 12 - "ИИ консультант"). Premium-gated
// chat that helps members navigate the process/app - see the system prompt
// on the backend (AI_ADVISOR_SYSTEM_PROMPT in main.py) for the exact rules
// it follows (never medical/legal/financial/psychological advice, never
// recommends a specific match/clinic/lawyer). This screen itself just
// renders whatever the backend gates/returns - a 402 means the caller
// isn't Premium, "configured: false" means the developer hasn't set
// ANTHROPIC_API_KEY on the server yet.
export default function AiAdvisorScreen({}: Props) {
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<AiAdvisorMessage[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [needsPremium, setNeedsPremium] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  // Premium roadmap step 10 - personalized weekly insight. Fetched
  // separately from the chat history and failure is silent (worst
  // case: no card shows) - it is a nice-to-have on top of the chat,
  // never something that should block the screen from working.
  const [weeklyInsight, setWeeklyInsight] = useState<string | null>(null);
  const [weeklyInsightDismissed, setWeeklyInsightDismissed] = useState(false);
  const listRef = useRef<FlatList<AiAdvisorMessage>>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNeedsPremium(false);
    try {
      const res = await fetchAiAdvisorMessages();
      setMessages(res.messages);
      setConfigured(res.configured);
      if (res.configured) {
        fetchWeeklyInsight(locale)
          .then((insightRes) => setWeeklyInsight(insightRes.insight))
          .catch(() => {
            // Silent - either not Premium (rare here, since reaching this
            // point already means the chat itself loaded) or a transient
            // error. The chat still works fully without this card.
          });
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        setNeedsPremium(true);
      } else {
        setError(err instanceof ApiError ? err.message : t("aiAdvisor.loadError"));
      }
    } finally {
      setLoading(false);
    }
  }, [t, locale]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    setSending(true);
    // Optimistic - show the user's own message immediately, replace with
    // the server's copy (which also carries the assistant reply) once it
    // resolves; on failure the optimistic row is dropped and the draft is
    // restored so nothing the person typed is lost.
    const optimistic: AiAdvisorMessage = { role: "user", text, at: new Date().toISOString() };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const res = await sendAiAdvisorMessage(text);
      setMessages(res.messages);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m !== optimistic));
      setDraft(text);
      if (err instanceof ApiError && err.status === 402) {
        setNeedsPremium(true);
      } else {
        setError(err instanceof ApiError ? err.message : t("aiAdvisor.sendError"));
      }
    } finally {
      setSending(false);
    }
  }

  async function handleClear() {
    try {
      await clearAiAdvisorMessages();
      setMessages([]);
    } catch {
      // Silent - worst case the old history just stays visible; retrying
      // is one more tap away.
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.pink} />
      </View>
    );
  }

  if (needsPremium) {
    return (
      <GradientBackground variant="soft">
        <View style={styles.center}>
          <Feather name="message-circle" size={40} color={colors.muted} />
          <Text style={styles.premiumTitle}>{t("aiAdvisor.premiumTitle")}</Text>
          <Text style={styles.premiumBody}>{t("aiAdvisor.premiumBody")}</Text>
        </View>
      </GradientBackground>
    );
  }

  return (
    // BUG FIX (Sep 2026, round 2): Alena kept seeing the composer buried
    // under the keyboard even after the first fix (behavior="height",
    // still below) - a fresh screenshot showed only its rounded top edge
    // peeking above the keyboard, everything else covered. The first fix
    // copied ChatScreen.tsx's KeyboardAvoidingView props correctly, but
    // missed a structural difference: ChatScreen's KeyboardAvoidingView IS
    // the screen's outermost element, while this screen had it nested
    // one level deeper, inside <GradientBackground>'s LinearGradient. That
    // extra native view in between the KeyboardAvoidingView and the actual
    // screen root can throw off Android's own resize/layout pass, since
    // KeyboardAvoidingView measures/adjusts based on its OWN layout, not
    // its parent's. Matching ChatScreen's hierarchy exactly - KeyboardAvoidingView
    // as the true root, GradientBackground moved to be its child instead of
    // its parent - removes that extra layer without losing the background.
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 44 : 0}
    >
      <GradientBackground variant="soft" style={styles.flex}>
        {!configured ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{t("aiAdvisor.notConfigured")}</Text>
          </View>
        ) : null}
        {error ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{error}</Text>
          </View>
        ) : null}
        {weeklyInsight && !weeklyInsightDismissed ? (
          <View style={styles.insightCard}>
            <Feather name="sunrise" size={16} color={colors.pink} />
            <View style={styles.insightTextWrap}>
              <Text style={styles.insightLabel}>{t("aiAdvisor.weeklyInsightLabel")}</Text>
              <Text style={styles.insightText}>{weeklyInsight}</Text>
            </View>
            <Pressable onPress={() => setWeeklyInsightDismissed(true)} hitSlop={8}>
              <Feather name="x" size={16} color={colors.muted} />
            </Pressable>
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
              <Feather name="message-circle" size={36} color={colors.muted} />
              <Text style={styles.emptyText}>{t("aiAdvisor.intro")}</Text>
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
      {/* BUG FIX (Sep 2026, round 3): composer was still vanishing on
          Android specifically while Gboard's own top strip toggled
          between word-suggestion and icon-toolbar height (each toggle
          fires another native keyboard-frame-change event). Root cause
          this time: the composer sat INSIDE <GradientBackground>, i.e.
          inside an expo-linear-gradient native view that was also the
          child KeyboardAvoidingView resizes on every one of those events.
          LinearGradient on Android doesn't reliably repaint its own
          bounds on rapid Animated height changes, so its last-painted
          frame could visually cover the composer even once the actual
          layout had room for it again. inputBar already has its own
          opaque backgroundColor (colors.bgSoft), so moving it OUTSIDE
          GradientBackground - as a plain, non-gradient sibling still
          inside KeyboardAvoidingView - changes nothing visually but
          takes the gradient out of the animated-height hierarchy
          entirely. */}
      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <Pressable onPress={handleClear} hitSlop={8} style={styles.clearButton}>
          <Feather name="refresh-ccw" size={18} color={colors.muted} />
        </Pressable>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={t("aiAdvisor.placeholder")}
          placeholderTextColor={colors.muted}
          multiline
          editable={configured}
        />
        <Pressable onPress={() => void send()} disabled={!draft.trim() || sending || !configured} hitSlop={8}>
          <Feather name="send" size={20} color={draft.trim() && configured ? colors.pink : colors.muted} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.sm },
  premiumTitle: { fontSize: 18, fontWeight: "800", color: colors.ink, textAlign: "center", marginTop: spacing.sm },
  premiumBody: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20 },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20, maxWidth: 280 },
  notice: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  noticeText: { fontSize: 12.5, color: colors.danger, textAlign: "center" },
  insightCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  insightTextWrap: { flex: 1 },
  insightLabel: { fontSize: 11, fontWeight: "700", color: colors.pink, textTransform: "uppercase", letterSpacing: 0.3 },
  insightText: { fontSize: 13.5, color: colors.ink, lineHeight: 19, marginTop: 2 },
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
