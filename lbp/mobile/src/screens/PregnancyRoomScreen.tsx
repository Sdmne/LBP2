import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ApiError } from "../api/client";
import {
  deletePregnancyEntry,
  fetchPregnancyRoom,
  uploadPregnancyEntry,
  type PregnancyEntry,
  type PregnancyEntryCategory,
} from "../api/pregnancyRoom";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GradientBackground from "../components/GradientBackground";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "PregnancyRoom">;

// Pregnancy Room - a separate room next to the general Family Room
// documents (src/screens/FamilyRoomScreen.tsx), for exactly the 3 things
// Alena asked for: "создать еще комнату по беременности где хранить все
// анализы, узи и назначения... делиться с партнёром из family room". Same
// gating as the rest of Family Room (Premium + an ACTIVE mutual match),
// same private multipart-upload pattern as the Documents card there.
const CATEGORIES: { key: PregnancyEntryCategory; labelKey: string; icon: string }[] = [
  { key: "lab_test", labelKey: "pregnancyRoom.category.labTest", icon: "🧪" },
  { key: "ultrasound", labelKey: "pregnancyRoom.category.ultrasound", icon: "🩻" },
  { key: "prescription", labelKey: "pregnancyRoom.category.prescription", icon: "💊" },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function PregnancyRoomScreen({ route, navigation }: Props) {
  const { profileId, displayName } = route.params;
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  const [entries, setEntries] = useState<PregnancyEntry[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "noMatch" | "error">("loading");
  const [activeCategory, setActiveCategory] = useState<PregnancyEntryCategory>("lab_test");
  const [uploading, setUploading] = useState(false);
  // A picked-but-not-yet-saved file, waiting on its date/note before the
  // actual upload fires - see handlePickFile/handleConfirmUpload below.
  const [pendingFile, setPendingFile] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [dateDraft, setDateDraft] = useState(todayIso());
  const [noteDraft, setNoteDraft] = useState("");

  const load = useCallback(() => {
    setStatus("loading");
    fetchPregnancyRoom(profileId)
      .then((res) => {
        setEntries(res.entries);
        setStatus("ok");
      })
      .catch((err) => {
        // No 402 branch here on purpose - Pregnancy Room isn't behind
        // require_family_premium server-side (Alena: "убрать ограничение
        // навсегда"), unlike the rest of Family Room, so this endpoint
        // never returns one.
        if (err instanceof ApiError && err.status === 404) setStatus("noMatch");
        else setStatus("error");
      });
  }, [profileId]);

  useEffect(() => {
    navigation.setOptions({ title: displayName ? `${t("nav.pregnancyRoomTitle")} · ${displayName}` : t("nav.pregnancyRoomTitle") });
  }, [navigation, displayName, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePickFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPendingFile({
      uri: asset.uri,
      name: asset.name || `entry-${Date.now()}`,
      type: asset.mimeType || "application/octet-stream",
    });
    setDateDraft(todayIso());
    setNoteDraft("");
  }

  async function handleConfirmUpload() {
    if (!pendingFile) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateDraft.trim())) {
      Alert.alert(t("pregnancyRoom.dateInvalid"));
      return;
    }
    setUploading(true);
    try {
      const res = await uploadPregnancyEntry(profileId, pendingFile, {
        category: activeCategory,
        note: noteDraft.trim(),
        entryDate: dateDraft.trim(),
      });
      setEntries((prev) => (prev ? [res.entry, ...prev] : [res.entry]));
      setPendingFile(null);
      setNoteDraft("");
    } catch (err) {
      Alert.alert(t("pregnancyRoom.uploadError"), err instanceof ApiError ? err.message : t("common.pleaseTryAgain"));
    } finally {
      setUploading(false);
    }
  }

  function handleDeleteEntry(entry: PregnancyEntry) {
    Alert.alert(t("pregnancyRoom.deleteTitle"), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("pregnancyRoom.deleteConfirm"),
        style: "destructive",
        onPress: async () => {
          setEntries((prev) => (prev ? prev.filter((e) => e.id !== entry.id) : prev));
          try {
            await deletePregnancyEntry(entry.id);
          } catch (err) {
            Alert.alert(t("pregnancyRoom.deleteError"), err instanceof ApiError ? err.message : t("common.pleaseTryAgain"));
            load();
          }
        },
      },
    ]);
  }

  if (status === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.pink} />
      </View>
    );
  }

  if (status === "noMatch") {
    return (
      <View style={styles.center}>
        <Text style={styles.stateTitle}>{t("familyRoom.noMatchTitle")}</Text>
        <Text style={styles.stateBody}>{t("pregnancyRoom.noMatchBody")}</Text>
      </View>
    );
  }

  if (status === "error" || !entries) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t("pregnancyRoom.loadError")}</Text>
      </View>
    );
  }

  const visibleEntries = entries.filter((e) => e.category === activeCategory);

  return (
    <GradientBackground variant="soft">
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: spacing.xl + insets.bottom }]}>
        <View style={styles.tabsRow}>
          {CATEGORIES.map((cat) => {
            const active = cat.key === activeCategory;
            return (
              <Pressable
                key={cat.key}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => {
                  setActiveCategory(cat.key);
                  setPendingFile(null);
                }}
              >
                <Text style={styles.tabIcon}>{cat.icon}</Text>
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t(cat.labelKey)}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.card}>
          {visibleEntries.length === 0 ? (
            <Text style={styles.emptyText}>{t("pregnancyRoom.empty")}</Text>
          ) : (
            visibleEntries.map((entry) => (
              <Pressable
                key={entry.id}
                style={styles.entryRow}
                onPress={() => Linking.openURL(entry.contentUrl).catch(() => Alert.alert(t("pregnancyRoom.openError")))}
                onLongPress={() => handleDeleteEntry(entry)}
              >
                <Text style={styles.entryIcon}>{entry.mimeType === "application/pdf" ? "📄" : "🖼️"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryName} numberOfLines={1}>
                    {entry.displayName}
                  </Text>
                  <Text style={styles.entryMeta}>{formatEntryDate(entry.entryDate)}</Text>
                  {entry.note ? (
                    <Text style={styles.entryNote} numberOfLines={2}>
                      {entry.note}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))
          )}

          {pendingFile ? (
            <View style={styles.pendingCard}>
              <Text style={styles.pendingFileName} numberOfLines={1}>
                {pendingFile.name}
              </Text>
              <Text style={styles.fieldLabel}>{t("pregnancyRoom.dateLabel")}</Text>
              <TextInput
                style={styles.input}
                value={dateDraft}
                onChangeText={setDateDraft}
                placeholder={t("pregnancyRoom.datePlaceholder")}
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                style={[styles.input, styles.noteInput]}
                value={noteDraft}
                onChangeText={setNoteDraft}
                placeholder={t("pregnancyRoom.notePlaceholder")}
                placeholderTextColor={colors.muted}
                multiline
              />
              <View style={styles.pendingActions}>
                <Pressable
                  style={styles.pendingCancelButton}
                  onPress={() => setPendingFile(null)}
                  disabled={uploading}
                >
                  <Text style={styles.pendingCancelButtonText}>{t("common.cancel")}</Text>
                </Pressable>
                <Pressable style={styles.pendingSaveButton} onPress={() => void handleConfirmUpload()} disabled={uploading}>
                  {uploading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.pendingSaveButtonText}>{t("pregnancyRoom.save")}</Text>}
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable style={styles.addButton} onPress={() => void handlePickFile()}>
              <Text style={styles.addButtonText}>{t("pregnancyRoom.addEntry")}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </GradientBackground>
  );
}

// Kept locale-independent on purpose (DD.MM.YYYY) - a medical-record date
// shown the same way regardless of app language, same reasoning most
// lab/clinic paperwork uses day-month-year rather than a locale-formatted
// string that could read ambiguously (e.g. 03/04 as March 4 vs 4 March).
function formatEntryDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}.${month}.${year}`;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.sm },
  stateTitle: { fontSize: 18, fontWeight: "800", color: colors.ink, textAlign: "center" },
  stateBody: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20 },
  errorText: { color: colors.danger },
  container: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl, backgroundColor: "transparent" },
  tabsRow: { flexDirection: "row", gap: 8 },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tabActive: { backgroundColor: colors.pink, borderColor: colors.pink },
  tabIcon: { fontSize: 14 },
  tabLabel: { fontSize: 12.5, fontWeight: "700", color: colors.ink },
  tabLabelActive: { color: colors.white },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.sm,
  },
  emptyText: { fontSize: 13.5, color: colors.muted, textAlign: "center", paddingVertical: spacing.md },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  entryIcon: { fontSize: 22 },
  entryName: { fontSize: 14.5, fontWeight: "700", color: colors.ink },
  entryMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  entryNote: { fontSize: 12.5, color: colors.muted, marginTop: 3, lineHeight: 17 },
  addButton: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.pink,
    borderRadius: radius.pill,
    paddingVertical: 11,
    alignItems: "center",
  },
  addButtonText: { color: colors.pink, fontWeight: "700" },
  pendingCard: {
    marginTop: spacing.xs,
    backgroundColor: colors.bgSoft,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 6,
  },
  pendingFileName: { fontSize: 13.5, fontWeight: "700", color: colors.ink },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: colors.muted, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13.5,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  noteInput: { minHeight: 60, textAlignVertical: "top" },
  pendingActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  pendingCancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: 10,
    alignItems: "center",
  },
  pendingCancelButtonText: { color: colors.muted, fontWeight: "700" },
  pendingSaveButton: {
    flex: 1,
    backgroundColor: colors.pink,
    borderRadius: radius.pill,
    paddingVertical: 10,
    alignItems: "center",
  },
  pendingSaveButtonText: { color: colors.white, fontWeight: "700" },
});
