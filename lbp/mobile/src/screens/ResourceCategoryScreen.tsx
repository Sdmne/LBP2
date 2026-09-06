import React from "react";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { RESOURCES_CATEGORIES } from "../data/resources";
import { colors, radius, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "ResourceCategory">;

// Mirrors the website's ResourceCategory component: a tool grid for one
// category, plus the compatibility-quiz promo strip on co-parenting only.
export default function ResourceCategoryScreen({ route, navigation }: Props) {
  const cat = RESOURCES_CATEGORIES.find((item) => item.slug === route.params.slug);

  if (!cat) {
    return (
      <View style={styles.container}>
        <Text style={styles.notFoundTitle}>Resource category not found</Text>
        <Pressable style={styles.backButton} onPress={() => navigation.navigate("MainTabs", { screen: "Resources" })}>
          <Text style={styles.backButtonText}>Back to Resources & Tools</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heroTitle}>{cat.title}</Text>
      <Text style={styles.heroBody}>{cat.description}</Text>

      {cat.tools.map((tool) => (
        <Pressable
          key={tool.slug}
          style={styles.toolCard}
          onPress={() => navigation.navigate("ResourceTool", { categorySlug: cat.slug, toolSlug: tool.slug })}
        >
          <Text style={styles.toolIcon}>📄</Text>
          {tool.tag ? <Text style={styles.toolTag}>{tool.tag}</Text> : null}
          <Text style={styles.toolTitle}>{tool.title}</Text>
          <Text style={styles.toolBody}>{tool.description}</Text>
          <Text style={styles.toolLink}>{tool.downloadUrl ? "Download the template" : "View resource"} →</Text>
        </Pressable>
      ))}

      {cat.slug === "co-parenting" ? (
        <View style={styles.quizStrip}>
          <Text style={styles.quizTitle}>Not sure you're on the same page yet?</Text>
          <Text style={styles.quizBody}>
            The Co-Parenting Compatibility Quiz helps you and a potential co-parent see where your expectations
            align - and what's worth discussing further.
          </Text>
          <Pressable style={styles.quizButton} onPress={() => navigation.navigate("CompatibilityQuiz")}>
            <Text style={styles.quizButtonText}>Take the quiz →</Text>
          </Pressable>
        </View>
      ) : null}
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
  heroTitle: { fontSize: 22, fontWeight: "800", color: colors.text },
  heroBody: { fontSize: 14, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 20 },
  toolCard: { backgroundColor: colors.bgSoft, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.md },
  toolIcon: { fontSize: 20, marginBottom: spacing.xs },
  toolTag: { fontSize: 11, fontWeight: "700", color: colors.success, marginBottom: spacing.xs },
  toolTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  toolBody: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs, lineHeight: 18 },
  toolLink: { fontSize: 13, fontWeight: "700", color: colors.gradientStart, marginTop: spacing.sm },
  quizStrip: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: colors.gradientStart,
  },
  quizTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  quizBody: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs, lineHeight: 18 },
  quizButton: {
    marginTop: spacing.md,
    backgroundColor: colors.gradientStart,
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: "center",
  },
  quizButtonText: { color: colors.white, fontWeight: "700" },
});
