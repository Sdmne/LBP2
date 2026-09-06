import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { openFamilyDocument } from "../api/familyDocuments";
import {
  createFamilyChecklistItem,
  deleteFamilyChecklistItem,
  deleteFamilyDocument,
  fetchFamilyRoom,
  updateFamilyChecklistItem,
  updateFamilyPlan,
  uploadFamilyDocument,
  type FamilyChecklistItem,
  type FamilyDocument,
  type FamilyRoom,
} from "../api/familyRoom";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
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

  const [room, setRoom] = useState<FamilyRoom | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "needsPremium" | "noMatch" | "error">("loading");

  const [parenting, setParenting] = useState("");
  const [finances, setFinances] = useState("");
  const [legal, setLegal] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);
  const [planDirty, setPlanDirty] = useState(false);

  const [newItemText, setNewItemText] = useState<Record<string, string>>({});
  const [addingSection, setAddingSection] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [openingDocument, setOpeningDocument] = useState<number | null>(null);

  async function handleOpenDocument(document: FamilyDocument) {
    if (openingDocument !== null) return;
    setOpeningDocument(document.id);
    try {
      await openFamilyDocument(document);
    } catch {
      Alert.alert(t("familyRoom.documentsTitle"), t("familyRoom.documentsOpenError"));
    } finally {
      setOpeningDocument(null);
    }
  }

  const load = useCallback(() => {
    setStatus("loading");
    fetchFamilyRoom(profileId)
      .then((res) => {
        setRoom(res);
        setParenting(res.plan.parentingNotes);
        setFinances(res.plan.financesNotes);
        setLegal(res.plan.legalNotes);
        setPlanDirty(false);
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

  async function handleSavePlan() {
    if (savingPlan || !room) return;
    setSavingPlan(true);
    try {
      const values = {
        parentingNotes: parenting,
        financesNotes: finances,
        legalNotes: legal,
      };
      const updates = Object.fromEntries(Object.entries(values)
        .filter(([key, value]) => value !== room.plan[key as keyof typeof values]));
      const res = await updateFamilyPlan(profileId, updates);
      setRoom((prev) => (prev ? { ...prev, plan: res.plan } : prev));
      setParenting(res.plan.parentingNotes);
      setFinances(res.plan.financesNotes);
      setLegal(res.plan.legalNotes);
      setPlanDirty(false);
    } catch (err) {
      Alert.alert(t("familyRoom.planSaveError"), err instanceof ApiError ? err.message : t("common.pleaseTryAgain"));
    } finally {
      setSavingPlan(false);
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
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("familyRoom.planTitle")}</Text>

        <Text style={styles.fieldLabel}>{t("familyRoom.planParenting")}</Text>
        <TextInput
          style={styles.textArea}
          multiline
          value={parenting}
          editable={!savingPlan}
          maxLength={20000}
          placeholder={t("familyRoom.planPlaceholder")}
          placeholderTextColor={colors.muted}
          onChangeText={(v) => {
            setParenting(v);
            setPlanDirty(true);
          }}
        />

        <Text style={styles.fieldLabel}>{t("familyRoom.planFinances")}</Text>
        <TextInput
          style={styles.textArea}
          multiline
          value={finances}
          editable={!savingPlan}
          maxLength={20000}
          placeholder={t("familyRoom.planPlaceholder")}
          placeholderTextColor={colors.muted}
          onChangeText={(v) => {
            setFinances(v);
            setPlanDirty(true);
          }}
        />

        <Text style={styles.fieldLabel}>{t("familyRoom.planLegal")}</Text>
        <TextInput
          style={styles.textArea}
          multiline
          value={legal}
          editable={!savingPlan}
          maxLength={20000}
          placeholder={t("familyRoom.planPlaceholder")}
          placeholderTextColor={colors.muted}
          onChangeText={(v) => {
            setLegal(v);
            setPlanDirty(true);
          }}
        />

        <Pressable
          style={[styles.primaryButton, (!planDirty || savingPlan) && styles.primaryButtonDisabled]}
          onPress={handleSavePlan}
          disabled={!planDirty || savingPlan}
        >
          {savingPlan ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>{t("familyRoom.planSave")}</Text>}
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("familyRoom.checklistTitle")}</Text>
        {SECTIONS.map((section) => (
          <View key={section} style={styles.sectionBlock}>
            <Text style={styles.sectionLabel}>{t(`familyRoom.section.${section}`)}</Text>
            {checklistBySection[section].length === 0 ? (
              <Text style={styles.emptyText}>{t("familyRoom.checklistEmpty")}</Text>
            ) : (
              checklistBySection[section].map((item) => (
                <Pressable key={item.id} style={styles.checklistRow} onPress={() => void handleToggleItem(item)} onLongPress={() => handleDeleteItem(item)}>
                  <Text style={styles.checklistCheck}>{item.isDone ? "☑" : "☐"}</Text>
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
              disabled={openingDocument !== null}
              onPress={() => void handleOpenDocument(doc)}
              onLongPress={() => handleDeleteDocument(doc)}
            >
              {openingDocument === doc.id ? <ActivityIndicator color={colors.pink} /> : <Text style={styles.documentIcon}>{doc.mimeType === "application/pdf" ? "📄" : "🖼️"}</Text>}
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
  container: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
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
