import React, { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
// SDK 57 bumped expo-file-system to a new class-based File/Directory API
// as the default export - the classic promise-based one this screen uses
// (cacheDirectory, downloadAsync) still exists, just moved to this
// "/legacy" subpath rather than being removed.
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { RESOURCES_CATEGORIES } from "../data/resources";
import { SITE_BASE_URL } from "../config";
import { colors, radius, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "ResourceTool">;

// Mirrors the website's ResourceTool component. On the web this is a plain
// <a href=... download>; RN has no equivalent, so this downloads the real
// .docx to local storage with expo-file-system and hands it to the OS share
// sheet (expo-sharing) so the person can save it to Files/Drive/print/etc -
// same end result (they get the real file), different mechanism.
export default function ResourceToolScreen({ route, navigation }: Props) {
  const [downloading, setDownloading] = useState(false);

  const cat = RESOURCES_CATEGORIES.find((item) => item.slug === route.params.categorySlug);
  const tool = cat?.tools.find((item) => item.slug === route.params.toolSlug);

  if (!cat || !tool) {
    return (
      <View style={styles.container}>
        <Text style={styles.notFoundTitle}>Resource not found</Text>
        <Pressable style={styles.backButton} onPress={() => navigation.navigate("MainTabs", { screen: "Resources" })}>
          <Text style={styles.backButtonText}>Back to Resources & Tools</Text>
        </Pressable>
      </View>
    );
  }

  async function handleDownload() {
    if (!tool!.downloadUrl) return;
    setDownloading(true);
    try {
      const remoteUrl = `${SITE_BASE_URL}${tool!.downloadUrl}`;
      const localUri = `${FileSystem.cacheDirectory}${tool!.downloadName || "resource.docx"}`;
      const { uri } = await FileSystem.downloadAsync(remoteUrl, localUri);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert("Downloaded", `Saved to ${uri}`);
      }
    } catch (err) {
      Alert.alert("Couldn't download this file", "Check your connection and try again.");
    } finally {
      setDownloading(false);
    }
  }

  const related = cat.tools.filter((item) => item.slug !== tool.slug).slice(0, 3);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{tool.title}</Text>
      <Text style={styles.body}>{tool.description}</Text>

      {tool.downloadUrl ? (
        <View style={styles.downloadRow}>
          <Pressable style={styles.downloadButton} onPress={handleDownload} disabled={downloading}>
            {downloading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.downloadButtonText}>Download the template →</Text>}
          </Pressable>
          {tool.format ? <Text style={styles.format}>{tool.format}</Text> : null}
        </View>
      ) : (
        <Text style={styles.comingSoon}>Coming soon</Text>
      )}

      {tool.sections ? (
        <>
          <Text style={styles.sectionHeading}>What's inside</Text>
          <Text style={styles.sectionSub}>
            {tool.sections.length} sections, each with open questions for both of you to answer - independently
            first, then together.
          </Text>
          {tool.sections.map((section, index) => (
            <View key={section} style={styles.sectionRow}>
              <Text style={styles.sectionIndex}>{String(index + 1).padStart(2, "0")}</Text>
              <Text style={styles.sectionLabel}>{section}</Text>
            </View>
          ))}

          {tool.sampleQuestions ? (
            <View style={styles.samplesBox}>
              <Text style={styles.samplesLabel}>A few sample questions from section 1</Text>
              {tool.sampleQuestions.map((q) => (
                <Text key={q} style={styles.sampleQuestion}>
                  "{q}"
                </Text>
              ))}
            </View>
          ) : null}

          {tool.disclaimer ? <Text style={styles.disclaimer}>{tool.disclaimer}</Text> : null}

          {related.length > 0 ? (
            <View style={styles.relatedBox}>
              <Text style={styles.relatedHeading}>Related resources</Text>
              {related.map((item) => (
                <Pressable
                  key={item.slug}
                  onPress={() => navigation.replace("ResourceTool", { categorySlug: cat.slug, toolSlug: item.slug })}
                >
                  <Text style={styles.relatedLink}>{item.title} →</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <View style={styles.comingSoonBox}>
          <Text style={styles.comingSoonText}>
            We're finishing this resource - check back soon, or explore what's already available in {cat.eyebrow}.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  notFoundTitle: { fontSize: 18, fontWeight: "800", color: colors.text, margin: spacing.lg },
  backButton: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.gradientStart,
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: "center",
  },
  backButtonText: { color: colors.white, fontWeight: "700" },
  title: { fontSize: 22, fontWeight: "800", color: colors.text },
  body: { fontSize: 14, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 20 },
  downloadRow: { marginTop: spacing.lg, gap: spacing.xs },
  downloadButton: {
    backgroundColor: colors.gradientStart,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: "center",
  },
  downloadButtonText: { color: colors.white, fontWeight: "700" },
  format: { fontSize: 12, color: colors.textMuted, textAlign: "center" },
  comingSoon: { marginTop: spacing.lg, fontSize: 13, fontWeight: "700", color: colors.premium },
  sectionHeading: { fontSize: 17, fontWeight: "800", color: colors.text, marginTop: spacing.xl },
  sectionSub: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs, lineHeight: 18 },
  sectionRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm, gap: spacing.sm },
  sectionIndex: { fontSize: 12, fontWeight: "800", color: colors.gradientStart, width: 24 },
  sectionLabel: { fontSize: 14, color: colors.text, flex: 1 },
  samplesBox: { backgroundColor: colors.bgSoft, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.lg },
  samplesLabel: { fontSize: 12, fontWeight: "700", color: colors.textMuted, marginBottom: spacing.sm },
  sampleQuestion: { fontSize: 13, color: colors.text, marginTop: spacing.xs, fontStyle: "italic" },
  disclaimer: { fontSize: 12, color: colors.textMuted, marginTop: spacing.lg, lineHeight: 17 },
  relatedBox: { marginTop: spacing.xl, gap: spacing.sm },
  relatedHeading: { fontSize: 15, fontWeight: "800", color: colors.text, marginBottom: spacing.xs },
  relatedLink: { fontSize: 14, fontWeight: "700", color: colors.gradientStart, marginTop: spacing.xs },
  comingSoonBox: { backgroundColor: colors.bgSoft, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.lg },
  comingSoonText: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
});
