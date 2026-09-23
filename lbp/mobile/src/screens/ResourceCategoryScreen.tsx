import React from "react";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { RESOURCES_CATEGORIES, CATEGORY_ICON, localizedCategory, localizedTool } from "../data/resources";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GradientBackground from "../components/GradientBackground";

type Props = NativeStackScreenProps<RootStackParamList, "ResourceCategory">;

// Mirrors the website's ResourceCategory component: a tool grid for one
// category, plus the compatibility-quiz promo strip on co-parenting only.
//
// UPDATE (Sept 2026): same "Проверь по всем языкам" pass as
// ResourceToolScreen.tsx - own labels through t(), category/tool copy
// through localizedCategory()/localizedTool() (data/resources.ts).
export default function ResourceCategoryScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t, locale } = useI18n();
  const baseCat = RESOURCES_CATEGORIES.find((item) => item.slug === route.params.slug);
  // Alena: this screen was flat gray/white for every category (screenshots
  // of Co-parenting/Fertility/Parenthood planning all looked identical) -
  // ResourcesScreen.tsx already colors each category with its own tint
  // (blue/pink/green, from the prototype) via CATEGORY_ICON, this screen
  // just never carried that through. Reusing the exact same mapping here.
  const iconInfo = baseCat ? CATEGORY_ICON[baseCat.icon] || { emoji: "📄", bg: colors.bgSoft, accent: colors.gradientStart } : null;

  if (!baseCat) {
    return (
      <View style={styles.container}>
        <Text style={styles.notFoundTitle}>{t("resources.categoryNotFound")}</Text>
        <Pressable style={styles.backButton} onPress={() => navigation.navigate("Resources")}>
          <Text style={styles.backButtonText}>{t("resources.backToResources")}</Text>
        </Pressable>
      </View>
    );
  }

  const cat = localizedCategory(baseCat, locale);
  const tools = baseCat.tools.map((tool) => localizedTool(baseCat, tool, locale));

  return (
    <GradientBackground variant="soft">
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}>
      <View style={[styles.heroIconWrap, { backgroundColor: iconInfo!.bg }]}>
        <Text style={styles.heroIcon}>{iconInfo!.emoji}</Text>
      </View>
      <Text style={styles.heroTitle}>{cat.title}</Text>
      <Text style={styles.heroBody}>{cat.description}</Text>

      {tools.map((tool) => (
        <Pressable
          key={tool.slug}
          style={[styles.toolCard, { borderLeftColor: iconInfo!.accent }]}
          onPress={() => navigation.navigate("ResourceTool", { categorySlug: cat.slug, toolSlug: tool.slug })}
        >
          <View style={[styles.toolIconWrap, { backgroundColor: iconInfo!.bg }]}>
            <Text style={styles.toolIcon}>{iconInfo!.emoji}</Text>
          </View>
          {tool.tag ? <Text style={styles.toolTag}>{tool.tag}</Text> : null}
          <Text style={styles.toolTitle}>{tool.title}</Text>
          <Text style={styles.toolBody}>{tool.description}</Text>
          <Text style={[styles.toolLink, { color: iconInfo!.accent }]}>
            {tool.downloadUrl ? t("resources.downloadTemplateLink") : t("resources.viewResource")} →
          </Text>
        </Pressable>
      ))}

      {cat.slug === "co-parenting" ? (
        <View style={styles.quizStrip}>
          <Text style={styles.quizTitle}>{t("resources.quizPromptTitle")}</Text>
          <Text style={styles.quizBody}>{t("resources.quizPromptBody")}</Text>
          <Pressable style={styles.quizButton} onPress={() => navigation.navigate("CompatibilityQuiz")}>
            <Text style={styles.quizButtonText}>{t("resources.quizPromptCta")}</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
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
  heroIconWrap: { width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  heroIcon: { fontSize: 24 },
  heroTitle: { fontSize: 22, fontWeight: "800", color: colors.text },
  heroBody: { fontSize: 14, color: colors.mutedOnGradient, marginTop: spacing.sm, lineHeight: 20 },
  toolCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderLeftWidth: 4,
  },
  toolIconWrap: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: spacing.xs },
  toolIcon: { fontSize: 18 },
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
