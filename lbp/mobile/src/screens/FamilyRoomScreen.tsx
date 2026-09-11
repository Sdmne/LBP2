import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ApiError } from "../api/client";
import {
  createFamilyChecklistItem,
  deleteFamilyChecklistItem,
  deleteFamilyDocument,
  fetchFamilyRoom,
  updateFamilyChecklistItem,
  updateFamilyPlanSection,
  uploadFamilyDocument,
  type FamilyChecklistItem,
  type FamilyDocument,
  type FamilyPlanSection,
  type FamilyRoom,
} from "../api/familyRoom";
import { FAMILY_PLAN_SECTION_KEYS } from "../utils/familyPlan";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GradientBackground from "../components/GradientBackground";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "FamilyRoom">;

// "Family Plan & Shared Family Room" + "Document & checklist tools" from the
// pricing page's Family Builder Pro tier - see backend/main.py's "FAMILY
// ROOM" section and src/api/familyRoom.ts. The backend gates this behind the
// existing single Premium flag (402) and behind having an ACTIVE mutual
// match with this profile (404) - both states are rendered here rather than
// guessed at client-side, since ProfileDetailScreen always shows the entry
// point regardless of match/premium status.
const SECTIONS: FamilyChecklistItem["section"][] = ["parenting", "finances", "legal", "general"];

export default function FamilyRoomScreen({ route, navigation }: Props) {
  const { profileId, displayName } = route.params;
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  const [room, setRoom] = useState<FamilyRoom | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "needsPremium" | "noMatch" | "error">("loading");

  // Structured 10-section Family Plan (replaces the old 3-textarea plan
  // card - see api/familyRoom.ts's FamilyPlanSection). sectionDrafts holds
  // in-progress edits per section key, kept separate from room.sections
  // (the server truth) so typing in a collapsed-then-reopened section
  // doesn't get clobbered by an unrelated toggle's optimistic update.
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [sectionDrafts, setSectionDrafts] = useState<Record<string, string>>({});
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [togglingSection, setTogglingSection] = useState<string | null>(null);

  const [newItemText, setNewItemText] = useState<Record<string, string>>({});
  const [addingSection, setAddingSection] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const load = useCallback(() => {
    setStatus("loading");
    fetchFamilyRoom(profileId)
      .then((res) => {
        setRoom(res);
        setSectionDrafts(Object.fromEntries(res.sections.map((s) => [s.key, s.content])));
        setStatus("ok");
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 402) setStatus("needsPremium");
        else if (err instanceof ApiError && err.status === 404) setStatus("noMatch");
        else setStatus("error");
      });
  }, [profileId]);

  useEffect(() => {
    navigation.setOptions({ title: displayName ? `${t("familyRoom.title")} · ${displayName}` : t("familyRoom.title") });
  }, [navigation, displayName, t]);

  useEffect(() => {
    load();
  }, [load]);

  function applySections(sections: FamilyPlanSection[]) {
    setRoom((prev) => (prev ? { ...prev, sections } : prev));
  }

  async function handleSaveSection(key: string) {
    if (savingSection) return;
    setSavingSection(key);
    try {
      const res = await updateFamilyPlanSection(profileId, key, { content: sectionDrafts[key] ?? "" });
      applySections(res.sections);
      const savedSection = res.sections.find((section) => section.key === key);
      setSectionDrafts((prev) => ({
        ...prev,
        [key]: savedSection?.content ?? prev[key] ?? "",
      }));
    } catch (err) {
      Alert.alert(t("familyRoom.sections.saveError"), err instanceof ApiError ? err.message : t("common.pleaseTryAgain"));
    } finally {
      setSavingSection(null);
    }
  }

  async function handleToggleSectionComplete(section: FamilyPlanSection) {
    if (togglingSection) return;
    setTogglingSection(section.key);
    const nextComplete = !section.myComplete;
    setRoom((prev) =>
      prev
        ? { ...prev, sections: prev.sections.map((s) => (s.key === section.key ? { ...s, myComplete: nextComplete } : s)) }
        : prev,
    );
    try {
      const res = await updateFamilyPlanSection(profileId, section.key, { isComplete: nextComplete });
      applySections(res.sections);
    } catch (err) {
      setRoom((prev) =>
        prev
          ? { ...prev, sections: prev.sections.map((s) => (s.key === section.key ? { ...s, myComplete: section.myComplete } : s)) }
          : prev,
      );
      Alert.alert(t("familyRoom.sections.completeError"), err instanceof ApiError ? err.message : t("common.pleaseTryAgain"));
    } finally {
      setTogglingSection(null);
    }
  }

  async function handleAddItem(section: FamilyChecklistItem["section"]) {
    const label = (newItemText[section] || "").trim();
    if (!label) return;
    setAddingSection(section);
    try {
      const res = await createFamilyChecklistItem(profileId, section, label);
      setRoom((prev) => (prev ? { ...prev, checklist: [...prev.checklist, res.item] } : prev));
      setNewItemText((prev) => ({ ...prev, [section]: "" }));
    } catch (err) {
      Alert.alert(t("familyRoom.checklistAddError"), err instanceof ApiError ? err.message : t("common.pleaseTryAgain"));
    } finally {
      setAddingSection(null);
    }
  }

  async function handleToggleItem(item: FamilyChecklistItem) {
    setRoom((prev) =>
      prev
        ? { ...prev, checklist: prev.checklist.map((i) => (i.id === item.id ? { ...i, isDone: !i.isDone } : i)) }
        : prev,
    );
    try {
      await updateFamilyChecklistItem(item.id, { isDone: !item.isDone });
    } catch {
      setRoom((prev) =>
        prev
          ? { ...prev, checklist: prev.checklist.map((i) => (i.id === item.id ? { ...i, isDone: item.isDone } : i)) }
          : prev,
      );
    }
  }

  function handleDeleteItem(item: FamilyChecklistItem) {
    Alert.alert(t("familyRoom.checklistDeleteTitle"), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("familyRoom.checklistDeleteConfirm"),
        style: "destructive",
        onPress: async () => {
          setRoom((prev) => (prev ? { ...prev, checklist: prev.checklist.filter((i) => i.id !== item.id) } : prev));
          try {
            await deleteFamilyChecklistItem(item.id);
          } catch {
            load();
          }
        },
      },
    ]);
  }

  async function handleAddDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploadingDoc(true);
    try {
      const res = await uploadFamilyDocument(profileId, {
        uri: asset.uri,
        name: asset.name || `document-${Date.now()}`,
        type: asset.mimeType || "application/octet-stream",
      });
      setRoom((prev) => (prev ? { ...prev, documents: [res.document, ...prev.documents] } : prev));
    } catch (err) {
      Alert.alert(t("familyRoom.documentsUploadError"), err instanceof ApiError ? err.message : t("common.pleaseTryAgain"));
    } finally {
      setUploadingDoc(false);
    }
  }

  function handleDeleteDocument(doc: FamilyDocument) {
    Alert.alert(t("familyRoom.documentsDeleteTitle"), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("familyRoom.documentsDeleteConfirm"),
        style: "destructive",
        onPress: async () => {
          setRoom((prev) => (prev ? { ...prev, documents: prev.documents.filter((d) => d.id !== doc.id) } : prev));
          try {
            await deleteFamilyDocument(doc.id);
          } catch (err) {
            Alert.alert(t("familyRoom.documentsDeleteError"), err instanceof ApiError ? err.message : t("common.pleaseTryAgain"));
            load();
          }
        },
      },
    ]);
  }

  const checklistBySection = useMemo(() => {
    const map: Record<string, FamilyChecklistItem[]> = { parenting: [], finances: [], legal: [], general: [] };
    for (const item of room?.checklist || []) {
      (map[item.section] || map.general).push(item);
    }
    return map;
  }, [room?.checklist]);

  // Alena's reference mockup ("Your Family Plan", 4/10 progress ring +
  // "Planning with Marcus" header, "X completed 3 sections" body text):
  // real progress derived from the actual sections (both-completed count
  // out of FAMILY_PLAN_SECTION_KEYS.length), not a fabricated number - a
  // ring would need react-native-svg (a native module, meaning another
  // `eas build` before it could reach the phone at all - see
  // ChatWallpaper.tsx for the same tradeoff), so this is a horizontal
  // progress bar instead, same as the checklist used before this screen
  // had real sections.
  const sections = room?.sections || [];
  const totalSections = FAMILY_PLAN_SECTION_KEYS.length;
  const bothDoneCount = sections.filter((s) => s.myComplete && s.partnerComplete).length;
  const partnerDoneCount = sections.filter((s) => s.partnerComplete).length;
  const sectionsProgressPct = totalSections > 0 ? bothDoneCount / totalSections : 0;
  const heroTitleKey =
    bothDoneCount === 0
      ? "familyRoom.sectionsHeroTitleStart"
      : bothDoneCount >= totalSections
        ? "familyRoom.sectionsHeroTitleDone"
        : "familyRoom.sectionsHeroTitleProgress";

  if (status === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.gradientStart} />
      </View>
    );
  }

  if (status === "needsPremium") {
    return (
      <View style={styles.center}>
        <Text style={styles.stateTitle}>{t("familyRoom.premiumTitle")}</Text>
        <Text style={styles.stateBody}>{t("familyRoom.premiumBody")}</Text>
        <Pressable style={styles.primaryButton} onPress={() => navigation.navigate("Subscription")}>
          <Text style={styles.primaryButtonText}>{t("familyRoom.premiumButton")}</Text>
        </Pressable>
      </View>
    );
  }

  if (status === "noMatch") {
    return (
      <View style={styles.center}>
        <Text style={styles.stateTitle}>{t("familyRoom.noMatchTitle")}</Text>
        <Text style={styles.stateBody}>{t("familyRoom.noMatchBody")}</Text>
      </View>
    );
  }

  if (status === "error" || !room) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t("familyRoom.loadError")}</Text>
      </View>
    );
  }

  return (
    <GradientBackground variant="soft">
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: spacing.xl + insets.bottom }]}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>{t("familyRoom.planningWith", { name: displayName || "" })}</Text>
        <Text style={styles.heroSubtitle}>{t("familyRoom.sectionsSubtitle")}</Text>
        <View style={styles.heroProgressRow}>
          <View style={styles.heroProgressBadge}>
            <Text style={styles.heroProgressBadgeNum}>
              {t("familyRoom.sectionsDoneFraction", { done: bothDoneCount, total: totalSections })}
            </Text>
            <Text style={styles.heroProgressBadgeLabel}>{t("familyRoom.sectionsDoneLabel")}</Text>
          </View>
          <View style={styles.heroProgressCol}>
            <Text style={styles.heroProgressTitle}>{t(heroTitleKey)}</Text>
            {partnerDoneCount > 0 && displayName ? (
              <Text style={styles.heroProgressText}>
                {t("familyRoom.sectionsHeroBody", { name: displayName, count: partnerDoneCount })}
              </Text>
            ) : null}
            <View style={styles.heroProgressTrack}>
              <View style={[styles.heroProgressFill, { width: `${Math.round(sectionsProgressPct * 100)}%` }]} />
            </View>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("familyRoom.sectionsTitle")}</Text>
        {FAMILY_PLAN_SECTION_KEYS.map((key, index) => {
          const section = sections.find((s) => s.key === key);
          const myComplete = section?.myComplete ?? false;
          const partnerComplete = section?.partnerComplete ?? false;
          const bothComplete = myComplete && partnerComplete;
          const isExpanded = expandedSection === key;
          const statusText = bothComplete
            ? t("familyRoom.sections.bothCompleted")
            : myComplete
              ? t("familyRoom.sections.waitingOnPartner", { name: displayName || "" })
              : partnerComplete
                ? t("familyRoom.sections.waitingOnYou", { name: displayName || "" })
                : t("familyRoom.sections.notStarted");
          const draft = sectionDrafts[key] ?? "";
          const canSaveSection = Boolean(section) && savingSection !== key;
          return (
            <View key={key} style={styles.sectionPlanBlock}>
              <Pressable
                style={styles.sectionPlanRow}
                onPress={() => setExpandedSection(isExpanded ? null : key)}
              >
                <View style={[styles.checklistNumBadge, bothComplete && styles.checklistNumBadgeDone]}>
                  <Text style={[styles.checklistNumText, bothComplete && styles.checklistNumTextDone]}>
                    {bothComplete ? "✓" : index + 1}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionPlanTitle}>{t(`familyRoom.section.${key}.title`)}</Text>
                  <Text style={[styles.sectionPlanStatus, bothComplete && styles.sectionPlanStatusDone]}>{statusText}</Text>
                </View>
                <Text style={styles.sectionPlanChevron}>{isExpanded ? "⌃" : "⌄"}</Text>
              </Pressable>
              {isExpanded ? (
                <View style={styles.sectionPlanEditor}>
                  <Text style={styles.sectionPlanDesc}>{t(`familyRoom.section.${key}.desc`)}</Text>
                  <TextInput
                    style={styles.textArea}
                    multiline
                    value={draft}
                    placeholder={t("familyRoom.sections.placeholder")}
                    placeholderTextColor={colors.muted}
                    onChangeText={(v) => setSectionDrafts((prev) => ({ ...prev, [key]: v }))}
                  />
                  <View style={styles.sectionPlanActions}>
                    <Pressable
                      style={styles.sectionCompleteButton}
                      onPress={() => section && void handleToggleSectionComplete(section)}
                      disabled={togglingSection === key || !section}
                    >
                      {togglingSection === key ? (
                        <ActivityIndicator color={colors.pink} size="small" />
                      ) : (
                        <Text style={styles.sectionCompleteButtonText}>
                          {myComplete ? t("familyRoom.sections.markIncomplete") : t("familyRoom.sections.markComplete")}
                        </Text>
                      )}
                    </Pressable>
                    <Pressable
                      style={[styles.primaryButton, styles.sectionSaveButton, !canSaveSection && styles.primaryButtonDisabled]}
                      onPress={() => void handleSaveSection(key)}
                      disabled={!canSaveSection}
                    >
                      {savingSection === key ? (
                        <ActivityIndicator color={colors.white} />
                      ) : (
                        <Text style={styles.primaryButtonText}>{t("familyRoom.sections.save")}</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("familyRoom.checklistTitle")}</Text>
        {SECTIONS.map((section) => (
          <View key={section} style={styles.sectionBlock}>
            <Text style={styles.sectionLabel}>{t(`familyRoom.section.${section}`)}</Text>
            {checklistBySection[section].length === 0 ? (
              <Text style={styles.emptyText}>{t("familyRoom.checklistEmpty")}</Text>
            ) : (
              checklistBySection[section].map((item, index) => (
                <Pressable key={item.id} style={styles.checklistRow} onPress={() => void handleToggleItem(item)} onLongPress={() => handleDeleteItem(item)}>
                  {/* Alena's reference: numbered task rows, not bare
                      checkboxes - the number stays visible until the task
                      is done, then the badge fills in as a checkmark. */}
                  <View style={[styles.checklistNumBadge, item.isDone && styles.checklistNumBadgeDone]}>
                    <Text style={[styles.checklistNumText, item.isDone && styles.checklistNumTextDone]}>
                      {item.isDone ? "✓" : index + 1}
                    </Text>
                  </View>
                  <Text style={[styles.checklistLabel, item.isDone && styles.checklistLabelDone]}>{item.label}</Text>
                </Pressable>
              ))
            )}
            <View style={styles.addRow}>
              <TextInput
                style={styles.addInput}
                placeholder={t("familyRoom.checklistAddPlaceholder")}
                placeholderTextColor={colors.muted}
                value={newItemText[section] || ""}
                onChangeText={(v) => setNewItemText((prev) => ({ ...prev, [section]: v }))}
                onSubmitEditing={() => void handleAddItem(section)}
              />
              <Pressable style={styles.addButton} onPress={() => void handleAddItem(section)} disabled={addingSection === section}>
                {addingSection === section ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.addButtonText}>{t("familyRoom.checklistAdd")}</Text>
                )}
              </Pressable>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("familyRoom.documentsTitle")}</Text>
        {room.documents.length === 0 ? (
          <Text style={styles.emptyText}>{t("familyRoom.documentsEmpty")}</Text>
        ) : (
          room.documents.map((doc) => (
            <Pressable
              key={doc.id}
              style={styles.documentRow}
              onPress={() => Linking.openURL(doc.contentUrl).catch(() => Alert.alert(t("familyRoom.documentsOpenError")))}
              onLongPress={() => handleDeleteDocument(doc)}
            >
              <Text style={styles.documentIcon}>{doc.mimeType === "application/pdf" ? "📄" : "🖼️"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.documentName} numberOfLines={1}>
                  {doc.displayName}
                </Text>
                <Text style={styles.documentMeta}>{formatBytes(doc.bytes)}</Text>
              </View>
            </Pressable>
          ))
        )}
        <Pressable style={styles.addDocButton} onPress={() => void handleAddDocument()} disabled={uploadingDoc}>
          {uploadingDoc ? <ActivityIndicator color={colors.pink} /> : <Text style={styles.addDocButtonText}>{t("familyRoom.documentsAdd")}</Text>}
        </Pressable>
      </View>
    </ScrollView>
    </GradientBackground>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.sm },
  stateTitle: { fontSize: 18, fontWeight: "800", color: colors.text, textAlign: "center" },
  stateBody: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20 },
  errorText: { color: colors.danger },
  container: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl, backgroundColor: "transparent" },
  hero: { paddingHorizontal: spacing.xs, gap: 6 },
  heroTitle: { fontSize: 19, fontWeight: "800", color: colors.ink },
  heroProgressText: { fontSize: 13, color: colors.mutedOnGradient, fontWeight: "600" },
  heroProgressTrack: { height: 8, borderRadius: radius.pill, backgroundColor: "rgba(2,8,23,0.08)", overflow: "hidden" },
  heroProgressFill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.pink },
  heroSubtitle: { fontSize: 13, color: colors.mutedOnGradient, lineHeight: 18, marginBottom: 4 },
  heroProgressRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 4 },
  heroProgressBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.pink,
  },
  heroProgressBadgeNum: { fontSize: 16, fontWeight: "800", color: colors.ink, textAlign: "center" },
  heroProgressBadgeLabel: { fontSize: 9, fontWeight: "700", color: colors.muted, letterSpacing: 0.5, marginTop: 1 },
  heroProgressCol: { flex: 1, gap: 4 },
  heroProgressTitle: { fontSize: 14.5, fontWeight: "700", color: colors.ink },
  sectionPlanBlock: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionPlanRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sectionPlanTitle: { fontSize: 14.5, fontWeight: "700", color: colors.ink },
  sectionPlanStatus: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  sectionPlanStatusDone: { color: colors.pink, fontWeight: "600" },
  sectionPlanChevron: { fontSize: 16, color: colors.muted, paddingHorizontal: 4 },
  sectionPlanEditor: { marginTop: spacing.sm, marginLeft: 30, gap: spacing.xs },
  sectionPlanDesc: { fontSize: 12.5, color: colors.muted, lineHeight: 17, marginBottom: 2 },
  sectionPlanActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  sectionCompleteButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.pink,
    borderRadius: radius.pill,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionCompleteButtonText: { color: colors.pink, fontWeight: "700", fontSize: 13 },
  sectionSaveButton: { flex: 1, marginTop: 0 },
  sharedPlanNote: { fontSize: 12.5, color: colors.muted, marginBottom: spacing.xs, lineHeight: 17 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTitle: { fontSize: 17, fontWeight: "800", color: colors.ink, marginBottom: spacing.xs },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: colors.muted, marginTop: spacing.xs },
  textArea: {
    minHeight: 72,
    backgroundColor: colors.bgSoft,
    borderRadius: radius.md,
    padding: spacing.sm,
    fontSize: 14,
    color: colors.text,
    textAlignVertical: "top",
  },
  primaryButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.pink,
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: colors.white, fontWeight: "700", fontSize: 14 },
  sectionBlock: { marginTop: spacing.sm, gap: spacing.xs },
  sectionLabel: { fontSize: 13, fontWeight: "800", color: colors.blueDark, textTransform: "uppercase" },
  emptyText: { fontSize: 13, color: colors.muted, fontStyle: "italic" },
  checklistRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: 6 },
  checklistCheck: { fontSize: 18, color: colors.pink, width: 22 },
  checklistNumBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  checklistNumBadgeDone: { backgroundColor: colors.pink, borderColor: colors.pink },
  checklistNumText: { fontSize: 11, fontWeight: "700", color: colors.muted },
  checklistNumTextDone: { color: colors.white },
  checklistLabel: { fontSize: 14, color: colors.text, flex: 1 },
  checklistLabelDone: { color: colors.muted, textDecorationLine: "line-through" },
  addRow: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.xs },
  addInput: {
    flex: 1,
    backgroundColor: colors.bgSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.text,
  },
  addButton: { backgroundColor: colors.blue, borderRadius: radius.md, paddingHorizontal: spacing.sm, alignItems: "center", justifyContent: "center" },
  addButtonText: { color: colors.white, fontWeight: "700", fontSize: 13 },
  documentRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  documentIcon: { fontSize: 22 },
  documentName: { fontSize: 14, fontWeight: "600", color: colors.text },
  documentMeta: { fontSize: 12, color: colors.muted },
  addDocButton: { marginTop: spacing.sm, borderWidth: 1, borderColor: colors.pink, borderRadius: radius.pill, paddingVertical: 10, alignItems: "center" },
  addDocButtonText: { color: colors.pink, fontWeight: "700", fontSize: 14 },
});
